// Discard puzzles: a frozen hand with a genuine, checkable right answer.
//
// Reuses advisor.js's own bestDiscard()/shanten() rather than any separate judging logic, so a
// puzzle's answer can never disagree with what the live coach would say about the same hand.
// Pure, like the rest of src/game/ — no React import, testable in plain Node.

import { shanten, bestDiscard } from './advisor.js';

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
 * Turn a hand into a puzzle, or reject it. Pure and deterministic — used both by unit tests
 * against a fixed hand, and by `puzzleLibrary.js` to derive each curated puzzle's answer and
 * difficulty from the hand it's built around.
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
