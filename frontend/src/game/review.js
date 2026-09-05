// Post-hand review: a short, encouraging walk-through of the discards and calls you just made.
//
// Mirrors how the help coach works (coach.js): fully useful with no backend, and only reaches
// for the network when a URL is configured. `localReview()` here and
// `agents/src/review/deterministic.js` on the backend are deliberately kept shape-compatible —
// both return { headline, goodMoves[], improvements[], oneThingToTry } — so turning the model on
// or off never changes what the panel can render. The backend version lets a cheap model phrase
// the same facts more warmly; this version is the guaranteed floor and the offline default.
//
// Every fact here comes straight from `state.decisions`, which engine.js already graded against
// advisor.js's `bestDiscard` / `claimAdvice` when each move was made — nothing is recomputed.

import { tileName } from './tiles.js';
import { describeDistance } from './advisor.js';

const MAX_BULLETS = 4;
const nameOf = (t) => (typeof t === 'string' && t ? tileName(t) : 'a tile');

function factFor(d, i) {
  if (d?.type === 'discard') {
    if (d.optimal) return { i, optimal: true, type: 'discard', text: `Discarded ${nameOf(d.chosen)} — the tile the coach would have picked.` };
    const cmp =
      typeof d.shantenAfterChosen === 'number' &&
      typeof d.shantenAfterRecommended === 'number' &&
      d.shantenAfterChosen !== d.shantenAfterRecommended
        ? ` It left you ${describeDistance(d.shantenAfterChosen)}; ${nameOf(d.recommended)} would have left you ${describeDistance(d.shantenAfterRecommended)}.`
        : '';
    const why = Array.isArray(d.reasons) && d.reasons[0] ? ` ${d.reasons[0]}` : '';
    return { i, optimal: false, type: 'discard', text: `Discarded ${nameOf(d.chosen)}; ${nameOf(d.recommended)} was the stronger discard.${cmp}${why}` };
  }
  if (d?.type === 'claim') {
    const took = d.chosen?.type || null;
    const wanted = d.recommended?.type || null;
    if (d.optimal) {
      return { i, optimal: true, type: 'claim', text: took ? `Called ${took} on ${nameOf(d.pendingTile)} — the right call.` : `Let ${nameOf(d.pendingTile)} go — the right call.` };
    }
    if (took && !wanted) return { i, optimal: false, type: 'claim', text: `Called ${took} on ${nameOf(d.pendingTile)}, but passing was better — it did not bring your hand closer.` };
    if (!took && wanted) return { i, optimal: false, type: 'claim', text: `Passed on ${nameOf(d.pendingTile)}; calling ${wanted} would have moved your hand forward.` };
    return { i, optimal: false, type: 'claim', text: `The call on ${nameOf(d.pendingTile)} could have gone better.` };
  }
  return null;
}

/**
 * Build a review from `state.decisions` with no model. Always returns a well-formed result.
 * `rules` is accepted for signature parity with the backend agent (which passes it to the model
 * prompt); the plain-text assembly here doesn't need it.
 */
export function localReview(decisions, rules) {
  void rules;
  const facts = (Array.isArray(decisions) ? decisions : []).map(factFor).filter(Boolean);

  if (facts.length === 0) {
    return {
      headline: 'No decisions to review from that hand.',
      goodMoves: [],
      improvements: [],
      oneThingToTry: 'Play a full hand and I can walk you through your discards and calls.',
      modelAssisted: false,
    };
  }

  const mistakes = facts.filter((f) => !f.optimal);
  const goodMoves = facts.filter((f) => f.optimal).slice(0, MAX_BULLETS).map((f) => f.text);
  const improvements = mistakes.slice(0, MAX_BULLETS).map((f) => f.text);

  const headline =
    mistakes.length === 0
      ? `Clean hand — all ${facts.length} of your decisions matched the coach.`
      : `${facts.length - mistakes.length} of ${facts.length} decisions matched the coach; ${mistakes.length} to look at.`;

  const oneThingToTry =
    mistakes.length === 0
      ? 'Keep doing what you did — try it again next hand.'
      : mistakes[0].type === 'discard'
        ? 'Before discarding, check which tile keeps the most ways to finish your hand.'
        : 'Before calling, ask whether the call actually brings your hand closer to winning.';

  return { headline, goodMoves, improvements, oneThingToTry, modelAssisted: false };
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
  const local = () => localReview(decisions, rules);
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
