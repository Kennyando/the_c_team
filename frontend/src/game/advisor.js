// Position analysis for the help coach.
//
// Pure functions over game state, like the rest of src/game/ — no React, testable in plain Node.
// Everything here is computed from the player's actual hand and the table's actual house rules, so
// the advice can never contradict the settings the group is playing under.

import { STANDARD_TILES, isSuited, isHonour, suitOf, rankOf, tileName } from './tiles.js';
import { toCounts, isWinningHand, getClaimsFor } from './melds.js';
import { scoreHand, seatWindOf } from './scoring.js';
import { keepValue } from './bots.js';

/**
 * How many useful tiles away from winning a hand is.
 * -1 means already complete, 0 means ready (one tile away), and higher is further out.
 *
 * Uses the standard measure: every complete set is worth 2 and every partial set (a pair, or two
 * tiles that could become a run) is worth 1, against a budget of 8.
 */
export function shanten(concealed, melds = []) {
  const counts = toCounts(concealed);
  const fixed = melds.length;
  let best = 8;

  const walk = (index, sets, partials, hasPair) => {
    const blocks = fixed + sets + partials;
    // A hand needs a pair for its eyes. Five blocks with no pair among them is one step further out
    // than the raw count suggests.
    const value = 8 - 2 * (fixed + sets) - partials + (blocks === 5 && !hasPair ? 1 : 0);
    if (value < best) best = value;
    if (index >= STANDARD_TILES.length) return;

    const tile = STANDARD_TILES[index];
    if (!counts[tile]) return walk(index + 1, sets, partials, hasPair);

    const used = sets + fixed + partials;

    // A complete triplet.
    if (counts[tile] >= 3 && used < 5) {
      counts[tile] -= 3;
      walk(index, sets + 1, partials, hasPair);
      counts[tile] += 3;
    }

    // A complete run.
    if (isSuited(tile) && used < 5) {
      const s = suitOf(tile);
      const n = rankOf(tile);
      if (n <= 7 && counts[s + (n + 1)] && counts[s + (n + 2)]) {
        counts[tile]--; counts[s + (n + 1)]--; counts[s + (n + 2)]--;
        walk(index, sets + 1, partials, hasPair);
        counts[tile]++; counts[s + (n + 1)]++; counts[s + (n + 2)]++;
      }
    }

    // A pair — only one pair counts as the hand's eyes, the rest are ordinary partials.
    if (counts[tile] >= 2 && used < 5) {
      counts[tile] -= 2;
      walk(index, sets, partials + 1, true);
      counts[tile] += 2;
    }

    // Two tiles that still need one more to become a run.
    if (isSuited(tile) && used < 5) {
      const s = suitOf(tile);
      const n = rankOf(tile);
      for (const gap of [1, 2]) {
        const other = s + (n + gap);
        if (n + gap <= 9 && counts[other]) {
          counts[tile]--; counts[other]--;
          walk(index, sets, partials + 1, hasPair);
          counts[tile]++; counts[other]++;
        }
      }
    }

    walk(index + 1, sets, partials, hasPair);
  };

  walk(0, 0, 0, false);
  return best;
}

/** Which tiles would complete the hand right now. Empty unless the hand is ready. */
export function waits(player) {
  const found = [];
  for (const tile of STANDARD_TILES) {
    if (isWinningHand([...player.hand, tile], player.melds)) found.push(tile);
  }
  return found;
}

/** Why a particular tile is safe to let go, in plain language. */
function discardReasons(tile, player) {
  const counts = toCounts(player.hand);
  const reasons = [];

  if (isHonour(tile) && counts[tile] === 1) {
    reasons.push('It is a lone wind or dragon, so it needs three of a kind to be worth anything.');
  }

  if (isSuited(tile)) {
    const s = suitOf(tile);
    const n = rankOf(tile);
    const neighbours = [-2, -1, 1, 2].filter((d) => counts[s + (n + d)]).length;
    const inSuit = player.hand.filter((t) => isSuited(t) && suitOf(t) === s).length;

    if (neighbours === 0) reasons.push('Nothing next to it in your hand, so it cannot join a run.');
    if (inSuit === 1) reasons.push(`It is your only ${suitWord(s)} tile.`);
    if (n === 1 || n === 9) reasons.push('Terminals join fewer runs than middle tiles.');
  }

  if (counts[tile] === 1) reasons.push('You hold only one, so it is not part of a pair yet.');
  return reasons;
}

const SUIT_WORDS = { d: 'Dots', b: 'Bamboo', c: 'Characters' };
const suitWord = (s) => SUIT_WORDS[s];

