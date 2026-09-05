# Kaki Mahjong — AWS backend

AWS CDK (TypeScript) implementation of the backend architecture from the Kaki
Mahjong proposal (section 7). This provisions and wires together:

| Service | What it's for |
|---|---|
| API Gateway (WebSocket) | Real-time draw/discard/call events between the 4 players |
| AWS Lambda | `connect`, `disconnect`, `join`, `action` (game-move), and `advise` (move-advisor) handlers |
| Amazon DynamoDB | Single table storing room membership + live game state |
| Amazon Cognito | Phone-number (OTP) sign-in |
| Amazon S3 + CloudFront | Static assets, and Polly narration clips cached by text hash |
| Amazon Polly | Text-to-speech narration of game events and move advice |
| Amazon CloudWatch | Error alarm on the game-action Lambda |

## Move-advisor ("chatbot") feature

`lambda/advise.ts` + `lambda/mahjong/` is a self-contained assistant that:

1. **Reads out opponents' discards aloud** — via the same Polly narration
   pipeline used for game events.
2. **Recommends the best move** — computed with a real (if intentionally
   simple) *shanten* engine in `lambda/mahjong/shanten.ts`: it decomposes a
   hand into melds/pairs to find the minimum number of tile exchanges from
   winning, covering standard hands, seven pairs, and thirteen wonders.
   `lambda/mahjong/advisor.ts` uses that to (a) tell the player which calls
   are currently legal (chow — only from the player on their left — pong,
   kong, win) and (b) recommend which tile to discard, using resulting
   shanten as the primary signal and how often a tile has already been
   discarded by others as a defensive tie-breaker.

This is deliberately **personal to the requesting player**: unlike `action`,
the `advise` route never broadcasts to the room — an opponent should never
see your hand or your recommendations, so the response only goes back down
the requesting player's own WebSocket connection.

`lambda/mahjong/sanity-test.ts` is a small standalone test file (not part of
the CDK deploy) exercising the shanten calculator against known hands —
run it locally with:

```bash
npx ts-node --compiler-options '{"types":["node"],"lib":["ES2020"]}' lambda/mahjong/sanity-test.ts
```

**Known limitation:** the shanten engine handles the common cases (melds,
pairs, kanchan/two-sided partial melds) correctly but isn't a full
tournament-grade agari solver — fine for "nudge a senior player toward a
reasonable move," not for competitive scoring. Swap in a dedicated shanten
library if this becomes a stricter rules-enforcement engine later.

The **game engine itself is a stub**: `lambda/gameAction.ts` records each
move and broadcasts it, with a clearly marked seam (`applyAction`) where the
real Singapore Mahjong rules engine (tile legality, Chow/Pong/Kong/Win
validation, limit-hand scoring) plugs in — that's Phase 2 of the roadmap in
the proposal, not infrastructure. This project gets the plumbing running end
to end first, per the "always have a working demo" approach in the roadmap.

## Project layout

```
bin/app.ts                 CDK app entry point
lib/kaki-mahjong-stack.ts  The whole backend as one stack
lambda/util.ts             Shared DynamoDB + WebSocket helpers
lambda/connect.ts          $connect route
lambda/disconnect.ts       $disconnect route (cleans up + notifies room)
lambda/join.ts             "join" route — seats a player in a room
lambda/gameAction.ts       "action" route — moves + Polly narration
lambda/advise.ts           "advise" route — the move-advisor chatbot
lambda/classifyIntent.ts   HTTP "/classify-intent" route — help-coach fallback classifier
lambda/mahjong/tiles.ts    Tile encoding + human-readable parsing
lambda/mahjong/shanten.ts  Distance-to-win calculator
lambda/mahjong/advisor.ts  Legal-call detection + discard recommendation
lambda/mahjong/sanity-test.ts  Standalone tests for the above (not deployed)
shared/intents.json        The classifier's intent catalogue — see below
test/classifyIntent.test.ts             Unit tests (mocked Bedrock, no real AWS calls)
test/integration.coach-classifier.test.mjs  Cross-package smoke test — see Testing below
```

