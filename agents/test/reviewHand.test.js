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

// The standard 3-decision hand used below: fact d0 = [good], d1 = [improve], d2 = [improve].
const HAND = [optimalDiscard, badDiscard, missedPong];

const converse = (text) => ({ output: { message: { content: [{ text }] } } });
const mockReply = (obj) => mock.method(BedrockRuntimeClient.prototype, 'send', async () => converse(JSON.stringify(obj)));

// A well-grounded reply for HAND: one good bullet on d0, two improve bullets on d1 and d2, and a
// oneThingToTry Item that reuses d1 (a focus naturally restates a fix a bullet already made).
const groundedReply = {
  headline: 'Solid hand — you kept your options open.',
  goodMoves: [{ ref: 'd0', text: 'You threw the tile the coach would have picked.' }],
  improvements: [
    { ref: 'd1', text: 'The East Wind could have gone a turn earlier.' },
    { ref: 'd2', text: 'That pong on 7 Bamboo was worth taking.' },
  ],
  oneThingToTry: { ref: 'd1', text: 'Let lone winds go before the hand gets tight.' },
};

afterEach(() => mock.restoreAll());

// --- deterministic path (unchanged) ------------------------------------------------------------

test('empty decision log: deterministic, no model call', async () => {
  const send = mockReply(groundedReply);
  const result = await runReview({ decisions: [], rules: RULES });
  assert.equal(send.mock.callCount(), 0);
  assert.equal(result.modelAssisted, false);
  assert.match(result.headline, /no decisions/i);
});

test('useModel:false forces the deterministic review even with decisions present', async () => {
  const send = mockReply(groundedReply);
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

// --- model path: shape + parsing -------------------------------------------------------------

test('a well-grounded model reply is used, refs stripped, marked modelAssisted', async () => {
  const send = mockReply(groundedReply);
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(send.mock.callCount(), 1);
  assert.equal(result.modelAssisted, true);
  assert.equal(result.headline, 'Solid hand — you kept your options open.');
  assert.deepEqual(result.goodMoves, ['You threw the tile the coach would have picked.']);
  assert.equal(result.improvements.length, 2);
  assert.equal(typeof result.improvements[0], 'string'); // {ref,text} collapsed to text
  assert.equal(result.oneThingToTry, 'Let lone winds go before the hand gets tight.'); // from .text
});

test('a reply wrapped in a ```json fence is still parsed and used', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () =>
    converse('```json\n' + JSON.stringify(groundedReply) + '\n```'),
  );
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, true);
});

test('malformed (non-JSON) model reply falls back to deterministic', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () => converse('sorry, I could not do that'));
  const result = await runReview({ decisions: [badDiscard], rules: RULES });
  assert.equal(result.modelAssisted, false);
  assert.match(result.improvements[0], /stronger discard/i);
});

test('the old bare-string bullet shape no longer validates — falls back', async () => {
  const send = mockReply({
    headline: 'Nice hand.',
    goodMoves: ['You threw the right tile.'], // strings, not {ref,text}
    improvements: ['East Wind could have gone sooner.'],
    oneThingToTry: 'Slow down.',
  });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(send.mock.callCount(), 1);
  assert.equal(result.modelAssisted, false);
});

test('schema-violating reply (headline too long) falls back', async () => {
  const send = mockReply({ headline: 'x'.repeat(200), goodMoves: [], improvements: [], oneThingToTry: 'ok' });
  const result = await runReview({ decisions: [badDiscard], rules: RULES });
  assert.equal(send.mock.callCount(), 1);
  assert.equal(result.modelAssisted, false);
});

// --- per-item grounding -------------------------------------------------------------------------

test('an improvements bullet citing an unknown fact id falls back', async () => {
  mockReply({
    ...groundedReply,
    improvements: [{ ref: 'd9', text: 'A mistake that does not exist.' }],
  });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, false);
});

test('a goodMoves bullet citing a decision the engine graded sub-optimal falls back', async () => {
  mockReply({
    ...groundedReply,
    goodMoves: [{ ref: 'd1', text: 'Praising the East Wind discard, which was a mistake.' }],
    improvements: [{ ref: 'd2', text: 'The pong was worth taking.' }],
  });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, false);
});

test('an improvements bullet citing a decision the engine graded optimal falls back', async () => {
  mockReply({
    ...groundedReply,
    goodMoves: [],
    improvements: [{ ref: 'd0', text: 'Criticising the discard the coach would have made.' }],
  });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, false);
});

test('citing the same decision twice (padding) falls back', async () => {
  mockReply({
    ...groundedReply,
    improvements: [
      { ref: 'd1', text: 'The East Wind was loose.' },
      { ref: 'd1', text: 'The East Wind, again, phrased differently.' },
    ],
  });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, false);
});

test('empty goodMoves/improvements are fine as long as what is present is grounded', async () => {
  mockReply({
    headline: 'A couple of things to tidy up.',
    goodMoves: [],
    improvements: [{ ref: 'd1', text: 'Let the East Wind go sooner next time.' }],
    oneThingToTry: { ref: 'd2', text: 'Shed lone winds early.' },
  });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, true);
  assert.equal(result.goodMoves.length, 0);
  assert.equal(result.improvements.length, 1);
});

test('oneThingToTry citing an unknown fact id falls back', async () => {
  mockReply({ ...groundedReply, oneThingToTry: { ref: 'd9', text: 'Focus on a move that never happened.' } });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, false);
});

test('oneThingToTry citing a decision the engine graded optimal falls back', async () => {
  mockReply({ ...groundedReply, oneThingToTry: { ref: 'd0', text: 'Focus on the discard you already got right.' } });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, false);
});

test('oneThingToTry as a bare string falls back when the hand has mistakes', async () => {
  mockReply({ ...groundedReply, oneThingToTry: 'Some ungrounded strategic advice.' });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, false);
});

test('oneThingToTry may reuse a decision an improvements bullet already cited', async () => {
  // improvements cites d1 and d2; oneThingToTry points back at d2 — allowed, not padding.
  mockReply({ ...groundedReply, oneThingToTry: { ref: 'd2', text: 'Take the pong when it clearly helps.' } });
  const result = await runReview({ decisions: HAND, rules: RULES });
  assert.equal(result.modelAssisted, true);
  assert.equal(result.oneThingToTry, 'Take the pong when it clearly helps.');
});

test('clean hand: model reply is accepted, oneThingToTry is the deterministic focus', async () => {
  // No [improve] facts to cite — the model's takeaway is dropped for the deterministic one.
  mockReply({
    headline: 'Lovely — every move matched the coach.',
    goodMoves: [
      { ref: 'd0', text: 'You threw exactly what the coach would have.' },
      { ref: 'd1', text: 'And again on the next discard.' },
    ],
    improvements: [],
    oneThingToTry: 'Keep playing exactly like that.',
  });
  const clean = [optimalDiscard, optimalDiscard];
  const result = await runReview({ decisions: clean, rules: RULES });
  const deterministic = await runReview({ decisions: clean, rules: RULES, useModel: false });
  assert.equal(result.modelAssisted, true);
  assert.equal(result.goodMoves.length, 2);
  assert.equal(result.oneThingToTry, deterministic.oneThingToTry);
});

// --- infrastructure failure ----------------------------------------------------------------

test('Bedrock throwing falls back to deterministic without throwing', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () => {
    throw new Error('AccessDeniedException');
  });
  const result = await runReview({ decisions: [optimalDiscard, badDiscard], rules: RULES });
  assert.equal(result.modelAssisted, false);
  assert.match(result.headline, /coach/i);
});
