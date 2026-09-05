// The review with no model in the loop.
//
// One implementation, shared with the frontend's offline path: `assembleReview` lives in
// frontend/src/game/reviewCore.js and reaches here through the `@kaki/game` barrel. This is both
// the offline default (no VITE_REVIEW_URL configured on the frontend) and the guaranteed fallback
// whenever the model call fails or returns something malformed — so a review panel always has
// something correct to show, the way the help coach always has a local answer.
//
// agents/test/contract.test.js pins this and the frontend's `localReview()` to byte-identical
// output for the same decision log, so the two paths can't silently drift.

export { assembleReview as deterministicReview } from '@kaki/game';
