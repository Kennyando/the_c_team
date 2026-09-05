// Position analysis for the help coach.
//
// Pure functions over game state, like the rest of src/game/ — no React, testable in plain Node.
// Everything here is computed from the player's actual hand and the table's actual house rules, so
// the advice can never contradict the settings the group is playing under.

import { STANDARD_TILES, DRAGONS, isSuited, isHonour, suitOf, rankOf, tileName } from './tiles.js';
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
 * How many tai one extra shanten is "worth" when weighing a slightly slower discard against a
 * more valuable one. This is a named, tunable guess, not a number derived from real win-rate
 * data — the honest alternative would be a full turn-by-turn probability simulation, which this
 * project has deliberately not built (see docs/mvp-notes.md). Exported so anything grading a
 * discard against `bestDiscard()`'s recommendation (the decision log, puzzle checking) uses this
 * exact same scale rather than inventing its own.
 */
export const VALUE_PER_SHANTEN = 2;

/**
 * Build what `estimateValue()`/`bestDiscard()` need to know about the table: whose seat/prevailing
 * wind apply, which scoring rules are live, and every tile already known to be out of the wall.
 *
 * `visibleTiles` deliberately never reads `state.wall` itself, even though this engine's wall is a
 * real, fully-determined array in memory — a real player wouldn't know its contents, and advice
 * that quietly used that knowledge wouldn't be honest advice. Every hand, every discard, and every
 * exposed meld/bonus across all four seats is "known"; everything else (the wall and every
 * opponent's concealed hand) is treated as one undifferentiated unknown pool, the same assumption
 * every real tile-efficiency tool makes when opponents' hands aren't visible.
 */
export function contextFor(state, player) {
  const visibleTiles = {};
  const add = (tile) => { visibleTiles[tile] = (visibleTiles[tile] || 0) + 1; };
  for (const p of state.players) {
    for (const t of p.hand) add(t);
    for (const m of p.melds) for (const t of m.tiles) add(t);
    for (const t of p.bonus) add(t);
  }
  for (const d of state.discards) add(d.tile);

  return {
    rules: state.rules,
    seatWind: seatWindOf(player.seat, state.dealer),
    prevailingWind: state.prevailingWind,
    visibleTiles,
  };
}

/**
 * A rough, rules-aware estimate of how many tai a hand might be worth once complete — the "value"
 * half of the speed-vs-value tradeoff `bestDiscard()` weighs. Not a full expected-value
 * simulation: exact (weighted by how many of each winning tile are actually still unseen) once
 * the hand is ready, a small hand-authored heuristic before that, scoped to exactly the scoring
 * patterns this table's own `ctx.rules` actually reward.
 */
export function estimateValue(player, ctx) {
  const distance = shanten(player.hand, player.melds);

  if (distance <= 0) {
    const ready = waits(player);
    if (!ready.length) return 0;

    let weightedTai = 0;
    let totalRemaining = 0;
    for (const tile of ready) {
      const score = scoreHand({
        concealed: [...player.hand, tile],
        melds: player.melds,
        bonus: player.bonus,
        seatWind: ctx.seatWind,
        prevailingWind: ctx.prevailingWind,
        rules: ctx.rules,
      });
      if (!score) continue;
      const remaining = Math.max(0, 4 - (ctx.visibleTiles[tile] || 0));
      weightedTai += score.tai * remaining;
      totalRemaining += remaining;
    }
    return totalRemaining > 0 ? weightedTai / totalRemaining : 0;
  }

  return honourAndFlushPotential(player, ctx);
}

// A single scoring-relevant honour is worth holding a little longer on the chance of pairing it —
// a small credit, well below a real pair, so it never competes with genuine structure. A pair
// hints at real future value; an already-formed triplet (which discarding down to would be
// unusual mid-hand, but the counts can still say 3 or 4 via a kong) is worth more still.
const HONOUR_PROGRESS = { 1: 0.25, 2: 1, 3: 2, 4: 2 };

/** Structural value signals for a hand still short of tenpai: an honour tile, pair, or triplet in
 * progress (only when the matching rule is actually on), and a lean toward a flush. Every weight
 * here is a starting guess — flagged as such, not presented as tuned. */
