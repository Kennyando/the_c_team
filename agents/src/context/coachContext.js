// The facts the coach agent answers from: the live position as structured, typed objects, each
// with a stable id (`f0`, `f1`, …).
//
// The objects — not any English text — are the canonical evidence. `renderFact()` turns one into
// a beginner-friendly sentence, and `buildUserPrompt()` calls it when assembling the prompt, so
// the wording can change without touching what a model answer is allowed to cite. Keeping the
// data structured also lets `runCoachAnswer()` check citations against real fields (today just
// "the id exists"; a rule-set check on scoring claims is the next step — see docs/mvp-notes.md
// #7).
//
// Like decisionContext.js, this makes no judgement of its own — it runs the same `advisor.js`
// primitives the frontend's local coach uses, all of which grade against this table's house
// rules. Input is untrusted (it arrives over HTTP as a `position` subset the browser serialized),
// so `rebuildState()` guards every field. Opponent hands are never sent and never needed:
// `contextFor()` reads the deciding player's hand plus every seat's *exposed* melds/bonus and the
// discards.

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
const wind = (w) => WIND_NAMES[w] || w;

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
 * @returns {{ facts: import('../../types/index.d.ts').CoachFact[], phase: string, yourTurn: boolean, wallCount: number }}
 */
export function coachContext(position) {
  const state = rebuildState(position);
  const you = state.players[0];

  const facts = [];
  const add = (type, data) => facts.push({ id: `f${facts.length}`, type, ...data });

  const rules = rulesContext(state.rules);
  add('rules', { active: rules.active, limit: rules.limit });

  add('seat', {
    seatWind: seatWindOf(0, state.dealer),
    dealer: state.dealer === 0,
    prevailingWind: state.prevailingWind,
  });

  add('wall', { count: state.wall.length });

  const yourTurn = state.phase === 'act' && state.turn === 0;
  const inClaim = state.phase === 'claim' && state.claimOptions.length > 0 && !!state.pending;

  if (you.hand.length) {
    add('distance', { shanten: shanten(you.hand, you.melds) });
    const ready = waits(you);
    if (ready.length) add('waits', { tiles: ready });
  }

  if (yourTurn && you.hand.length) {
    const advice = bestDiscard(you, contextFor(state, you));
    add('discardPick', {
      tile: advice.tile,
      shantenAfter: advice.shantenAfter,
      reason: advice.reasons[0] ?? null,
      alternatives: advice.alternatives,
    });
  }

  if (inClaim) {
    // Every legal claim, not just the first — one discard can offer several (e.g. two or three
    // chow shapes) and they get different advice.
    for (const claim of state.claimOptions) {
      const advice = claimAdvice(you, claim, state.pending.tile);
      add('claimOption', {
        claimType: claim.type,
        tiles: Array.isArray(claim.tiles) ? claim.tiles : [],
        onTile: state.pending.tile,
        verdict: advice.verdict,
        advice: advice.lines[0],
      });
    }
  }

  const summary = handSummary(you, state);
  if (summary.best) {
    add('handValue', {
      tile: summary.best.tile,
      tai: summary.best.score.tai,
      points: summary.best.score.points,
      pattern: summary.best.score.items?.[0]?.name ?? null,
      limited: !!summary.best.score.limited,
    });
  }

  return { facts, phase: state.phase, yourTurn, wallCount: state.wall.length };
}

/**
 * Render one structured fact as a beginner-friendly sentence for the prompt. Pure; the inverse
 * of what `coachContext()` builds. An unknown type renders as `''` — `buildUserPrompt` would
 * then emit a bare id, which the "every fact renders" test guards against.
 *
 * @param {import('../../types/index.d.ts').CoachFact} f
 * @returns {string}
 */
export function renderFact(f) {
  switch (f.type) {
    case 'rules':
      return f.active.length
        ? `This table scores: ${f.active.join('; ')}. Limit ${f.limit} tai.`
        : `This table is playing a plain game with a ${f.limit} tai limit.`;
    case 'seat':
      return (
        `You sit ${wind(f.seatWind)}${f.dealer ? ' and you are the dealer' : ''}. ` +
        `The prevailing wind is ${wind(f.prevailingWind)}.`
      );
    case 'wall':
      return `${f.count} tiles are left in the wall.`;
    case 'distance':
      return `Your hand is ${describeDistance(f.shanten)}.`;
    case 'waits':
      return `You are waiting on ${f.tiles.map(tileName).join(' or ')}.`;
    case 'discardPick': {
      const why = f.reason ? ` ${f.reason}` : '';
      const alt = f.alternatives.length
        ? ` ${f.alternatives.map(tileName).join(' and ')} would be just as good.`
        : '';
      return (
        `The coach would discard ${tileName(f.tile)} — it leaves you ` +
        `${describeDistance(f.shantenAfter)}.${why}${alt}`
      );
    }
    case 'claimOption': {
      const shape = f.tiles.length ? ` (${f.tiles.map(tileName).join('-')})` : '';
      return `A ${f.claimType} on ${tileName(f.onTile)}${shape} is on offer. The coach says: ${f.advice}`;
    }
    case 'handValue': {
      const from = f.pattern ? ` from ${f.pattern.toLowerCase()}` : '';
      const cap = f.limited ? ' (capped at the table limit)' : '';
      return `If you win on ${tileName(f.tile)} it scores ${f.tai} tai (pays ${f.points})${from}${cap}.`;
    }
    default:
      return '';
  }
}
