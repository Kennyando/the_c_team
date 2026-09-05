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
```

## Help-coach fallback classifier

`lambda/classifyIntent.ts` backs the frontend help coach's `askWithModel()`
(`frontend/src/game/coach.js`). The coach is otherwise fully local — no
network, no API key (see `frontend/docs`) — and stays that way for every
question its own keyword patterns recognise. Only when a typed question
matches none of them does the frontend POST it to this route.

This is deliberately a plain HTTP API (`CoachApi`), not a new WebSocket
route: classifying one string needs no room, no connection, no game state,
so it would be pure overhead to require joining a multiplayer session just
to ask for help.

The Lambda calls Amazon Bedrock (`amazon.nova-micro-v1:0` by default — cheap
and fast, right-sized for a one-word classification task) with the coach's
own current list of intent ids and a one-line hint for each, and asks it to
return exactly one of those ids, or `fallback`. **The model never writes
what the player reads** — it only picks which of the coach's existing,
locally-computed answer functions to call, so none of the accuracy
guarantees in `docs/mvp-notes.md` (correct by construction, aware of this
table's own house rules) are weakened. Any failure — Bedrock unavailable,
model access not granted, a timeout, an id we don't recognise — is treated
identically to "no match" and the coach's own local fallback answer is used
instead; the coach never breaks, and works with zero backend deployed at
all if `frontend/.env.template`'s `VITE_CLASSIFY_INTENT_URL` is left blank.

Swap the model with `npx cdk deploy -c bedrockModelId=<another Bedrock model id>`
if your account's model access differs (e.g. an Anthropic Claude Haiku model
on Bedrock instead of Nova Micro).

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

# Deploy to your default AWS region (defaults to ap-southeast-1 / Singapore
# if CDK_DEFAULT_REGION isn't set — see bin/app.ts)
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