function honourAndFlushPotential(player, ctx) {
  const { rules, seatWind, prevailingWind } = ctx;
  const counts = toCounts(player.hand);
  let value = 0;

  for (const dragon of DRAGONS) {
    if (rules.dragonPong && counts[dragon]) value += HONOUR_PROGRESS[counts[dragon]] || 0;
  }
  if (rules.seatWind && counts[seatWind]) value += HONOUR_PROGRESS[counts[seatWind]] || 0;
  if (rules.prevailingWind && prevailingWind !== seatWind && counts[prevailingWind]) {
    value += HONOUR_PROGRESS[counts[prevailingWind]] || 0;
  }

  if (rules.halfFlush || rules.fullFlush) {
    const suitTotals = { d: 0, b: 0, c: 0 };
    for (const t of player.hand) if (isSuited(t)) suitTotals[suitOf(t)]++;
    const dominant = Math.max(...Object.values(suitTotals));
    const hasHonours = player.hand.some(isHonour);
    if (dominant >= 10) value += hasHonours ? (rules.halfFlush ? 1 : 0) : (rules.fullFlush ? 2 : 0);
  }

  return value;
}

/**
 * The full evaluation of one candidate discard: the resulting shanten, its estimated value, and
 * the blended score `bestDiscard()` ranks by. Exported so anything that needs to grade a
 * *different* tile against the recommendation — the decision log, puzzle answer checking — uses
 * these exact same real numbers instead of re-deriving the formula or trusting a capped
 * `alternatives` list (a mistake already made and fixed once this project; see the decision log's
 * own history).
 */
export function evaluateDiscard(player, tile, ctx) {
  const rest = [...player.hand];
  rest.splice(rest.indexOf(tile), 1);
  const after = shanten(rest, player.melds);
  const value = estimateValue({ ...player, hand: rest }, ctx);
  return { tile, after, value, blended: -after * VALUE_PER_SHANTEN + value };
}

/**
 * The best tile to discard.
 *
 * Ranked primarily by speed, but not *only* by speed: every candidate within one shanten of the
 * fastest is also eligible, scored by a blend of speed and `estimateValue()`, so a discard that's
 * marginally slower can still win when it protects real value — the tradeoff a fixed-shanten-first
 * ranking could never express. The window is deliberately bounded to one shanten: this is meant to
 * catch "don't break a real dragon pair for one turn of speed," not license "sacrifice several
 * turns for a speculative hand," which would be bad advice for a coach this simple. Ties on the
 * blended score fall back to the bots' own `keepValue`, exactly as before.
 */
export function bestDiscard(player, ctx) {
  const suitTotals = { d: 0, b: 0, c: 0 };
  for (const t of player.hand) if (isSuited(t)) suitTotals[suitOf(t)]++;
  const counts = toCounts(player.hand);

  const candidates = [...new Set(player.hand)].map((tile) => ({
    ...evaluateDiscard(player, tile, ctx),
    keep: keepValue(tile, counts, suitTotals),
  }));

  const bestAfter = Math.min(...candidates.map((c) => c.after));
  const eligible = candidates.filter((c) => c.after <= bestAfter + 1);
  eligible.sort((a, b) => b.blended - a.blended || a.after - b.after || a.keep - b.keep);
  const choice = eligible[0];

  return {
    tile: choice.tile,
    shantenAfter: choice.after,
    value: choice.value,
    blended: choice.blended,
    reasons: discardReasons(choice.tile, player),
    // Anything that ties the winning blended score is an acceptable alternative.
    alternatives: eligible
      .slice(1)
      .filter((c) => c.blended === choice.blended)
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
    const { tile } = bestDiscard(you, contextFor(state, you));
    return `Your turn. ${tileName(tile)} is the safest tile to let go.`;
  }

  return null;
}

/** Claims available to the human right now, used to badge the coach button. */
export function pendingHelp(state) {
  if (state.phase !== 'claim' || !state.pending) return [];
  return getClaimsFor(state.players[0], state.pending.tile, state.pending.by);
}
