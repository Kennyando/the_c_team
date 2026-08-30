// Singapore ("tai") scoring.
//
// Proposal Section 5 stresses that Singapore scoring is "famously subject to table-to-table
// agreement", so every pattern below is individually switchable from the house-rules screen and the
// limit is configurable. These defaults are the set most commonly played locally.

import { WINDS, FLOWERS, SEASONS, isDragon, isHonour, isSuited, suitOf, tileName } from './tiles.js';
import { decompose } from './melds.js';

export const DEFAULT_RULES = {
  // Scoring patterns
  seatFlower: true,      // flower/season matching your seat wind — 1 tai each
  flowerSet: true,       // all four flowers or all four seasons — 2 tai
  dragonPong: true,      // pong/kong of a dragon — 1 tai each
  seatWind: true,        // pong/kong of your seat wind — 1 tai
  prevailingWind: true,  // pong/kong of the prevailing wind — 1 tai
  allChows: true,        // 平胡 — 1 tai
  allPungs: true,        // 对对胡 — 2 tai
  halfFlush: true,       // 混一色 — 2 tai
  fullFlush: true,       // 清一色 — 4 tai
  // Table conventions
  limit: 5,              // limit hand: tai are capped here
  discarderPaysAll: true,// on a discard win the discarder pays for everyone
  includeAnimals: false, // 148-tile set with the 4 animal tiles
};

export const RULE_LABELS = {
  seatFlower: 'Seat flower / season (1 tai each)',
  flowerSet: 'All four flowers or seasons (2 tai)',
  dragonPong: 'Dragon pong (1 tai each)',
  seatWind: 'Seat wind pong (1 tai)',
  prevailingWind: 'Prevailing wind pong (1 tai)',
  allChows: 'All chows 平胡 (1 tai)',
  allPungs: 'All pungs 对对胡 (2 tai)',
  halfFlush: 'Half flush 混一色 (2 tai)',
  fullFlush: 'Full flush 清一色 (4 tai)',
  discarderPaysAll: 'Discarder pays for all three',
  includeAnimals: 'Use 4 animal tiles (148-tile set)',
};

/** Points double with each tai: 0→1, 1→1, 2→2, 3→4, 4→8, 5→16. */
export function pointsForTai(tai) {
  return tai <= 1 ? 1 : 2 ** (tai - 1);
}

/** Your seat wind, relative to the dealer, who is always East. */
export function seatWindOf(seat, dealer) {
  return WINDS[(seat - dealer + 4) % 4];
}

function evaluate({ sets, pair, bonus, seatWind, prevailingWind, rules }) {
  const items = [];

  const seatIndex = WINDS.indexOf(seatWind) + 1;
  if (rules.seatFlower) {
    if (bonus.includes(`f${seatIndex}`)) items.push({ name: 'Seat flower', tai: 1 });
    if (bonus.includes(`s${seatIndex}`)) items.push({ name: 'Seat season', tai: 1 });
  }
  if (rules.flowerSet) {
    if (FLOWERS.every((f) => bonus.includes(f))) items.push({ name: 'All four flowers', tai: 2 });
    if (SEASONS.every((s) => bonus.includes(s))) items.push({ name: 'All four seasons', tai: 2 });
  }

  const pungs = sets.filter((s) => s.type === 'pong' || s.type === 'kong');
  for (const s of pungs) {
    const t = s.tiles[0];
    if (rules.dragonPong && isDragon(t)) items.push({ name: `${tileName(t)} pong`, tai: 1 });
    if (rules.seatWind && t === seatWind) items.push({ name: 'Seat wind pong', tai: 1 });
    if (rules.prevailingWind && t === prevailingWind) items.push({ name: 'Prevailing wind pong', tai: 1 });
  }

  if (rules.allPungs && pungs.length === 4) items.push({ name: 'All pungs 对对胡', tai: 2 });
  if (rules.allChows && sets.every((s) => s.type === 'chow')) items.push({ name: 'All chows 平胡', tai: 1 });

  const all = [...sets.flatMap((s) => s.tiles), pair, pair];
  const suits = new Set(all.filter(isSuited).map(suitOf));
  const hasHonour = all.some(isHonour);
  if (suits.size === 1 && !hasHonour && rules.fullFlush) {
    items.push({ name: 'Full flush 清一色', tai: 4 });
  } else if (suits.size === 1 && hasHonour && rules.halfFlush) {
    items.push({ name: 'Half flush 混一色', tai: 2 });
  }

  const raw = items.reduce((sum, i) => sum + i.tai, 0);
  return { items, raw };
}

/**
 * Score a winning hand.
 * `concealed` must already include the winning tile. Returns null if the hand does not win.
 */
export function scoreHand({ concealed, melds = [], bonus = [], seatWind, prevailingWind, rules }) {
  const readings = decompose(concealed, 4 - melds.length);
  if (readings.length === 0) return null;

  let best = null;
  for (const reading of readings) {
    const result = evaluate({
      sets: [...melds, ...reading.sets],
      pair: reading.pair,
      bonus,
      seatWind,
      prevailingWind,
      rules,
    });
    if (!best || result.raw > best.raw) best = result;
  }

  const limited = best.raw > rules.limit;
  const tai = limited ? rules.limit : best.raw;
  return { items: best.items, rawTai: best.raw, tai, limited, points: pointsForTai(tai) };
}

/**
 * Who pays what. Self-draw: all three losers pay. Discard win: the discarder covers all three
 * under the default house rule, otherwise everyone pays their own share.
 */
export function settle({ points, winnerSeat, selfDraw, fromSeat, rules }) {
  const payments = [0, 0, 0, 0];
  if (!selfDraw && rules.discarderPaysAll) {
    payments[fromSeat] = -points * 3;
  } else {
    for (let s = 0; s < 4; s++) if (s !== winnerSeat) payments[s] = -points;
  }
  payments[winnerSeat] = -payments.reduce((sum, p) => sum + p, 0);
  return payments;
}
