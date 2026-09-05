// Post-hand review: a short, encouraging walk-through of the discards and calls you just made.
//
// The model-free assembly lives in reviewCore.js and is shared with the backend agent's fallback
// path (agents/src/review/deterministic.js re-imports it via @kaki/game), so the two can't drift.
// This file is only the frontend network layer on top of it: mirrors coach.js — fully useful with
// no backend, and reaches for the network only when a URL is configured.

import { assembleReview } from './reviewCore.js';

export { assembleReview, decisionFacts } from './reviewCore.js';

/** Build a review from `state.decisions` with no model. Always returns a well-formed result. */
export function localReview(decisions, rules) {
  return assembleReview(decisions, rules);
}

const REVIEW_URL = import.meta.env?.VITE_REVIEW_URL;
const REVIEW_TIMEOUT_MS = 6000;

/**
 * The review for a finished hand. POSTs `{ decisions, rules }` to the backend review agent when
 * VITE_REVIEW_URL is set; on no URL, a non-2xx response, a timeout or any error, returns
 * `localReview()` instead. Never throws.
 *
 * `reviewUrl` defaults to the configured endpoint and only needs overriding in tests.
 */
export async function postHandReview(decisions, rules, { reviewUrl = REVIEW_URL } = {}) {
  const local = () => assembleReview(decisions, rules);
  if (!reviewUrl) return local();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);
  try {
    const res = await fetch(reviewUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions, rules }),
      signal: controller.signal,
    });
    if (!res.ok) return local();
    const data = await res.json();
    return isWellFormed(data?.review) ? data.review : local();
  } catch {
    return local();
  } finally {
    clearTimeout(timer);
  }
}

function isWellFormed(r) {
  return (
    !!r &&
    typeof r.headline === 'string' &&
    Array.isArray(r.goodMoves) &&
    Array.isArray(r.improvements) &&
    typeof r.oneThingToTry === 'string'
  );
}
