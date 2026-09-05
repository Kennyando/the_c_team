// Discard puzzles: turning a hand into a puzzle, rejecting degenerate hands, difficulty, and
// answer checking. `puzzleLibrary.test.js` covers the curated library built on top of this.
// Run with `npm test` from frontend/.

import test from 'node:test';
import assert from 'node:assert/strict';

import { bestDiscard } from '../src/game/advisor.js';
import { DEFAULT_RULES } from '../src/game/scoring.js';
import { tryDiscardPuzzle, checkDiscardAnswer } from '../src/game/puzzles.js';

// Matches puzzles.js's own internal puzzleContext() exactly: default house rules, seated East,
// with only the hand itself visible (no discard history) — a puzzle has no live game state behind
// it to build a real context from.
const ctxFor = (hand) => {
  const visibleTiles = {};
  for (const t of hand) visibleTiles[t] = (visibleTiles[t] || 0) + 1;
  return { rules: DEFAULT_RULES, seatWind: 'we', prevailingWind: 'we', visibleTiles };
};

test('an already-complete hand is rejected — there is nothing to discard toward', () => {
  const winning = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we', 'we'];
  assert.equal(tryDiscardPuzzle(winning), null);
});

test('a hand where every discard ties for the same best blended score is rejected — nothing to teach', () => {
  // Genuinely degenerate under bestDiscard()'s value-awareness too, not just structurally
  // scattered: none of these tiles is a dragon, this table's seat/prevailing wind, or part of any
  // pair/run, so nothing here carries even the small single-honour value credit either — every
  // discard is worth exactly the same on both speed and value. (A hand built only from
  // structurally-disconnected tiles, the way this test used to construct one, is no longer
  // sufficient on its own: any dragon or seat/prevailing-wind tile now breaks the tie even when
  // fully scattered, so this fixture had to be found by search rather than hand-built.)
  const scattered = ['d1', 'd3', 'd4', 'd8', 'd9', 'b2', 'b3', 'b3', 'b7', 'b8', 'c6', 'c6', 'ww', 'ww'];
  assert.equal(tryDiscardPuzzle(scattered), null);
});

test('an ordinary hand becomes a puzzle matching bestDiscard() directly', () => {
  // Same hand as advisor.test's "bestDiscard picks the dead tile and says why".
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
  const rec = bestDiscard({ hand, melds: [], bonus: [] }, ctxFor(hand));

  const puzzle = tryDiscardPuzzle(hand);
  assert.ok(puzzle, 'an ordinary hand should produce a puzzle');
  assert.deepEqual(puzzle.hand, hand);
  assert.equal(puzzle.bestTile, rec.tile);
  assert.equal(puzzle.shantenAfterBest, rec.shantenAfter);
  assert.deepEqual(puzzle.reasons, rec.reasons);
});

// --- difficulty ---------------------------------------------------------------------------
//
// Difficulty is the number of distinct tiles tied for the single best resulting shanten
// (`tieCount`), not the shanten gap to the closest wrong tile — that gap is always exactly 1
// regardless of the hand (checked against 20,000 randomly generated hands before choosing this
// metric), so it carries no signal. Fewer ties means the right answer stands out sharply (hard);
// more ties means several discards are all correct (easy).

test('a hand ready to win, with only one dead tile, is a hard puzzle — the best discard is unique', () => {
  // Same hand as above: b9 touches nothing and is the *only* tile that keeps the hand ready.
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
  const puzzle = tryDiscardPuzzle(hand);
  assert.equal(puzzle.tieCount, 1);
  assert.equal(puzzle.difficulty, 'hard');
});

test('a scattered, far-from-ready hand with many equally fine discards is an easy puzzle', () => {
  const hand = ['d1', 'd4', 'd8', 'd9', 'b1', 'b1', 'b2', 'b6', 'c4', 'c8', 'we', 'ww', 'dr', 'dw'];
  const puzzle = tryDiscardPuzzle(hand);
  assert.equal(puzzle.tieCount, 8);
  assert.equal(puzzle.difficulty, 'easy');
});

test('checkDiscardAnswer accepts the puzzle\'s own best tile', () => {
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
  const puzzle = tryDiscardPuzzle(hand);
  const answer = checkDiscardAnswer(puzzle, puzzle.bestTile);
  assert.equal(answer.correct, true);
  assert.equal(answer.shantenAfterChosen, puzzle.shantenAfterBest);
});

test('checkDiscardAnswer accepts a tile tied with the best one, not just the best one itself', () => {
  // Four complete sets plus two unpaired honours: discarding either is equally good. Regression
  // for the same alternatives-truncation bug already fixed in engine.js's decision log.
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we', 'ws'];
  const puzzle = tryDiscardPuzzle(hand);
  assert.notEqual(puzzle.bestTile, 'ws', 'this only tests something if ws is not itself the chosen best');

  const answer = checkDiscardAnswer(puzzle, 'ws');
  assert.equal(answer.correct, true);
});

test('checkDiscardAnswer rejects a tile that is not actually in the hand', () => {
  // Regression: indexOf() returns -1 for an unknown tile, and splice(-1, 1) would otherwise
  // silently remove the *last* tile in the hand and grade that instead of rejecting the input.
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
  const puzzle = tryDiscardPuzzle(hand);
  const answer = checkDiscardAnswer(puzzle, 'dg'); // not in the hand at all

  assert.equal(answer.correct, false);
  assert.equal(answer.shantenAfterChosen, null);
});

test('checkDiscardAnswer rejects a tile that leaves a worse shanten', () => {
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
  const puzzle = tryDiscardPuzzle(hand);
  const answer = checkDiscardAnswer(puzzle, 'we'); // breaks the pair instead of shedding b9

  assert.equal(answer.correct, false);
  assert.ok(answer.shantenAfterChosen > puzzle.shantenAfterBest);
});