## Help-coach fallback classifier

`lambda/classifyIntent.ts` backs the frontend help coach's `askWithModel()`
(`frontend/src/game/coach.js`). The coach is otherwise fully local — no
network, no API key (see `frontend/docs`) — and stays that way for every
question its own keyword patterns recognise. Only when a typed question
matches none of them does the frontend POST `{ question }` to this route —
nothing else.

This is deliberately a plain HTTP API (`CoachApi`), not a new WebSocket
route: classifying one string needs no room, no connection, no game state,
so it would be pure overhead to require joining a multiplayer session just
to ask for help.

The Lambda calls Amazon Bedrock (`us.amazon.nova-micro-v1:0` by default —
the US cross-region inference profile for Nova Micro, cheap and fast,
right-sized for a one-word classification task; most regions no longer
serve Nova by a bare on-demand model id) with its own
intent catalogue (`shared/intents.json`, imported at build time — see below)
and asks it to return exactly one of those ids, or `fallback`. **The model
never writes what the player reads** — it only picks which of the coach's
existing, locally-computed answer functions to call, so none of the
accuracy guarantees in `docs/mvp-notes.md` (correct by construction, aware
of this table's own house rules) are weakened. Any failure — Bedrock
unavailable, model access not granted, a timeout, an id we don't recognise —
is treated identically to "no match" and the coach's own local fallback
answer is used instead; the coach never breaks, and works with zero backend
deployed at all if `frontend/.env.template`'s `VITE_CLASSIFY_INTENT_URL` is
left blank.

Swap the model with `npx cdk deploy -c bedrockModelId=<id>` if your account's
model access differs — another inference profile (`eu.amazon.nova-micro-v1:0`
if you deploy to eu-*, `apac.…` for ap-*), a bigger Nova (`us.amazon.nova-lite-v1:0`),
or a single-region model such as an Anthropic Claude Haiku id. `-c agentModelId=`
does the same for the post-hand review route independently. The `bedrock:InvokeModel`
IAM policy adapts automatically (`lib/bedrockResources.ts`): a profile id gets the
profile ARN plus the region-wildcarded base-model ARN, a bare id gets just the one
foundation-model ARN. A cross-region profile whose `us.` / `eu.` / `apac.` prefix
doesn't match the deploy region **fails `cdk synth`** with a fix hint, rather than
deploying an IAM config that only breaks on the first Bedrock call.

### The intent catalogue is backend-owned, not client-supplied

An earlier version of this route accepted the intent list — including a
free-text "hint" per intent — from the request body, so it could be kept in
sync with whatever `coach.js` currently supports. That meant an untrusted
caller could put arbitrary text into the Bedrock prompt via the hint field.
`shared/intents.json` fixes that: it's the backend's own catalogue —
`classifyIntent.ts` imports it at build time (bundled directly into the
Lambda by esbuild; `tsconfig.json`'s `resolveJsonModule` makes the same
import type-check) and builds its prompt from nothing else — and the
request now carries nothing but the question.

This is *not* a single file both packages read at runtime: `coach.js` keeps
its own `INTENTS` array in the frontend package, because it needs more than
an id and a hint per intent — an answer function and the regex patterns
that route to it, neither of which belongs in a JSON file the backend also
bundles. What ties the two together is a test, not a shared import:
`frontend/test/coach.test.js` asserts `coach.js`'s intent ids and
`shared/intents.json`'s ids are exactly equal, so if someone adds, removes
or renames an intent on one side and forgets the other, `npm test` fails
instead of the drift silently degrading the coach's model-assisted answers.

### This endpoint takes no credentials — throttling is the actual defense

`classify-intent` has no auth check, by design: requiring a signed-in user
for "what does pong do, phrased unusually" is disproportionate for a
same-table coach, and this project has no sign-in flow wired up yet either.
That means anything bounding cost has to sit in front of the model call
itself, not in an auth check:

- **API Gateway throttling** on `CoachApi`'s stage — `rateLimit: 2` req/s,
  `burstLimit: 5` by default. Override with `-c coachApiRateLimit=` /
  `-c coachApiBurstLimit=` if a real demo needs more headroom.
- **Reserved concurrency of 2** on `ClassifyIntentFn` and `ReviewHandFn` — a
  hard ceiling on how many invocations can run at once, independent of the
  throttle above. Override with `-c coachApiConcurrency=`. Set
  `-c coachApiConcurrency=0` to drop it entirely: a restricted account (e.g. a
  workshop sandbox) can have a Lambda concurrency limit low enough that
  reserving *any* leaves fewer than the 10 unreserved executions AWS requires
  account-wide, and `cdk deploy` fails with `decreases account's
  UnreservedConcurrentExecution below its minimum value of [10]`.

Both are deliberately conservative for a hackathon project on a small
Bedrock budget, and both bound the *rate* of Bedrock calls — neither is a
ceiling on total spend. A caller sitting at the throttle limit continuously,
forever, still accumulates unbounded cost over time; it just accrues slowly.
If this ever needs real per-user identity (rate limits per player rather
than per deployment, for instance), the `UserPool` this stack already
provisions is the natural next step — a JWT authorizer on this route — but
that also means building a sign-in flow into the frontend, which is out of
scope for what is currently a single-player, no-accounts MVP (see
`docs/mvp-notes.md`'s known simplifications).

- **An AWS Budget** is the actual dollar-amount guardrail: `-c
  coachBudgetAlertEmail=you@example.com` provisions a monthly Budget scoped
  to Bedrock cost that emails that address once spend crosses 80% of `-c
  coachBudgetLimitUsd=` (default `20`). Unlike the throttle/concurrency
  above, this is unset by default — `cdk synth`/`deploy` prints a warning if
  it's missing, since this endpoint takes no credentials (see below) and is
  reachable by anyone who has its URL.

## Prerequisites

- Node.js 18+ and npm
- An AWS account, with the AWS CLI configured (`aws configure`) using
  credentials that can create the resources above (or an AWS Educate /
  student account with sufficient permissions)
- The AWS CDK CLI: `npm install -g aws-cdk` (or just use `npx cdk ...`
  as below, no global install needed)

## Deploy

```bash
npm install

# One-time per AWS account/region — provisions the CDK's own support stack
npx cdk bootstrap

# Preview the CloudFormation this will create
npx cdk synth

# Deploys to us-east-1 unless CDK_DEFAULT_REGION is set (see bin/app.ts).
# us-east-1 is where the hackathon sandbox's org policy permits Bedrock and
# where the default model profile (us.amazon.nova-micro-v1:0) resolves. If
# you change the region, also pass -c bedrockModelId / -c agentModelId with
# that region's inference-profile prefix (eu. / apac.) or a single-region model.
npx cdk deploy
```

`cdk deploy` prints the important values at the end (also visible any time
via `aws cloudformation describe-stacks`):

- `WebSocketUrl` — the `wss://` endpoint the client app connects to
- `ClassifyIntentUrl` — set as `VITE_CLASSIFY_INTENT_URL` in the frontend to turn on the help
  coach's model-assisted fallback (optional — the coach works without it)
- `UserPoolId` / `UserPoolClientId` — for Cognito sign-in in the client
- `AssetsBucketName` — upload tile graphics/sounds here (e.g. under `tiles/`)
- `AssetsDomainName` — the CloudFront domain serving those assets and Polly audio
- `GameTableName` — mostly useful for debugging in the DynamoDB console

## Trying it end to end

1. Deploy, then connect a WebSocket client (e.g. `wscat -c <WebSocketUrl>`)
   to `WebSocketUrl`.
2. Send a join message:
   ```json
   {"action":"join","roomId":"table1","playerId":"p1","playerName":"Ah Ma","seat":0}
   ```
3. Send a game action:
   ```json
   {"action":"action","roomId":"table1","playerId":"p1","action":"discard","tile":"5-dot"}
   ```
   (Note: the outer `"action":"join"` / `"action":"action"` selects the
   WebSocket **route**; the inner `action` field in the action message is the
   game move type.)
4. You should see a `gameUpdate` broadcast back, including a `narration.audioUrl`
   pointing at a Polly-generated MP3 served from CloudFront.
5. Ask the advisor for a recommendation:
   ```json
   {"action":"advise","playerId":"p1","hand":["5-dot","5-dot","1-character","2-character","3-character","4-dot","6-dot","7-bamboo","8-bamboo","9-bamboo","east","south","west","north"],"lastDiscard":{"tile":"5-dot","byPlayerId":"p2","byPlayerName":"Ah Kong","seatOffset":3}}
   ```
   You'll get an `advice` message back (only on your own connection) with
   the legal calls, a recommended discard, and a spoken narration URL along
   the lines of *"Ah Kong discards 5-dot. You can call pong or kong on this
   tile."*

## Testing

```bash
npm test              # unit tests — mocked Bedrock, no AWS calls, no deploy needed
npm run test:integration  # builds, then runs the cross-package smoke test
```

`npm test` runs `classifyIntent.test.ts` via `node`'s built-in test runner
(`ts-node/register` for the TypeScript, same `node:test` + `assert/strict`
convention the frontend suite uses — no new test framework). Every test
mocks `BedrockRuntimeClient.prototype.send`, so none of them touch the
network or cost anything, and they cover: malformed JSON, a missing /
empty / non-string / oversized question, a client trying to smuggle its own
intent list back in (regression test for the prompt-injection fix), a valid
request, and every way Bedrock could misbehave — an unrecognised id, the
literal `fallback`, extra words around a valid id, mixed case, an empty or
missing content block, a thrown exception, and a permissions failure —
checking each one degrades to a plain `{ intent: "fallback" }` response
rather than an error.

`npm run test:integration` (`backend/test/integration.coach-classifier.test.mjs`)
builds the backend, then imports the compiled Lambda alongside the real
frontend `askWithModel()` and wires the coach's `fetch()` straight into the
handler in-process — no HTTP server, no real network, Bedrock still mocked.
It's the one place that actually proves the two packages agree on the
request/response shape rather than each side just being internally
consistent with its own tests: one case mocks Bedrock returning `rules.kong`
and checks the coach ends up showing the real local kong answer; the other
mocks Bedrock throwing and checks the coach ends up with its ordinary local
fallback, not an error. Kept separate from `npm test` (in both packages)
specifically so the default test command never has a cross-package build
dependency.

## Cost notes

Every service here is either serverless or pay-per-use (DynamoDB on-demand,
Lambda, API Gateway, S3/CloudFront, Polly), so idle time between class demo
sessions costs close to nothing. Polly's free tier (5M characters/month for
12 months) comfortably covers development and testing. Bedrock is pay-per-call
with no free tier, but Nova Micro is priced in fractions of a cent per
1,000 tokens and each classify-intent call sends only a short prompt with a
16-token response cap — thousands of coach questions cost cents, not dollars.
Run `npx cdk destroy` when you're done with a milestone to avoid any
lingering charges.

## What's not here yet

- The actual Singapore Mahjong rules engine (tile legality, scoring) — see
  `applyAction` in `lambda/gameAction.ts`
- The client app (React Native / React web) from proposal section 6
- CI/CD for automatic deploys
- A dedicated dev/staging/prod pipeline (currently one `envName` context
  value, defaulting to `dev`, e.g. `npx cdk deploy -c envName=staging`)
