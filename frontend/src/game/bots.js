// Heuristic AI opponents.
//
// Deliberately simple: no search, no lookahead. Bots keep tiles that are already paired or have
// neighbours, drift toward whichever suit they hold most of, and shed lone honours first. That is
// enough to produce a game that feels like a real table, which is what the MVP needs.

import { isSuited, suitOf, rankOf } from './tiles.js';
import { toCounts } from './melds.js';

/**
 * How much a tile is worth hanging on to. Exported because the help coach ranks discards with the
 * same measure — one evaluation for both, so the advice and the bots' play cannot drift apart.
 */
export function keepValue(tile, counts, suitTotals) {
  const held = counts[tile];
  let value = 0;

  if (held >= 3) value += 20;
  else if (held === 2) value += 8;

  if (isSuited(tile)) {
    const s = suitOf(tile);
    const n = rankOf(tile);
    if (counts[s + (n - 1)]) value += 4;
    if (counts[s + (n + 1)]) value += 4;
    if (counts[s + (n - 2)]) value += 2;
    if (counts[s + (n + 2)]) value += 2;
    value += suitTotals[s] * 0.2;      // lean toward a flush
    if (n >= 3 && n <= 7) value += 1;  // middle tiles form more sets
  } else if (held === 1) {
    value -= 1;                        // a lone honour is the cheapest thing to let go
  }

  return value;
}

/** Pick the least useful tile in hand. */
export function chooseDiscard(player) {
  const counts = toCounts(player.hand);
  const suitTotals = { d: 0, b: 0, c: 0 };
  for (const t of player.hand) if (isSuited(t)) suitTotals[suitOf(t)]++;

  let worst = player.hand[0];
  let worstValue = Infinity;
  for (const tile of player.hand) {
    const value = keepValue(tile, counts, suitTotals);
    if (value < worstValue) {
      worstValue = value;
      worst = tile;
    }
  }
  return worst;
}

/** Decide whether to claim a discard. Returns the chosen claim, or null to pass. */
export function chooseClaim(player, claims) {
  const win = claims.find((c) => c.type === 'win');
  if (win) return win;

  const kong = claims.find((c) => c.type === 'kong');
  if (kong) return kong;

  const pong = claims.find((c) => c.type === 'pong');
  if (pong) return pong;

  // Chow gives away the least, so only take one before committing to any other meld.
  const chow = claims.find((c) => c.type === 'chow');
  if (chow && player.melds.length === 0) return chow;

  return null;
}

/** On its own turn a bot always takes a win, always takes a kong, then discards. */
export function chooseTurnAction(actions) {
  return actions.find((a) => a.type === 'win')
    || actions.find((a) => a.type === 'concealedKong')
    || actions.find((a) => a.type === 'addedKong')
    || null;
}
