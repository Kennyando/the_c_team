// Discard puzzles: generation, rejection of degenerate hands, and answer checking.
// Run with `npm test` from frontend/.

import test from 'node:test';
import assert from 'node:assert/strict';

import { bestDiscard } from '../src/game/advisor.js';
import { isBonus } from '../src/game/tiles.js';
import { tryDiscardPuzzle, generateDiscardPuzzle, checkDiscardAnswer } from '../src/game/puzzles.js';

test('an already-complete hand is rejected — there is nothing to discard toward', () => {
  const winning = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we', 'we'];
  assert.equal(tryDiscardPuzzle(winning), null);
});

test('a hand where every discard leaves the same shanten is rejected — nothing to teach', () => {
  // 14 tiles spaced 3 ranks apart in every suit, plus every honour: no two are close enough to
  // form a run or a pair, so discarding any one of them leaves the same (maximum) distance.
  const scattered = ['d1', 'd4', 'd7', 'b1', 'b4', 'b7', 'c1', 'c4', 'c7', 'we', 'ws', 'ww', 'wn', 'dr'];
  assert.equal(tryDiscardPuzzle(scattered), null);
});

test('an ordinary hand becomes a puzzle matching bestDiscard() directly', () => {
  // Same hand as advisor.test's "bestDiscard picks the dead tile and says why".
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
  const rec = bestDiscard({ hand, melds: [] });

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
  assert.equal(puzzle.tieCount, 11);
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

test('generateDiscardPuzzle() always returns a well-formed puzzle or null', () => {
  for (let i = 0; i < 50; i++) {
    const puzzle = generateDiscardPuzzle();
    if (!puzzle) continue; // astronomically unlikely, but tryDiscardPuzzle() is allowed to say no
    assert.equal(puzzle.hand.length, 14);
    assert.ok(puzzle.hand.every((t) => !isBonus(t)), 'a puzzle hand should never contain a bonus tile');
    assert.ok(puzzle.hand.includes(puzzle.bestTile), 'the best tile must actually be in the hand');
  }
});

test('generateDiscardPuzzle(difficulty) always returns a puzzle of the requested tier', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 20; i++) {
      const puzzle = generateDiscardPuzzle(difficulty);
      assert.ok(puzzle, `should find an '${difficulty}' puzzle within the retry budget`);
      assert.equal(puzzle.difficulty, difficulty);
    }
  }
});
