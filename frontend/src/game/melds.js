// Set formation and legal-call detection.
//
// Pure functions over plain data — no React, no engine state — so these lift straight into an AWS
// Lambda handler later (proposal Section 7, "stateless functions validating moves").

import { STANDARD_TILES, isSuited, suitOf, rankOf } from './tiles.js';

export function toCounts(tiles) {
  const counts = {};
  for (const t of tiles) counts[t] = (counts[t] || 0) + 1;
  return counts;
}

function totalCount(counts) {
  let n = 0;
  for (const t in counts) n += counts[t];
  return n;
}

function firstTile(counts) {
  for (const t of STANDARD_TILES) if (counts[t] > 0) return t;
  return null;
}

/**
 * All the ways `counts` splits into exactly `needed` sets (chow or pong) with nothing left over.
 * Always consumes the lowest remaining tile first, so each distinct split is produced once.
 */
function findSets(counts, needed) {
  if (needed === 0) return totalCount(counts) === 0 ? [[]] : [];
  const t = firstTile(counts);
  if (!t) return [];
  const out = [];

  if (counts[t] >= 3) {
    counts[t] -= 3;
    for (const rest of findSets(counts, needed - 1)) {
      out.push([{ type: 'pong', tiles: [t, t, t], concealed: true }, ...rest]);
    }
    counts[t] += 3;
  }

  if (isSuited(t)) {
    const s = suitOf(t);
    const n = rankOf(t);
    const b = s + (n + 1);
    const c = s + (n + 2);
    if (n <= 7 && counts[b] > 0 && counts[c] > 0) {
      counts[t]--; counts[b]--; counts[c]--;
      for (const rest of findSets(counts, needed - 1)) {
        out.push([{ type: 'chow', tiles: [t, b, c], concealed: true }, ...rest]);
      }
      counts[t]++; counts[b]++; counts[c]++;
    }
  }

  return out;
}

/**
 * Every way the concealed tiles read as `neededSets` sets plus one pair.
 * More than one reading is common (e.g. 2-3-4-5-6-7 is two chows either way), and they can score
 * differently, so scoring evaluates all of them and keeps the best.
 */
export function decompose(tiles, neededSets) {
  const counts = toCounts(tiles);
  if (totalCount(counts) !== neededSets * 3 + 2) return [];
  const out = [];
  for (const t of Object.keys(counts)) {
    if (counts[t] < 2) continue;
    counts[t] -= 2;
    for (const sets of findSets(counts, neededSets)) out.push({ pair: t, sets });
    counts[t] += 2;
  }
  return out;
}

/** A standard win: four sets plus a pair, counting melds already exposed on the table. */
export function isWinningHand(concealed, melds = []) {
  return decompose(concealed, 4 - melds.length).length > 0;
}

/**
 * What `player` may claim from a discard.
 * Chow is only legal from the player to one's left (proposal Section 5) — in turn order
 * East → South → West → North, that is the seat three places along.
 */
export function getClaimsFor(player, tile, discarderSeat) {
  const claims = [];
  const counts = toCounts(player.hand);
  const held = counts[tile] || 0;

  if (isWinningHand([...player.hand, tile], player.melds)) {
    claims.push({ type: 'win', tiles: [tile] });
  }
  if (held >= 3) claims.push({ type: 'kong', tiles: [tile, tile, tile, tile] });
  if (held >= 2) claims.push({ type: 'pong', tiles: [tile, tile, tile] });

  if (isSuited(tile) && discarderSeat === (player.seat + 3) % 4) {
    const s = suitOf(tile);
    const n = rankOf(tile);
    for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
      const ra = n + a;
      const rb = n + b;
      if (ra < 1 || ra > 9 || rb < 1 || rb > 9) continue;
      if (counts[s + ra] > 0 && counts[s + rb] > 0) {
        const tiles = [s + ra, tile, s + rb].sort((x, y) => rankOf(x) - rankOf(y));
        claims.push({ type: 'chow', tiles });
      }
    }
  }
  return claims;
}

/** Kongs a player may declare on their own turn: four concealed, or a fourth tile onto own pong. */
export function getSelfKongs(player) {
  const counts = toCounts(player.hand);
  const out = [];
  for (const t in counts) if (counts[t] === 4) out.push({ type: 'concealedKong', tile: t });
  for (const m of player.melds) {
    if (m.type === 'pong' && counts[m.tiles[0]] > 0) out.push({ type: 'addedKong', tile: m.tiles[0] });
  }
  return out;
}

const PRIORITY = { win: 3, kong: 2, pong: 2, chow: 1 };

/** Claim priority: Win beats Kong/Pong beats Chow; ties go to whoever plays soonest. */
export function bestClaim(claims, discarderSeat) {
  let best = null;
  for (const c of claims) {
    if (!c) continue;
    if (!best) { best = c; continue; }
    const dp = PRIORITY[c.type] - PRIORITY[best.type];
    if (dp > 0) { best = c; continue; }
    if (dp < 0) continue;
    const dist = (s) => (s - discarderSeat + 4) % 4;
    if (dist(c.seat) < dist(best.seat)) best = c;
  }
  return best;
}
