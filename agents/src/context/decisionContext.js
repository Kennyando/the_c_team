// The facts the review agent works from: `state.decisions` restated as plain-English lines.
//
// This is the one implementation, shared with the frontend's offline review — it lives in
// frontend/src/game/reviewCore.js and reaches here through the `@kaki/game` barrel. Kept exported
// under the name `decisionContext` so the prompt builder and reviewHand.js don't need to change.
//
// It does no re-simulation and makes no judgement of its own: every entry in `state.decisions`
// was already graded against advisor.js's `bestDiscard` / `claimAdvice` when the human made the
// move (frontend/src/game/engine.js). Input is untrusted (arrives over HTTP) and guarded there.

export { decisionFacts as decisionContext } from '@kaki/game';
