// The facts the coach agent answers from: the live position restated as plain-English lines,
// each with a stable id (`f0`, `f1`, …).
//
// Like decisionContext.js, this makes no judgement of its own — it runs the same `advisor.js`
// primitives the frontend's local coach already uses (tile efficiency, hand distance, hand
// value, claim advice), all of which grade against this table's own house rules. The model that
// consumes these lines phrases an answer and must cite, per line, the fact ids it rests on;
// `runCoachAnswer()` drops any answer whose citations don't resolve to a fact built here.
//
// Input is untrusted — it arrives over HTTP as a `position` subset the browser serialized — so
// `rebuildState()` guards every field and hands `advisor.js` a well-formed `state`-shaped object
// with sensible defaults. Opponent hands are never sent and never needed: `contextFor()` only
// reads the deciding player's hand plus every seat's *exposed* melds/bonus and the discards.

import {
  contextFor,
  bestDiscard,
  claimAdvice,
  handSummary,
  shanten,
  waits,
  describeDistance,
  seatWindOf,
  tileName,
} from '@kaki/game';

import { rulesContext } from './rulesContext.js';

const WIND_NAMES = { we: 'East', ws: 'South', ww: 'West', wn: 'North' };

const arr = (v) => (Array.isArray(v) ? v : []);
const seatOf = (lists, i) => (Array.isArray(lists[i]) ? lists[i] : []);

/**
 * Rebuild a minimal `state`-shaped object from the serialized `position`. Every field is
 * defaulted so `advisor.js` can never throw on a malformed payload.
 */
function rebuildState(position) {
  const p = position && typeof position === 'object' ? position : {};
  const melds = arr(p.melds);
  const bonus = arr(p.bonus);

  const players = [0, 1, 2, 3].map((seat) => ({
    seat,
    name: seat === 0 ? 'You' : `Seat ${seat}`,
    // Only the local player's concealed hand is known; opponents' hands are unknown and unused.
    hand: seat === 0 ? arr(p.hand) : [],
    melds: seatOf(melds, seat),
    bonus: seatOf(bonus, seat),
    points: 0,
  }));

  const wallCount = Number.isInteger(p.wallCount) && p.wallCount >= 0 ? p.wallCount : 0;

  return {
    players,
    dealer: Number.isInteger(p.dealer) ? p.dealer : 0,
    turn: Number.isInteger(p.turn) ? p.turn : 0,
    phase: typeof p.phase === 'string' ? p.phase : 'act',
    prevailingWind: typeof p.prevailingWind === 'string' ? p.prevailingWind : 'we',
    rules: p.rules && typeof p.rules === 'object' ? p.rules : {},
    discards: arr(p.discards).filter((d) => d && typeof d === 'object'),
    wall: new Array(wallCount),
    claimOptions: arr(p.claimOptions),
    pending: p.pending && typeof p.pending === 'object' ? p.pending : null,
  };
}

/**
 * @param {Object} position  the browser's serialized `state` subset (see frontend serializePosition)
 * @returns {{ facts: {id:string,text:string}[], phase: string, yourTurn: boolean, wallCount: number }}
 */
export function coachContext(position) {
  const state = rebuildState(position);
  const you = state.players[0];

  const facts = [];
  const fact = (text) => facts.push({ id: `f${facts.length}`, text });

  fact(rulesContext(state.rules).line);

  const seatWind = seatWindOf(0, state.dealer);
  fact(
    `You sit ${WIND_NAMES[seatWind] || seatWind}${state.dealer === 0 ? ' and you are the dealer' : ''}. ` +
      `The prevailing wind is ${WIND_NAMES[state.prevailingWind] || state.prevailingWind}.`,
  );
  fact(`${state.wall.length} tiles are left in the wall.`);

  const yourTurn = state.phase === 'act' && state.turn === 0;
  const inClaim = state.phase === 'claim' && state.claimOptions.length > 0 && !!state.pending;

  if (you.hand.length) {
    fact(`Your hand is ${describeDistance(shanten(you.hand, you.melds))}.`);
    const ready = waits(you);
    if (ready.length) fact(`You are waiting on ${ready.map(tileName).join(' or ')}.`);
  }

  if (yourTurn && you.hand.length) {
    const advice = bestDiscard(you, contextFor(state, you));
    const why = advice.reasons[0] ? ` ${advice.reasons[0]}` : '';
    fact(
      `The coach would discard ${tileName(advice.tile)} — it leaves you ` +
        `${describeDistance(advice.shantenAfter)}.${why}`,
    );
    if (advice.alternatives.length) {
      fact(`${advice.alternatives.map(tileName).join(' and ')} would be just as good.`);
    }
  }

  if (inClaim) {
    // Every legal claim, not just the first — one discard can offer several (e.g. two or three
    // chow shapes) and they get different advice. "Which chow should I take?" needs them all.
    const tile = tileName(state.pending.tile);
    for (const claim of state.claimOptions) {
      const advice = claimAdvice(you, claim, state.pending.tile);
      const shape = claim.tiles && claim.tiles.length ? ` (${claim.tiles.map(tileName).join('-')})` : '';
      fact(`A ${claim.type} on ${tile}${shape} is on offer. The coach says: ${advice.lines[0]}`);
    }
  }

  const summary = handSummary(you, state);
  if (summary.best) {
    const from = summary.best.score.items?.[0]
      ? ` from ${summary.best.score.items[0].name.toLowerCase()}`
      : '';
    fact(
      `If you win on ${tileName(summary.best.tile)} it scores ${summary.best.score.tai} tai ` +
        `(pays ${summary.best.score.points})${from}.`,
    );
  }

  return { facts, phase: state.phase, yourTurn, wallCount: state.wall.length };
}
