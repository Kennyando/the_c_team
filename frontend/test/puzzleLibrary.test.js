// The curated puzzle library: every entry is a valid, correctly-filed puzzle.
// Run with `npm test` from frontend/.
//
// PUZZLE_LIBRARY validates itself at import time (throwing on a degenerate hand or a
// wrong-tier entry) — these tests exist to make that validation part of `npm test`'s pass/fail
// signal, rather than something that only surfaces if someone happens to import the module.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tryDiscardPuzzle } from '../src/game/puzzles.js';
import { PUZZLE_LIBRARY } from '../src/game/puzzleLibrary.js';

const TIERS = ['easy', 'medium', 'hard'];

test('the library has exactly 3 puzzles in each of easy, medium, and hard', () => {
  assert.deepEqual(Object.keys(PUZZLE_LIBRARY).sort(), TIERS.slice().sort());
  for (const tier of TIERS) assert.equal(PUZZLE_LIBRARY[tier].length, 3, tier);
});

test('every puzzle has a unique id and a 14-tile hand', () => {
  const ids = new Set();
  for (const tier of TIERS) {
    for (const puzzle of PUZZLE_LIBRARY[tier]) {
      assert.equal(ids.has(puzzle.id), false, `duplicate id ${puzzle.id}`);
      ids.add(puzzle.id);
      assert.equal(puzzle.hand.length, 14, puzzle.id);
    }
  }
});

test('every puzzle is filed under the tier tryDiscardPuzzle() actually assigns it', () => {
  for (const tier of TIERS) {
    for (const puzzle of PUZZLE_LIBRARY[tier]) {
      const derived = tryDiscardPuzzle(puzzle.hand);
      assert.ok(derived, `${puzzle.id} should not be a degenerate hand`);
      assert.equal(derived.difficulty, tier, puzzle.id);
      assert.equal(puzzle.bestTile, derived.bestTile);
    }
  }
});

test('every discard in a puzzle names a real seat other than the human', () => {
  for (const tier of TIERS) {
    for (const puzzle of PUZZLE_LIBRARY[tier]) {
      assert.ok(puzzle.discards.length > 0, `${puzzle.id} should look like a mid-hand position`);
      for (const { by } of puzzle.discards) {
        assert.ok([1, 2, 3].includes(by), `${puzzle.id}: discard "by" seat ${by} should be an opponent`);
      }
    }
  }
});
