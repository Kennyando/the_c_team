import { TILE_COUNT } from "./tiles";

/**
 * Shanten = minimum number of tile exchanges needed to reach tenpai (0),
 * -1 means the hand is already a complete, winning hand.
 *
 * This is a from-scratch recursive decomposition, not a full production
 * agari library — it's accurate for the common cases (melds, pairs, and
 * two-away partial melds/kanchan) which is what a move-advisor needs, but
 * doesn't optimise every exotic edge case a tournament solver would. Good
 * enough for the "recommend a discard" feature; worth swapping for a
 * battle-tested library (e.g. a ported `syanten` implementation) if this
 * becomes a core scoring engine rather than an assistant.
 */

function standardShanten(counts: number[]): number {
  let best = 8;
  const c = counts.slice();
  const totalTiles = counts.reduce((a, b) => a + b, 0);

  function evaluate(melds: number, partials: number, pairs: number) {
    let usedPartials = partials;
    let blocks = melds + usedPartials;
    if (blocks > 4) {
      usedPartials = 4 - melds;
      blocks = 4;
    }
    const hasPair = pairs > 0 ? 1 : 0;
    let shanten = (4 - melds) * 2 - usedPartials - hasPair;

    // Only penalise "no pair anywhere" when there's also no spare tile left
    // to eventually become one (a tanki/pair wait needs just one floating
    // tile, which a hand with melds < 4 and nothing else committed always
    // has — that's a legitimate tenpai shape, not a shanten+1 situation).
    const tilesUsed = melds * 3 + usedPartials * 2 + (hasPair ? 2 : 0);
    const floating = totalTiles - tilesUsed;
    if (hasPair === 0 && floating === 0) shanten += 1;

    if (shanten < best) best = shanten;
  }

  function scan(index: number, melds: number, partials: number, pairs: number) {
    if (index === TILE_COUNT) {
      evaluate(melds, partials, pairs);
      return;
    }
    if (c[index] === 0) {
      scan(index + 1, melds, partials, pairs);
      return;
    }

    const isSuited = index < 27;
    const posInSuit = index % 9;

    if (c[index] >= 3) {
      c[index] -= 3;
      scan(index, melds + 1, partials, pairs);
      c[index] += 3;
    }
    if (isSuited && posInSuit <= 6 && c[index] > 0 && c[index + 1] > 0 && c[index + 2] > 0) {
      c[index]--; c[index + 1]--; c[index + 2]--;
      scan(index, melds + 1, partials, pairs);
      c[index]++; c[index + 1]++; c[index + 2]++;
    }
    if (c[index] >= 2) {
      c[index] -= 2;
      scan(index, melds, partials, pairs + 1);
      c[index] += 2;
    }
    if (isSuited && posInSuit <= 7 && c[index] > 0 && c[index + 1] > 0) {
      c[index]--; c[index + 1]--;
      scan(index, melds, partials + 1, pairs);
      c[index]++; c[index + 1]++;
    }
    if (isSuited && posInSuit <= 6 && c[index] > 0 && c[index + 2] > 0) {
      c[index]--; c[index + 2]--;
      scan(index, melds, partials + 1, pairs);
      c[index]++; c[index + 2]++;
    }
    // Leave this tile as a floating (unused) tile and move on.
    scan(index + 1, melds, partials, pairs);
  }

  scan(0, 0, 0, 0);
  return best;
}

/** Seven pairs (chiitoitsu-style) — a recognised special hand locally. */
function sevenPairsShanten(counts: number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (const n of counts) {
    if (n > 0) kinds++;
    if (n >= 2) pairs++;
  }
  pairs = Math.min(pairs, 7);
  return 6 - pairs + Math.max(0, 7 - kinds);
}

/** Thirteen wonders / thirteen orphans — one of each terminal/honor plus a pair among them. */
function thirteenWondersShanten(counts: number[]): number {
  const targets = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let uniqueCount = 0;
  let hasPair = false;
  for (const t of targets) {
    if (counts[t] > 0) uniqueCount++;
    if (counts[t] >= 2) hasPair = true;
  }
  return 13 - uniqueCount - (hasPair ? 1 : 0);
}

/** Overall shanten = best of the standard hand and the recognised special hands. */
export function shanten(counts: number[]): number {
  return Math.min(standardShanten(counts), sevenPairsShanten(counts), thirteenWondersShanten(counts));
}

export const isWinningHand = (counts: number[]) => shanten(counts) === -1;
