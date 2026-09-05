// Discard puzzles: a frozen hand with a genuine, checkable right answer.
//
// Reuses advisor.js's own bestDiscard()/shanten() rather than any separate judging logic, so a
// puzzle's answer can never disagree with what the live coach would say about the same hand.
// Pure, like the rest of src/game/ — no React import, testable in plain Node.

import { STANDARD_TILES, shuffle, sortTiles } from './tiles.js';
import { shanten, bestDiscard } from './advisor.js';

const RETRIES = 20;

/** A fresh 14-tile hand from a full standard 136-tile set — no bonus tiles, since a puzzle is a
 * frozen hand, not a live deal with a wall to set them aside into. */
function randomHand() {
  const tiles = [];
  for (const t of STANDARD_TILES) for (let i = 0; i < 4; i++) tiles.push(t);
  return sortTiles(shuffle(tiles).slice(0, 14));
}

/**
 * Turn a hand into a puzzle, or reject it. Pure and deterministic — pass a fixed hand in tests;
 * `generateDiscardPuzzle()` below is what draws a real random one.
 *
 * Rejects (returns `null`) two degenerate cases: a hand that's already complete (nothing to
 * discard toward) and a hand where every distinct tile leaves the same resulting shanten (any
 * answer would be "correct", which teaches nothing).
 */
export function tryDiscardPuzzle(hand) {
  const before = shanten(hand, []);
  if (before < 0) return null;

  const rec = bestDiscard({ hand, melds: [] });
  const allTie = [...new Set(hand)].every((tile) => {
    const rest = [...hand];
    rest.splice(rest.indexOf(tile), 1);
    return shanten(rest, []) === rec.shantenAfter;
  });
  if (allTie) return null;

  return {
    hand,
    shantenBefore: before,
    bestTile: rec.tile,
    shantenAfterBest: rec.shantenAfter,
    reasons: rec.reasons,
  };
}

/** Draw a random hand and turn it into a puzzle, retrying a bounded number of times against the
 * two degenerate cases above. Returns `null` only in the astronomically unlikely case that every
 * attempt is degenerate — callers can just ask again. */
export function generateDiscardPuzzle() {
  for (let i = 0; i < RETRIES; i++) {
    const puzzle = tryDiscardPuzzle(randomHand());
    if (puzzle) return puzzle;
  }
  return null;
}

/** Check an answer against a puzzle. Mirrors engine.js's own `recordDiscardDecision`: comparing
 * the resulting shanten directly, not membership in bestDiscard()'s (UI-oriented, truncated)
 * `alternatives` list, so a multi-way tie is never misjudged as a mistake. */
export function checkDiscardAnswer(puzzle, chosenTile) {
  const rest = [...puzzle.hand];
  rest.splice(rest.indexOf(chosenTile), 1);
  const shantenAfterChosen = shanten(rest, []);
  return { correct: shantenAfterChosen === puzzle.shantenAfterBest, shantenAfterChosen };
}
