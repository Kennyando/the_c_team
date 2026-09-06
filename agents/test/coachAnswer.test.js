// Unit tests for the coach agent (src/coach/coachAnswer.js). Bedrock is mocked in every case —
// nothing here touches the network or costs anything, the same convention as reviewHand.test.js.

import test, { mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

import { runCoachAnswer } from '../src/coach/coachAnswer.js';

// --- fixtures -------------------------------------------------------------------------------

// A ready hand (three runs, a pair, c7c8 waiting on c6/c9), your turn to discard.
const POSITION = {
  hand: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we'],
  melds: [[], [], [], []],
  bonus: [[], [], [], []],
  discards: [{ tile: 'dr', by: 1 }],
  wallCount: 70,
  turn: 0,
  phase: 'act',
  dealer: 0,
  prevailingWind: 'we',
  rules: { dragonPong: true, halfFlush: true, limit: 5 },
  claimOptions: [],
  pending: null,
};

const converse = (text) => ({ output: { message: { content: [{ text }] } } });
const mockReply = (obj) =>
  mock.method(BedrockRuntimeClient.prototype, 'send', async () =>
    converse(typeof obj === 'string' ? obj : JSON.stringify(obj)),
  );

const goodReply = { answer: ['You are one tile from winning — hold steady.', 'Waiting on 6 or 9 Circles.'] };

afterEach(() => mock.restoreAll());

// --- no model / opted out ----------------------------------------------------------------------

test('an empty question returns the deterministic answer, no model call', async () => {
  const send = mockReply(goodReply);
  const result = await runCoachAnswer({ position: POSITION, question: '  ' });
  assert.equal(send.mock.callCount(), 0);
  assert.equal(result.modelAssisted, false);
  assert.equal(typeof result.title, 'string');
  assert.ok(result.lines.length > 0);
});

test('useModel:false returns the deterministic answer, no model call', async () => {
  const send = mockReply(goodReply);
  const result = await runCoachAnswer({ position: POSITION, question: 'what should I do', useModel: false });
  assert.equal(send.mock.callCount(), 0);
  assert.equal(result.modelAssisted, false);
});

// --- model path --------------------------------------------------------------------------------

test('a well-formed model reply is used and marked modelAssisted', async () => {
  const send = mockReply(goodReply);
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close to winning?' });
  assert.equal(send.mock.callCount(), 1);
  assert.equal(result.modelAssisted, true);
  assert.equal(result.title, 'Coach');
  assert.deepEqual(result.lines, goodReply.answer);
});

test('the model prompt is built from position FACTS plus the question', async () => {
  const send = mockReply(goodReply);
  await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  const userPrompt = send.mock.calls[0].arguments[0].input.messages[0].content[0].text;
  assert.match(userPrompt, /FACTS:/);
  assert.match(userPrompt, /QUESTION: am I close\?/);
  assert.match(userPrompt, /tiles are left in the wall/); // a fact coachContext always emits
});

test('a reply wrapped in a ```json fence is still parsed and used', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () =>
    converse('```json\n' + JSON.stringify(goodReply) + '\n```'),
  );
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(result.modelAssisted, true);
});

test('lines are trimmed and capped at three', async () => {
  mockReply({ answer: ['  one  ', 'two', 'three', 'four'] });
  const result = await runCoachAnswer({ position: POSITION, question: 'tell me everything' });
  // Four lines fails the shape check (max 3) -> deterministic fallback.
  assert.equal(result.modelAssisted, false);
});

// --- bad output -> deterministic fallback -----------------------------------------------------

test('a non-JSON reply falls back to the deterministic answer', async () => {
  const send = mockReply('sorry, I cannot help with that');
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(send.mock.callCount(), 1);
  assert.equal(result.modelAssisted, false);
});

test('a reply with the wrong shape falls back', async () => {
  for (const bad of [
    { answer: 'a single string, not an array' },
    { answer: [] },
    { answer: ['', '  '] },
    { answer: [42] },
    { answer: ['x'.repeat(200)] },
    { reply: ['wrong key'] },
  ]) {
    mock.restoreAll();
    mockReply(bad);
    const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
    assert.equal(result.modelAssisted, false, JSON.stringify(bad));
  }
});

// --- infrastructure failure -----------------------------------------------------------------

test('Bedrock throwing falls back to deterministic without throwing', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () => {
    throw new Error('AccessDeniedException');
  });
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(result.modelAssisted, false);
  assert.ok(result.lines.length > 0);
});

test('a malformed position does not throw — it still answers', async () => {
  mockReply(goodReply);
  const result = await runCoachAnswer({ position: { hand: 'not an array', rules: null }, question: 'help' });
  assert.ok(result.lines.length > 0);
});
