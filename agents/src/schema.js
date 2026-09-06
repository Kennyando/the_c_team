// The shape the model must return, and a strict check for it.
//
// The model returns each review bullet as { ref, text }: `ref` names the decision the bullet is
// about, so runReview() can hold every bullet to that decision's own grade (per-item grounding).
// Anything that doesn't fit this shape — wrong type, missing field, over-long, a bare string
// where a { ref, text } was required — is thrown away and the deterministic, model-free review
// is used instead. Same "never trust the model's raw output" stance as
// backend/lambda/classifyIntent.ts with its intent id.

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

// The MODEL is required to return each bullet as { ref, text } — `ref` names the decision the
// bullet is about, so runReview() can check it against that decision's own grade (per-item
// grounding). `ref` ids look like "d0".."d99"; 16 chars is generous headroom.
const isRefBullet = (b) =>
  !!b && typeof b === 'object' &&
  typeof b.ref === 'string' && b.ref.length > 0 && b.ref.length <= 16 &&
  isShortString(b.text, MAX_BULLET);
const isRefBulletList = (v) =>
  Array.isArray(v) && v.length <= MAX_BULLETS && v.every(isRefBullet);

/**
 * True for the shape the model must return: {ref, text} bullets, not bare strings.
 *
 * `oneThingToTry` is looser here — a {ref, text} bullet OR a plain string — because whether it
 * must be grounded depends on the facts (a clean hand has no [improve] fact to cite). runReview()
 * has the facts and does that check; this is shape only. Never throws.
 */
export function isModelReviewShape(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    isShortString(value.headline, MAX_HEADLINE) &&
    isRefBulletList(value.goodMoves) &&
    isRefBulletList(value.improvements) &&
    (isRefBullet(value.oneThingToTry) || isShortString(value.oneThingToTry, MAX_BULLET))
  );
}

/**
 * Turn a grounded model reply ({ref, text} bullets) into a clean final ReviewResult — drops the
 * refs (they've done their job in validation; surfacing them to the UI is a later step), keeps
 * the text, trims, and caps each list at MAX_BULLETS. `oneThingToTry` may arrive as a {ref, text}
 * bullet or an already-resolved string. Assumes isModelReviewShape(raw) passed.
 */
export function normalizeReviewResult(raw, { modelAssisted }) {
  const texts = (list) => list.slice(0, MAX_BULLETS).map((b) => b.text.trim());
  const focus = raw.oneThingToTry;
  return {
    headline: raw.headline.trim(),
    goodMoves: texts(raw.goodMoves),
    improvements: texts(raw.improvements),
    oneThingToTry: (typeof focus === 'string' ? focus : focus.text).trim(),
    modelAssisted,
  };
}
