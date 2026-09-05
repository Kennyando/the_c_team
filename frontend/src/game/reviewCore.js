// The model-free post-hand review, as one pure implementation.
//
// Both entry points to the review use this and only this:
//   - the frontend's offline path      (review.js `localReview()`, when no VITE_REVIEW_URL)
//   - the backend agent's fallback path (agents/src/review/deterministic.js, when the model call
//     fails or returns something malformed)
// so identical game history can never produce different coaching based on deployment / network /
// model availability. The backend imports this via the `@kaki/game` barrel; nothing here touches
// React, `import.meta`, or the AWS SDK, so it bundles cleanly on both sides.
//
// Every fact comes straight from `state.decisions`, which engine.js already graded against
// advisor.js's `bestDiscard` / `claimAdvice` when each move was made — nothing is recomputed.

import { tileName } from './tiles.js';
import { describeDistance } from './advisor.js';

export const MAX_REVIEW_BULLETS = 4;

const nameOf = (t) => (typeof t === 'string' && t.length > 0 && t.length <= 3 ? tileName(t) : 'a tile');
const claimType = (c) => (c && typeof c.type === 'string' ? c.type : null);

function discardFact(d, index) {
  const chosen = nameOf(d.chosen);
  if (d.optimal === true) {
    return { index, type: 'discard', wasOptimal: true, text: `Discarded ${chosen} — the tile the coach would have picked.` };
  }
  const better = nameOf(d.recommended);
  const cmp =
    typeof d.shantenAfterChosen === 'number' &&
    typeof d.shantenAfterRecommended === 'number' &&
    d.shantenAfterChosen !== d.shantenAfterRecommended
      ? ` It left you ${describeDistance(d.shantenAfterChosen)}; ${better} would have left you ${describeDistance(d.shantenAfterRecommended)}.`
      : '';
  const why = Array.isArray(d.reasons) && typeof d.reasons[0] === 'string' ? ` ${d.reasons[0]}` : '';
  return { index, type: 'discard', wasOptimal: false, text: `Discarded ${chosen}; ${better} was the stronger discard.${cmp}${why}` };
}

function claimFact(c, index) {
  const tile = nameOf(c.pendingTile);
  const took = claimType(c.chosen);
  const wanted = claimType(c.recommended);
  if (c.optimal === true) {
    return { index, type: 'claim', wasOptimal: true, text: took ? `Called ${took} on ${tile} — the right call.` : `Let ${tile} go — the right call.` };
  }
  if (took && !wanted) return { index, type: 'claim', wasOptimal: false, text: `Called ${took} on ${tile}, but passing was better — it did not bring your hand closer.` };
  if (!took && wanted) return { index, type: 'claim', wasOptimal: false, text: `Passed on ${tile}; calling ${wanted} would have moved your hand forward.` };
  return { index, type: 'claim', wasOptimal: false, text: `The call on ${tile} could have gone better.` };
}

/**
 * Restate `state.decisions` as plain-English facts. Input is untrusted (it arrives over HTTP on
 * the backend), so non-object / unknown-type entries are dropped rather than trusted.
 *
 * @returns {{ total:number, optimalCount:number, discardCount:number, claimCount:number,
 *            facts:Array<{index:number,type:'discard'|'claim',wasOptimal:boolean,text:string}>,
 *            mistakes:Array }}
 */
export function decisionFacts(decisions) {
  const list = Array.isArray(decisions) ? decisions : [];
  const facts = list
    .map((d, i) => {
      if (!d || typeof d !== 'object') return null;
      if (d.type === 'discard') return discardFact(d, i);
      if (d.type === 'claim') return claimFact(d, i);
      return null;
    })
    .filter(Boolean);

  const mistakes = facts.filter((f) => !f.wasOptimal);
  return {
    total: facts.length,
    optimalCount: facts.length - mistakes.length,
    discardCount: facts.filter((f) => f.type === 'discard').length,
    claimCount: facts.filter((f) => f.type === 'claim').length,
    facts,
    mistakes,
  };
}

/**
 * Assemble the model-free review. `rules` is accepted for signature parity with the model path
 * (which passes it into the prompt); the plain-text assembly here doesn't need it.
 *
 * @returns {{ headline:string, goodMoves:string[], improvements:string[], oneThingToTry:string,
 *            modelAssisted:false }}
 */
export function assembleReview(decisions, rules) {
  void rules;
  const { total, optimalCount, facts, mistakes } = decisionFacts(decisions);

  if (total === 0) {
    return {
      headline: 'No decisions to review from that hand.',
      goodMoves: [],
      improvements: [],
      oneThingToTry: 'Play a full hand and I can walk you through your discards and calls.',
      modelAssisted: false,
    };
  }

  const goodMoves = facts.filter((f) => f.wasOptimal).slice(0, MAX_REVIEW_BULLETS).map((f) => f.text);
  const improvements = mistakes.slice(0, MAX_REVIEW_BULLETS).map((f) => f.text);

  const headline =
    mistakes.length === 0
      ? `Clean hand — all ${total} of your decisions matched the coach.`
      : `${optimalCount} of ${total} decisions matched the coach; ${mistakes.length} to look at.`;

  const oneThingToTry =
    mistakes.length === 0
      ? 'Keep doing what you did — try it again next hand.'
      : mistakes[0].type === 'discard'
        ? 'Before discarding, check which tile keeps the most ways to finish your hand.'
        : 'Before calling, ask whether the call actually brings your hand closer to winning.';

  return { headline, goodMoves, improvements, oneThingToTry, modelAssisted: false };
}
