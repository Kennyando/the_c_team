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
   already graded against `advisor.js` when each move was made. The restatement itself lives in
   `frontend/src/game/reviewCore.js` and is re-exported here through `@kaki/game`, so the
   frontend's offline review and this package's fallback build facts from one implementation
   (pinned by `test/contract.test.js`).
2. **One model call** (`src/model.js` — the *only* place a model is invoked) turns those facts
   into warm, plain sentences. It never computes anything; the facts are the analysis. This is
   the same guarantee `backend/lambda/classifyIntent.ts` gives: the model never writes the
   authoritative content.
3. **Validate** against `src/schema.js` (shape), then against the facts (grounding): a reply that
   lists more "improve" notes than there were sub-optimal moves, or more "well played" notes than
   there were optimal ones, isn't grounded in the decision log and is discarded. Anything that
   doesn't fit — wrong type, too long, ungrounded, model errored, no model configured — falls to:
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
| `AGENT_MODEL_ID` | falls back to `BEDROCK_MODEL_ID`, then `amazon.nova-micro-v1:0` | cheapest Bedrock text model; swap to `amazon.nova-lite-v1:0` or `anthropic.claude-haiku-4-5` if review prose is too stiff |
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

- **Grounding is count-based, not per-item.** The guard checks the model didn't produce *more*
  notes than the facts support; it doesn't yet verify each individual note maps to a specific
  decision whose engine-grade backs that classification. A stronger version would have review
  items carry a `decisionId` and validate each one against the graded decision it points at.
- **`state.decisions` records no `advisorVersion`.** The review trusts the grade captured when
  each move was made — correct, but `advisor.js` keeps evolving (value-aware scoring, ukeire,
  future tuning). Once decisions persist across sessions (Phase 3+), decision records should
  stamp which evaluator produced them. That's an `engine.js` change, out of scope for this
  consumer.

## Adding the next agent

1. `src/context/<thing>Context.js` — the pure ground-truth builder.
2. `src/<agent>/prompt.js`, `src/<agent>/deterministic.js`, `src/<agent>/<agent>.js` (the pipeline).
3. Extend `src/schema.js` with the new result shape + validator.
4. Export the entry point from `src/index.js`.
5. A thin `backend/lambda/<agent>.ts` + a route on `CoachApi`, copying the classify-intent block.
