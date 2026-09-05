// The shape every review result must have, and a strict check for it.
//
// The model is asked to return exactly this JSON. If what comes back doesn't fit — wrong type,
// missing field, over-long, extra keys we then ignore — the caller throws it away and uses the
// deterministic, model-free review instead. This is the same "never trust the model's raw output"
// stance backend/lambda/classifyIntent.ts takes with its intent id.

export const MAX_HEADLINE = 120;
export const MAX_BULLET = 160;
export const MAX_BULLETS = 4;

/**
 * A finished review.
 * @typedef {Object} ReviewResult
 * @property {string}   headline        One warm sentence summing the hand up.
 * @property {string[]} goodMoves       Up to 4 short "you did this well" notes. May be empty.
 * @property {string[]} improvements    Up to 4 short "next time, try this" notes. May be empty.
 * @property {string}   oneThingToTry   A single concrete focus for the next hand.
 * @property {boolean}  modelAssisted   true if a model phrased it, false if it's the deterministic fallback.
 */

const isShortString = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isBulletList = (v) =>
  Array.isArray(v) && v.length <= MAX_BULLETS && v.every((b) => isShortString(b, MAX_BULLET));

/** True only for a well-formed ReviewResult. Never throws. */
export function isReviewResult(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    isShortString(value.headline, MAX_HEADLINE) &&
    isBulletList(value.goodMoves) &&
    isBulletList(value.improvements) &&
    isShortString(value.oneThingToTry, MAX_BULLET)
  );
}

/**
 * Coerce a raw parsed object into a clean ReviewResult, keeping only the known fields and
 * trimming each list to MAX_BULLETS. Assumes `isReviewResult(raw)` already passed.
 */
export function normalizeReviewResult(raw, { modelAssisted }) {
  return {
    headline: raw.headline.trim(),
    goodMoves: raw.goodMoves.slice(0, MAX_BULLETS).map((b) => b.trim()),
    improvements: raw.improvements.slice(0, MAX_BULLETS).map((b) => b.trim()),
    oneThingToTry: raw.oneThingToTry.trim(),
    modelAssisted,
  };
}