/**
 * The best tile to discard.
 *
 * Ranked by the shanten left behind — the tile whose loss keeps you closest to winning — with the
 * bots' own `keepValue` as the tie-break. Looking at the resulting shanten is why the coach's
 * advice is better founded than the bots' play, which only ever consults `keepValue`.
 */
export function bestDiscard(player) {
  const suitTotals = { d: 0, b: 0, c: 0 };
  for (const t of player.hand) if (isSuited(t)) suitTotals[suitOf(t)]++;
  const counts = toCounts(player.hand);

  const candidates = [...new Set(player.hand)].map((tile) => {
    const rest = [...player.hand];
    rest.splice(rest.indexOf(tile), 1);
    return {
      tile,
      after: shanten(rest, player.melds),
      keep: keepValue(tile, counts, suitTotals),
    };
  });

  candidates.sort((a, b) => a.after - b.after || a.keep - b.keep);
  const choice = candidates[0];

  return {
    tile: choice.tile,
    shantenAfter: choice.after,
    reasons: discardReasons(choice.tile, player),
    // Anything that leaves you equally close is an acceptable alternative.
    alternatives: candidates
      .slice(1)
      .filter((c) => c.after === choice.after)
      .slice(0, 2)
      .map((c) => c.tile),
  };
}

/**
 * Whether taking a call actually helps, and what it costs.
 *
 * `claimedTile` is the tile on the table. It matters: a chow's tiles are held in rank order, so the
 * claimed tile is often the middle one, and assuming it is first would model the wrong tiles
 * leaving your hand. This mirrors how `applyClaim` in engine.js resolves the same thing.
 */
export function claimAdvice(player, claim, claimedTile = claim.tiles[0]) {
  if (claim.type === 'win') {
    return { verdict: 'yes', lines: ['Take it — that completes your hand.'] };
  }

  // Model the call: the tiles that come out of your hand are the set minus the claimed one.
  const fromHand = [...claim.tiles];
  const claimedAt = fromHand.indexOf(claimedTile);
  if (claimedAt !== -1) fromHand.splice(claimedAt, 1);

  const rest = [...player.hand];
  for (const t of fromHand) {
    const at = rest.indexOf(t);
    if (at === -1) return { verdict: 'no', lines: ['You do not hold the tiles for that call.'] };
    rest.splice(at, 1);
  }

  const before = shanten(player.hand, player.melds);
  const after = shanten(rest, [...player.melds, { type: claim.type, tiles: claim.tiles }]);

  const lines = [];
  const helps = after < before;
  if (helps) {
    lines.push(`Yes — it takes you from ${describeDistance(before)} to ${describeDistance(after)}.`);
  } else {
    lines.push(`It does not get you closer — you stay ${describeDistance(before)}.`);
  }

  if (claim.type === 'chow') lines.push('Chow only works on the player to your left.');
  else lines.push('Calling turns those tiles face up for everyone to see.');

  return { verdict: helps ? 'yes' : 'no', lines };
}

export function describeDistance(value) {
  if (value <= -1) return 'a complete hand';
  if (value === 0) return 'one tile from winning';
  return `${value + 1} tiles from winning`;
}

/**
 * What the hand is worth and how far along it is.
 * Scoring goes through the shared `scoreHand`, so it always reflects the live house rules.
 */
export function handSummary(player, state) {
  const distance = shanten(player.hand, player.melds);
  const ready = waits(player);

  const scoreFor = (winningTile) => scoreHand({
    concealed: [...player.hand, winningTile],
    melds: player.melds,
    bonus: player.bonus,
    seatWind: seatWindOf(player.seat, state.dealer),
    prevailingWind: state.prevailingWind,
    rules: state.rules,
  });

  const best = ready
    .map((t) => ({ tile: t, score: scoreFor(t) }))
    .filter((r) => r.score)
    .sort((a, b) => b.score.tai - a.score.tai)[0];

  return { distance, waits: ready, best, bonusCount: player.bonus.length };
}

/** A one-line nudge for the current moment, used by the optional proactive hints. */
export function situationHint(state) {
  const you = state.players[0];

  if (state.phase === 'claim' && state.claimOptions?.length > 0) {
    const claim = state.claimOptions[0];
    const advice = claimAdvice(you, claim, state.pending.tile);
    return `You can ${claim.type} ${tileName(state.pending.tile)}. ${advice.lines[0]}`;
  }

  if (state.phase === 'act' && state.turn === 0) {
    const { tile } = bestDiscard(you);
    return `Your turn. ${tileName(tile)} is the safest tile to let go.`;
  }

  return null;
}

/** Claims available to the human right now, used to badge the coach button. */
export function pendingHelp(state) {
  if (state.phase !== 'claim' || !state.pending) return [];
  return getClaimsFor(state.players[0], state.pending.tile, state.pending.by);
}
