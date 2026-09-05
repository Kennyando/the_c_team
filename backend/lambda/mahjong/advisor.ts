import { TILE_COUNT, tileLabel, handToCounts } from "./tiles";
import { shanten } from "./shanten";

export interface DiscardRecommendation {
  tile: string;
  resultingShanten: number;
}

export interface LegalCalls {
  win: boolean;
  kong: boolean;
  pong: boolean;
  chow: boolean;
}

export interface AdviceResult {
  currentShanten: number;
  legalCalls: LegalCalls;
  recommendedDiscard: DiscardRecommendation | null;
}

/**
 * Chow can only be called on the discard of the player seated immediately
 * to one's left. seatOffset is (discardingSeat - mySeat + 4) % 4; a value
 * of 3 means "the player to my left just discarded".
 */
const LEFT_PLAYER_OFFSET = 3;

function canFormChow(counts: number[], tileIndex: number): boolean {
  if (tileIndex >= 27) return false; // honors never chow
  const pos = tileIndex % 9;
  const has = (i: number) => counts[i] > 0;

  const lowRun = pos <= 6 && has(tileIndex + 1) && has(tileIndex + 2); // tile is the low end
  const midRun = pos >= 1 && pos <= 7 && has(tileIndex - 1) && has(tileIndex + 1); // tile is the middle
  const highRun = pos >= 2 && has(tileIndex - 2) && has(tileIndex - 1); // tile is the high end
  return lowRun || midRun || highRun;
}

/**
 * Counts how many copies of each tile kind are already visible in discard
 * piles, as a simple defensive-safety signal: a tile discarded three times
 * already is very unlikely to deal into anyone.
 */
function safetyScore(discardPile: string[] | undefined, tileIndex: number): number {
  if (!discardPile) return 0;
  const label = tileLabel(tileIndex);
  return discardPile.filter((d) => d === label).length;
}

/**
 * Core recommendation function. `hand` is the player's own tiles (13, or
 * 14 right after a draw). `discardPile` is every tile discarded so far in
 * the room, used only for the safety heuristic on tie-breaks.
 */
export function advise(
  hand: string[],
  options: { discardPile?: string[]; lastDiscard?: { tile: string; seatOffset: number } } = {},
): AdviceResult {
  const counts = handToCounts(hand);
  const currentShanten = shanten(counts);

  const legalCalls: LegalCalls = { win: false, kong: false, pong: false, chow: false };
  if (options.lastDiscard) {
    const idx = handToCounts([options.lastDiscard.tile]).findIndex((n) => n > 0);
    legalCalls.pong = counts[idx] >= 2;
    legalCalls.kong = counts[idx] >= 3;
    legalCalls.chow = options.lastDiscard.seatOffset === LEFT_PLAYER_OFFSET && canFormChow(counts, idx);
    const withDiscard = counts.slice();
    withDiscard[idx]++;
    legalCalls.win = shanten(withDiscard) === -1;
  }

  // Only makes sense to recommend a discard from a 14-tile hand (i.e. after a draw).
  let recommendedDiscard: DiscardRecommendation | null = null;
  if (hand.length % 3 === 2) {
    let bestTile = -1;
    let bestShanten = Infinity;
    let bestSafety = -1;

    for (let i = 0; i < TILE_COUNT; i++) {
      if (counts[i] === 0) continue;
      counts[i]--;
      const resulting = shanten(counts);
      const safety = safetyScore(options.discardPile, i);
      counts[i]++;

      const better =
        resulting < bestShanten || (resulting === bestShanten && safety > bestSafety);
      if (better) {
        bestTile = i;
        bestShanten = resulting;
        bestSafety = safety;
      }
    }

    if (bestTile >= 0) {
      recommendedDiscard = { tile: tileLabel(bestTile), resultingShanten: bestShanten };
    }
  }

  return { currentShanten, legalCalls, recommendedDiscard };
}
