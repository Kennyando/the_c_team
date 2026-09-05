// Unit tests for the review pipeline. Bedrock is mocked for every case — nothing here touches
// the network or costs anything, the same convention as backend/test/classifyIntent.test.ts.

import test, { mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

import { runReview } from '../src/review/reviewHand.js';

// --- fixtures -------------------------------------------------------------------------------

const optimalDiscard = {
  type: 'discard',
  chosen: 'd5',
  recommended: 'd5',
  shantenBefore: 2,
  shantenAfterChosen: 2,
  shantenAfterRecommended: 2,
  reasons: [],
  optimal: true,
};

const badDiscard = {
  type: 'discard',
  chosen: 'we',
  recommended: 'd3',
  shantenBefore: 2,
  shantenAfterChosen: 3,
  shantenAfterRecommended: 2,
  reasons: ['Terminals join fewer runs than middle tiles.'],
  optimal: false,
};

const missedPong = {
  type: 'claim',
  pendingTile: 'b7',
  discardedBy: 2,
  options: [{ claim: { type: 'pong', tiles: ['b7', 'b7', 'b7'] }, verdict: 'yes', lines: ['helps'] }],
  chosen: null,
  recommended: { type: 'pong', tiles: ['b7', 'b7', 'b7'] },
  optimal: false,
};

const RULES = { dragonPong: true, halfFlush: true, limit: 5 };

const converse = (text) => ({ output: { message: { content: [{ text }] } } });
const validReview = JSON.stringify({
  headline: 'Solid hand — you kept your options open.',
  goodMoves: ['Held onto your Dots for the flush.'],
  improvements: ['The East Wind could have gone one turn earlier.'],
  oneThingToTry: 'Let lone winds go before the hand gets tight.',
});

afterEach(() => mock.restoreAll());

// --- tests ---------------------------------------------------------------------------------

test('empty decision log: deterministic, no model call', async () => {
  const send = mock.method(BedrockRuntimeClient.prototype, 'send', async () => converse(validReview));

  const result = await runReview({ decisions: [], rules: RULES });

  assert.equal(send.mock.callCount(), 0);
  assert.equal(result.modelAssisted, false);
  assert.match(result.headline, /no decisions/i);
});

test('useModel:false forces the deterministic review even with decisions present', async () => {
  const send = mock.method(BedrockRuntimeClient.prototype, 'send', async () => converse(validReview));

  const result = await runReview({ decisions: [optimalDiscard, badDiscard], rules: RULES, useModel: false });

  assert.equal(send.mock.callCount(), 0);
  assert.equal(result.modelAssisted, false);
  assert.equal(result.improvements.length, 1);
  assert.match(result.improvements[0], /stronger discard/i);
});

test('clean hand: deterministic review has no improvements', async () => {
  const result = await runReview({ decisions: [optimalDiscard, optimalDiscard], rules: RULES, useModel: false });

  assert.equal(result.improvements.length, 0);
  assert.match(result.headline, /clean hand/i);
  assert.equal(result.goodMoves.length, 2);
});

test('valid model reply is used verbatim and marked modelAssisted', async () => {
  const send = mock.method(BedrockRuntimeClient.prototype, 'send', async () => converse(validReview));

  const result = await runReview({ decisions: [optimalDiscard, badDiscard, missedPong], rules: RULES });

  assert.equal(send.mock.callCount(), 1);
  assert.equal(result.modelAssisted, true);
  assert.equal(result.headline, 'Solid hand — you kept your options open.');
  assert.equal(result.oneThingToTry, 'Let lone winds go before the hand gets tight.');
});

test('malformed model reply falls back to deterministic', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () => converse('sorry, I could not do that'));

  const result = await runReview({ decisions: [badDiscard], rules: RULES });

  assert.equal(result.modelAssisted, false);
  assert.match(result.improvements[0], /stronger discard/i);
});

test('schema-violating model reply (headline too long) falls back to deterministic', async () => {
  const tooLong = JSON.stringify({
    headline: 'x'.repeat(200),
    goodMoves: [],
    improvements: [],
    oneThingToTry: 'ok',
  });
  mock.method(BedrockRuntimeClient.prototype, 'send', async () => converse(tooLong));

  const result = await runReview({ decisions: [badDiscard], rules: RULES });

  assert.equal(result.modelAssisted, false);
});

test('Bedrock throwing falls back to deterministic without throwing', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () => {
    throw new Error('AccessDeniedException');
  });

  const result = await runReview({ decisions: [optimalDiscard, badDiscard], rules: RULES });

  assert.equal(result.modelAssisted, false);
  assert.match(result.headline, /coach/i);
});
