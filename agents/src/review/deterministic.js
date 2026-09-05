// The review you get with no model in the loop: a plain assembly of the facts decisionContext
// produced. This is both the offline default (frontend has no VITE_REVIEW_URL configured) and the
// guaranteed fallback whenever the model call fails or returns something malformed — so a review
// panel always has something correct to show, exactly the way the help coach always has a local
// answer.

import { normalizeReviewResult, MAX_BULLETS } from '../schema.js';

/**
 * @param {ReturnType<import('../context/decisionContext.js').decisionContext>} ctx
 * @returns {import('../schema.js').ReviewResult}
 */
export function deterministicReview(ctx) {
  const { total, optimalCount, mistakes, facts } = ctx;

  if (total === 0) {
    return normalizeReviewResult(
      {
        headline: 'No decisions to review from that hand.',
        goodMoves: [],
        improvements: [],
        oneThingToTry: 'Play a full hand and I can walk you through your discards and calls.',
      },
      { modelAssisted: false },
    );
  }

  const good = facts.filter((f) => f.wasOptimal).slice(0, MAX_BULLETS).map((f) => f.text);
  const improvements = mistakes.slice(0, MAX_BULLETS).map((f) => f.text);

  const headline =
    mistakes.length === 0
      ? `Clean hand — all ${total} of your decisions matched the coach.`
      : `${optimalCount} of ${total} decisions matched the coach; ${mistakes.length} to look at.`;

  const oneThingToTry =
    mistakes.length === 0
      ? 'Keep doing what you did — try it again on the next hand.'
      : mistakes[0].type === 'discard'
        ? 'Before discarding, check which tile keeps the most ways to finish your hand.'
        : 'Before calling, ask whether the call actually brings your hand closer to winning.';

  return normalizeReviewResult(
    { headline, goodMoves: good, improvements, oneThingToTry },
    { modelAssisted: false },
  );
}
