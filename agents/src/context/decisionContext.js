// Turn the engine's `state.decisions` log into a short list of plain-English facts.
//
// This is the "tool" the review agent runs BEFORE any model call: it does no re-simulation and
// makes no judgement of its own — every entry in `state.decisions` was already graded against
// advisor.js's `bestDiscard` / `claimAdvice` when the human made the move (see
// frontend/src/game/engine.js `recordDiscardDecision` / `recordClaimDecision`). Here we only
// restate those facts in words the model (or the deterministic fallback) can phrase for a player.
//
// Input arrives over HTTP, so every field is treated as untrusted and guarded.

import { tileName, describeDistance } from '@kaki/game';

const isTile = (t) => typeof t === 'string' && t.length > 0 && t.length <= 3;
const name = (t) => (isTile(t) ? tileName(t) : 'a tile');
const claimType = (c) => (c && typeof c.type === 'string' ? c.type : null);

function discardFact(d, index) {
  const chosen = name(d.chosen);
  if (d.optimal === true) {
    return { index, type: 'discard', wasOptimal: true, text: `Discarded ${chosen} — the tile the coach would have picked.` };
  }
  const better = name(d.recommended);
  const afterChosen =
    typeof d.shantenAfterChosen === 'number' ? describeDistance(d.shantenAfterChosen) : null;
  const afterBetter =
    typeof d.shantenAfterRecommended === 'number' ? describeDistance(d.shantenAfterRecommended) : null;
  const why = Array.isArray(d.reasons) && typeof d.reasons[0] === 'string' ? ` ${d.reasons[0]}` : '';
  const compare =
    afterChosen && afterBetter && afterChosen !== afterBetter
      ? ` It left you ${afterChosen}; ${better} would have left you ${afterBetter}.`
      : '';
  return {
    index,
    type: 'discard',
    wasOptimal: false,
    text: `Discarded ${chosen}; ${better} was the stronger discard.${compare}${why}`,
  };
}

function claimFact(c, index) {
  const tile = name(c.pendingTile);
  const took = claimType(c.chosen);
  const shouldHave = claimType(c.recommended);

  if (c.optimal === true) {
    const did = took ? `Called ${took} on ${tile}` : `Let ${tile} go`;
    return { index, type: 'claim', wasOptimal: true, text: `${did} — the right call.` };
  }
  if (took && !shouldHave) {
    return { index, type: 'claim', wasOptimal: false, text: `Called ${took} on ${tile}, but passing was better — it did not bring the hand closer.` };
  }
  if (!took && shouldHave) {
    return { index, type: 'claim', wasOptimal: false, text: `Passed on ${tile}; calling ${shouldHave} would have moved the hand forward.` };
  }
  return { index, type: 'claim', wasOptimal: false, text: `The call on ${tile} could have gone better.` };
}

/**
 * @param {Array} decisions  the raw `state.decisions` array
 * @returns {{ total:number, optimalCount:number, discardCount:number, claimCount:number,
 *            facts:Array<{index:number,type:string,wasOptimal:boolean,text:string}>,
 *            mistakes:Array }}
 */
export function decisionContext(decisions) {
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
