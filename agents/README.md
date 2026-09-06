# @kaki/agents — AI agent framework

How AI agents plug into Kaki Mahjong. One agent is built today (post-hand **Review**); the
structure is sized so the next two (a richer coach, a thinking-bot opponent) drop in without a
rewrite.

## The shape every agent has

```
deterministic context  ─►  one model call  ─►  parse + strict validate  ─►  result
      (ground truth)            (tone only)                │
                                                          └─► deterministic result  (on ANY failure)
```

1. **Context builders** (`src/context/`) run first. They are pure functions over game data — no
   model, no judgement of their own. For Review they restate `state.decisions`, which the engine
   already graded against `advisor.js` when each move was made. Each fact carries a stable id
   (`d0`, `d1`, …). The restatement lives in `frontend/src/game/reviewCore.js` and is re-exported
   here through `@kaki/game`, so the frontend's offline review and this package's fallback build
   facts from one implementation (pinned by `test/contract.test.js`).
2. **One model call** (`src/model.js` — the *only* place a model is invoked) turns those facts
   into warm, plain sentences. It is required to return each bullet as `{ ref, text }` — `ref`
   naming the fact the bullet is about. It never computes anything; the facts are the analysis.
3. **Validate** — shape (`src/schema.js`: is it `{ ref, text }` bullets, within length caps?),
   then **per-item grounding** in `runReview()`: for every bullet, `ref` must name a real fact,
   that fact's own grade must match the bullet's bucket (a "well played" bullet on a decision the
   engine graded sub-optimal — or the reverse — is not grounded), and no fact may be cited twice.
   Any bullet that fails, or any shape/parse/model error, falls to:
4. **Deterministic fallback** (`src/review/deterministic.js` → `assembleReview` from `@kaki/game`)
   assembles the same facts with no model. It is both the offline default and the guaranteed
   floor, so a caller always gets a well-formed result, and it is byte-identical to the frontend's
   offline path.

## Why not LangGraph.js (yet)

The three planned flows (review / strategy / coach) are today linear: build context → phrase →
return. No branching, no cycles, no human-in-the-loop interrupts — nothing LangGraph exists to
manage. It would add a heavy dependency to every Lambda bundle for no behaviour we need. The
directory layout here (`context/`, `review/`, `memory/`, and room for `graph/`, `nodes/`,
`tools/`) is deliberately LangGraph-shaped, so when a flow genuinely needs a graph, it slots in
without moving files.

## Model & cost

`src/model.js` calls Bedrock's **Converse** API, which is model-agnostic. The model is one env
var:

| Var | Default | Notes |
|---|---|---|
| `AGENT_MODEL_ID` | `us.amazon.nova-lite-v1:0` (US cross-region inference profile) | Chosen over Micro after a comparison run: Micro contradicts itself and an 8B model inverts the graded facts; Lite stays coherent, still cents per thousand reviews. Match the prefix to the region (`us.` / `eu.` / `apac.`). Override for a smaller/bigger model as needed. |
| `BEDROCK_REGION` / `AWS_REGION` | — | region for the Bedrock client |

`callModel()` uses a low temperature and a tight `maxTokens`, does not retry, and does not fan
out. The review runs at most once per hand.

## Memory

`src/memory/memory.js` is an interface (`load` / `save`) with a **no-op implementation**.
Per-player memory needs accounts, which the app doesn't have yet (Phase 3+). A DynamoDB-backed
implementation later fills in the same two methods; nothing upstream changes.

## Using it

```js
import { runReview } from '@kaki/agents';

const review = await runReview({ decisions: state.decisions, rules: state.rules });
// -> { headline, goodMoves[], improvements[], oneThingToTry, modelAssisted }
```

Deployed as `backend/lambda/reviewHand.ts` on the existing `CoachApi` HTTP API (same throttle,
reserved concurrency, Bedrock IAM scoping, budget and 5xx alarm as classify-intent). The frontend
calls it at end of hand only when `VITE_REVIEW_URL` is set; unset, it uses the deterministic
review locally and makes no network call.

## Tests

```bash
npm install
npm test        # node:test, Bedrock mocked — no AWS calls, no cost
```

`test/contract.test.js` is the important one: it feeds the same decision logs through the
frontend's `localReview()` and this package's `deterministicReview()` and asserts identical
output, so the two model-free paths can never drift.

## Known limits / follow-ups

- **Grounding refs are validated but not surfaced.** Each model bullet carries a `ref` to the
  decision it's about and `runReview()` holds it to that decision's grade — but the `ref` is
  dropped before the result reaches the frontend. Passing it through would let `HandReview.jsx`
  link a bullet to its tile / turn on the table.
- **`advisorVersion` is stamped but not yet consumed.** Every decision record now carries
  `advisorVersion` (`ADVISOR_VERSION` in `frontend/src/game/advisor.js`), so a review of stored
  history can tell which grader produced its `optimal`/`recommended` fields. Nothing reads it yet
  — within one in-memory session every decision shares one version. Once decisions persist across
  sessions (Phase 3+), the review should flag or down-weight a grade from an older evaluator.

## Adding the next agent

1. `src/context/<thing>Context.js` — the pure ground-truth builder.
2. `src/<agent>/prompt.js`, `src/<agent>/deterministic.js`, `src/<agent>/<agent>.js` (the pipeline).
3. Extend `src/schema.js` with the new result shape + validator.
4. Export the entry point from `src/index.js`.
5. A thin `backend/lambda/<agent>.ts` + a route on `CoachApi`, copying the classify-intent block.
