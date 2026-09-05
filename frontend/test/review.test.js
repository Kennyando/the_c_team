// Post-hand review: the offline local summary, and the network wrapper's fallback behaviour.

import test from 'node:test';
import assert from 'node:assert/strict';

import { localReview, postHandReview } from '../src/game/review.js';

const optimalDiscard = { type: 'discard', chosen: 'd5', recommended: 'd5', optimal: true };
const badDiscard = {
  type: 'discard',
  chosen: 'we',
  recommended: 'd3',
  shantenAfterChosen: 3,
  shantenAfterRecommended: 2,
  reasons: ['Terminals join fewer runs than middle tiles.'],
  optimal: false,
};
const missedPong = {
  type: 'claim',
  pendingTile: 'b7',
  chosen: null,
  recommended: { type: 'pong', tiles: ['b7', 'b7', 'b7'] },
  optimal: false,
};

const wellFormed = (r) =>
  r &&
  typeof r.headline === 'string' &&
  Array.isArray(r.goodMoves) &&
  Array.isArray(r.improvements) &&
  typeof r.oneThingToTry === 'string';

test('localReview on an empty decision log is well-formed and says there is nothing to review', () => {
  const r = localReview([], {});
  assert.ok(wellFormed(r));
  assert.equal(r.modelAssisted, false);
  assert.match(r.headline, /no decisions/i);
  assert.deepEqual(r.improvements, []);
});

test('localReview on a clean hand reports no improvements', () => {
  const r = localReview([optimalDiscard, optimalDiscard], {});
  assert.match(r.headline, /clean hand/i);
  assert.equal(r.improvements.length, 0);
  assert.equal(r.goodMoves.length, 2);
});

test('localReview surfaces a sub-optimal discard with the better tile and the reason', () => {
  const r = localReview([optimalDiscard, badDiscard], {});
  assert.equal(r.improvements.length, 1);
  assert.match(r.improvements[0], /Discarded East Wind; 3 Dots was the stronger discard/);
  assert.match(r.improvements[0], /Terminals join fewer runs/);
  assert.match(r.oneThingToTry, /discard/i);
});

test('localReview surfaces a missed call and points the advice at calling', () => {
  const r = localReview([missedPong], {});
  assert.match(r.improvements[0], /calling pong would have moved your hand forward/i);
  assert.match(r.oneThingToTry, /call/i);
});

test('postHandReview with no URL configured returns the local review, no network', async () => {
  const r = await postHandReview([optimalDiscard, badDiscard], {}, { reviewUrl: undefined });
  assert.ok(wellFormed(r));
  assert.equal(r.modelAssisted, false);
});

test('postHandReview falls back to local on a non-2xx response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({}) });
  try {
    const r = await postHandReview([badDiscard], {}, { reviewUrl: 'https://example.invalid/review' });
    assert.ok(wellFormed(r));
    assert.equal(r.modelAssisted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postHandReview uses a well-formed model review when the endpoint returns one', async () => {
  const modelReview = {
    headline: 'Nice steady hand.',
    goodMoves: ['You kept your Dots together.'],
    improvements: ['Let the East Wind go sooner.'],
    oneThingToTry: 'Drop lone honours early.',
    modelAssisted: true,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ review: modelReview }) });
  try {
    const r = await postHandReview([badDiscard], {}, { reviewUrl: 'https://example.invalid/review' });
    assert.deepEqual(r, modelReview);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postHandReview falls back to local when the endpoint returns a malformed body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ review: { headline: 'x' } }) });
  try {
    const r = await postHandReview([badDiscard], {}, { reviewUrl: 'https://example.invalid/review' });
    assert.equal(r.modelAssisted, false);
    assert.match(r.improvements[0], /stronger discard/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
