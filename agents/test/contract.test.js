// Contract test for the trust boundary the architecture rests on.
//
// The model-free review has two entry points — the frontend's offline `localReview()` and this
// package's `deterministicReview()` fallback. If they diverge, identical game history produces
// different coaching purely on deployment / network / model availability. They now share one
// implementation (frontend/src/game/reviewCore.js, re-exported via @kaki/game); this pins that,
// so an edit to either path that breaks the equality fails here.

import test from 'node:test';
import assert from 'node:assert/strict';

import { localReview } from '../../frontend/src/game/review.js';
import { deterministicReview } from '../src/review/deterministic.js';

const RULES = { dragonPong: true, halfFlush: true, limit: 5 };

const FIXTURES = {
  'empty log': [],
  'all optimal': [
    { type: 'discard', chosen: 'd5', recommended: 'd5', optimal: true },
    { type: 'claim', pendingTile: 'b7', chosen: null, recommended: null, optimal: true },
  ],
  'all sub-optimal': [
    { type: 'discard', chosen: 'we', recommended: 'd3', shantenAfterChosen: 3, shantenAfterRecommended: 2, reasons: ['Terminals join fewer runs than middle tiles.'], optimal: false },
    { type: 'discard', chosen: 'wn', recommended: 'b4', optimal: false },
  ],
  'mixed discards and claims': [
    { type: 'discard', chosen: 'd5', recommended: 'd5', optimal: true },
    { type: 'discard', chosen: 'we', recommended: 'd3', shantenAfterChosen: 3, shantenAfterRecommended: 2, reasons: ['It is a lone wind or dragon.'], optimal: false },
    { type: 'claim', pendingTile: 'b7', chosen: null, recommended: { type: 'pong', tiles: ['b7', 'b7', 'b7'] }, optimal: false },
    { type: 'claim', pendingTile: 'dr', chosen: { type: 'pong', tiles: ['dr', 'dr', 'dr'] }, recommended: { type: 'pong', tiles: ['dr', 'dr', 'dr'] }, optimal: true },
  ],
  'more than four sub-optimal (bullet cap)': Array.from({ length: 7 }, (_, i) => ({
    type: 'discard', chosen: 'we', recommended: `d${i + 1}`, optimal: false,
  })),
  'malformed entries mixed with valid ones': [
    null,
    42,
    'nope',
    { type: 'unknown' },
    { type: 'discard', chosen: 'd1', recommended: 'd1', optimal: true },
    { type: 'claim', pendingTile: 'ww', chosen: null, recommended: { type: 'pong', tiles: ['ww', 'ww', 'ww'] }, optimal: false },
  ],
};

for (const [name, decisions] of Object.entries(FIXTURES)) {
  test(`localReview and deterministicReview produce identical output: ${name}`, () => {
    assert.deepEqual(localReview(decisions, RULES), deterministicReview(decisions, RULES));
  });
}

test('both paths are well-formed for every fixture', () => {
  for (const decisions of Object.values(FIXTURES)) {
    const r = deterministicReview(decisions, RULES);
    assert.equal(typeof r.headline, 'string');
    assert.ok(Array.isArray(r.goodMoves) && r.goodMoves.length <= 4);
    assert.ok(Array.isArray(r.improvements) && r.improvements.length <= 4);
    assert.equal(typeof r.oneThingToTry, 'string');
    assert.equal(r.modelAssisted, false);
  }
});
