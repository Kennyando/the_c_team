// Discard puzzles: a frozen hand with a genuine, checkable right answer.
//
// Reuses advisor.js's own bestDiscard()/shanten() rather than any separate judging logic, so a
// puzzle's answer can never disagree with what the live coach would say about the same hand.
// Pure, like the rest of src/game/ — no React import, testable in plain Node.

import { STANDARD_TILES, shuffle, sortTiles } from './tiles.js';
import { shanten, bestDiscard } from './advisor.js';

const RETRIES = 20;
const RETRIES_FOR_DIFFICULTY = 60; // the rarest tier is ~17% of hands; this clears it >99.999% of the time

/** A fresh 14-tile hand from a full standard 136-tile set — no bonus tiles, since a puzzle is a
 * frozen hand, not a live deal with a wall to set them aside into. */
function randomHand() {
  const tiles = [];
  for (const t of STANDARD_TILES) for (let i = 0; i < 4; i++) tiles.push(t);
  return sortTiles(shuffle(tiles).slice(0, 14));
}

/**
 * How hard a puzzle is: the number of distinct tiles that tie for the single best resulting
 * shanten. Fewer ties means the right answer stands out sharply from everything else (hard);
 * more ties means several discards are all correct (easy, forgiving).
 *
 * This is *not* the shanten gap to the closest wrong tile — that gap turns out to always be
 * exactly 1 (checked against 20,000 randomly generated hands), a structural property of shanten
 * under single-tile removal, so it carries no difficulty signal at all. Tie count does vary
 * meaningfully across real hands.
 */
function difficultyOf(tieCount) {
  if (tieCount <= 4) return 'hard';
  if (tieCount <= 7) return 'medium';
  return 'easy';
}

/**
 * Turn a hand into a puzzle, or reject it. Pure and deterministic — pass a fixed hand in tests;
 * `generateDiscardPuzzle()` below is what draws a real random one.
 *
 * Rejects (returns `null`) two degenerate cases: a hand that's already complete (nothing to
 * discard toward) and a hand where every distinct tile leaves the same resulting shanten (any
 * answer would be "correct", which teaches nothing) — the latter is exactly `tieCount` covering
 * every distinct tile in the hand.
 */
export function tryDiscardPuzzle(hand) {
  const before = shanten(hand, []);
  if (before < 0) return null;

  const rec = bestDiscard({ hand, melds: [] });
  const distinctTiles = [...new Set(hand)];
  const tieCount = distinctTiles.filter((tile) => {
    const rest = [...hand];
    rest.splice(rest.indexOf(tile), 1);
    return shanten(rest, []) === rec.shantenAfter;
  }).length;
  if (tieCount === distinctTiles.length) return null;

  return {
    hand,
    shantenBefore: before,
    bestTile: rec.tile,
    shantenAfterBest: rec.shantenAfter,
    reasons: rec.reasons,
    tieCount,
    difficulty: difficultyOf(tieCount),
  };
}

/**
 * Draw a random hand and turn it into a puzzle, retrying a bounded number of times against the
 * degenerate cases above. Returns `null` if nothing valid turns up within the retry budget —
 * callers can just ask again.
 *
 * Pass `difficulty` ('easy' | 'medium' | 'hard') to keep retrying until a puzzle of that exact
 * tier turns up. A returned puzzle's `difficulty` always matches what was requested — this never
 * falls back to a different tier, since callers (the progression UI) label the puzzle using the
 * difficulty they asked for, and a puzzle silently of a different tier would mean that label lies.
 * The rarest tier is still ~17% of hands, so `RETRIES_FOR_DIFFICULTY` clears it >99.999% of the
 * time; returning `null` on the remaining sliver is a truthful "try again," not a wrong answer.
 */
export function generateDiscardPuzzle(difficulty) {
  const retries = difficulty ? RETRIES_FOR_DIFFICULTY : RETRIES;
  for (let i = 0; i < retries; i++) {
    const puzzle = tryDiscardPuzzle(randomHand());
    if (puzzle && (!difficulty || puzzle.difficulty === difficulty)) return puzzle;
  }
  return null;
}

/**
 * Check an answer against a puzzle. Mirrors engine.js's own `recordDiscardDecision`: comparing
 * the resulting shanten directly, not membership in bestDiscard()'s (UI-oriented, truncated)
 * `alternatives` list, so a multi-way tie is never misjudged as a mistake.
 *
 * "Correct" means shanten-optimal, not necessarily the single best mahjong play: a tie in
 * resulting shanten can still differ in how many tiles would complete the hand from there
 * (ukeire), which this doesn't account for — matching the same limit `bestDiscard()` in
 * advisor.js already has.
 */
export function checkDiscardAnswer(puzzle, chosenTile) {
  const rest = [...puzzle.hand];
  const index = rest.indexOf(chosenTile);
  // A tile that isn't actually in the hand isn't a wrong answer to grade — it's not an answer at
  // all. The current UI only ever passes a tile from puzzle.hand, but this is an exported function
  // and indexOf()'s -1 would otherwise silently splice the *last* tile and grade that instead.
  if (index === -1) return { correct: false, shantenAfterChosen: null };
  rest.splice(index, 1);
  const shantenAfterChosen = shanten(rest, []);
  return { correct: shantenAfterChosen === puzzle.shantenAfterBest, shantenAfterChosen };
}
