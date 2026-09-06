// Unit tests for the coach agent (src/coach/coachAnswer.js) and its context builder. Bedrock is
// mocked in every case — nothing here touches the network or costs anything, the same convention
// as reviewHand.test.js.

import test, { mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

import { runCoachAnswer } from '../src/coach/coachAnswer.js';
import { coachContext, renderFact, relevantFacts } from '../src/context/coachContext.js';

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

// f2 (wall count) and f3 (hand distance) are always emitted for POSITION; f5 is the discard pick.
const goodReply = {
  answer: [
    { refs: ['f3'], text: 'You are one tile from winning — hold steady.' },
    { refs: ['f5'], text: 'If you must let one go, the coach likes 8 Characters.' },
  ],
};

afterEach(() => mock.restoreAll());

// --- no model / opted out ----------------------------------------------------------------------

test('an empty question returns the deterministic answer, no model call', async () => {
  const send = mockReply(goodReply);
  const result = await runCoachAnswer({ position: POSITION, question: '  ' });
  assert.equal(send.mock.callCount(), 0);
  assert.equal(result.modelAssisted, false);
  assert.ok(result.lines.length > 0);
});

test('useModel:false returns the deterministic answer, no model call', async () => {
  const send = mockReply(goodReply);
  const result = await runCoachAnswer({ position: POSITION, question: 'what should I do', useModel: false });
  assert.equal(send.mock.callCount(), 0);
  assert.equal(result.modelAssisted, false);
});

// --- model path --------------------------------------------------------------------------------

test('a well-formed, grounded reply is used and marked modelAssisted', async () => {
  const send = mockReply(goodReply);
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close to winning?' });
  assert.equal(send.mock.callCount(), 1);
  assert.equal(result.modelAssisted, true);
  assert.equal(result.title, 'Coach');
  assert.deepEqual(result.lines, goodReply.answer.map((l) => l.text));
});

test('the model prompt lists the facts by id and asks for citations', async () => {
  const send = mockReply(goodReply);
  await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  const userPrompt = send.mock.calls[0].arguments[0].input.messages[0].content[0].text;
  assert.match(userPrompt, /cite these by id/);
  assert.match(userPrompt, /^f0: /m);
  assert.match(userPrompt, /QUESTION: am I close\?/);
  // Every fact rendered to a real sentence — no `undefined` / `[object Object]` from a missed type.
  assert.doesNotMatch(userPrompt, /undefined|\[object Object\]/);
});

test('a reply wrapped in a ```json fence is still parsed and used', async () => {
  mock.method(BedrockRuntimeClient.prototype, 'send', async () =>
    converse('```json\n' + JSON.stringify(goodReply) + '\n```'),
  );
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(result.modelAssisted, true);
});

// --- grounding: cited ids must resolve to real facts ----------------------------------------

test('a line citing a fact id that does not exist drops the whole reply', async () => {
  mockReply({ answer: [{ refs: ['f99'], text: 'A rule I just made up.' }] });
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(result.modelAssisted, false);
});

test('one grounded line and one ungrounded line drops the whole reply', async () => {
  mockReply({
    answer: [
      { refs: ['f3'], text: 'You are one tile from winning.' },
      { refs: ['f3', 'f42'], text: 'And a half flush pays six here.' },
    ],
  });
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(result.modelAssisted, false);
});

test('citing a fact the question filtered out of the prompt drops the reply', async () => {
  // "what should I discard" keeps the discardPick fact (f5) and drops the handValue fact (f6),
  // so a line citing f6 is citing something the model was never shown.
  mockReply({ answer: [{ refs: ['f6'], text: 'This hand is worth a lot.' }] });
  const result = await runCoachAnswer({ position: POSITION, question: 'what should I discard here' });
  assert.equal(result.modelAssisted, false);
});

// --- grounding: no unsupported scoring pattern --------------------------------------------------

test('a line naming a scoring pattern this table does not play drops the reply', async () => {
  // POSITION plays dragonPong + halfFlush, NOT fullFlush.
  mockReply({ answer: [{ refs: ['f3'], text: 'You could push for a full flush from here.' }] });
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(result.modelAssisted, false);
});

test('a line naming a pattern the table does play is fine', async () => {
  mockReply({ answer: [{ refs: ['f0'], text: 'A half flush is on the table here, worth chasing.' }] });
  const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
  assert.equal(result.modelAssisted, true);
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
    { answer: ['a bare string, the old shape'] },
    { answer: [{ text: 'no refs field' }] },
    { answer: [{ refs: [], text: 'empty refs' }] },
    { answer: [{ refs: ['f0'], text: '' }] },
    { answer: [{ refs: [1, 2], text: 'refs must be strings' }] },
    { answer: [{ refs: ['f0'], text: 'x'.repeat(200) }] },
    { answer: [] },
    { reply: [{ refs: ['f0'], text: 'wrong key' }] },
  ]) {
    mock.restoreAll();
    mockReply(bad);
    const result = await runCoachAnswer({ position: POSITION, question: 'am I close?' });
    assert.equal(result.modelAssisted, false, JSON.stringify(bad));
  }
});

test('more than three lines falls back', async () => {
  mockReply({ answer: [1, 2, 3, 4].map((n) => ({ refs: ['f2'], text: `line ${n}` })) });
  const result = await runCoachAnswer({ position: POSITION, question: 'tell me everything' });
  assert.equal(result.modelAssisted, false);
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

// --- coachContext: structured facts --------------------------------------------------------

test('facts are structured objects (id + type + data), not English strings, and every type renders', () => {
  const { facts } = coachContext(POSITION);
  assert.deepEqual(
    facts.map((f) => f.id),
    facts.map((_, i) => `f${i}`),
  );
  for (const f of facts) {
    assert.equal(typeof f.type, 'string');
    assert.equal(f.text, undefined, `fact ${f.id} should carry structured data, not a text string`);
    assert.ok(renderFact(f).length > 0, `renderFact has no case for ${f.type}`);
  }
  // Spot-check a couple of payloads by field, no string matching.
  const distance = facts.find((f) => f.type === 'distance');
  assert.equal(distance.shanten, 0); // POSITION is a ready hand
  const rules = facts.find((f) => f.type === 'rules');
  assert.ok(Array.isArray(rules.active) && typeof rules.limit === 'number');
});

test('coachContext emits one structured fact per claim option', () => {
  const claimPosition = {
    ...POSITION,
    hand: ['b3', 'b4', 'b6', 'b7', 'c1', 'c2', 'c3', 'd4', 'd5', 'd6', 'we', 'we', 'ws'],
    phase: 'claim',
    turn: 2,
    pending: { tile: 'b5', by: 1 },
    // Two chow shapes for b5 (b3-b4-b5 and b5-b6-b7).
    claimOptions: [
      { type: 'chow', tiles: ['b3', 'b4', 'b5'], seat: 0 },
      { type: 'chow', tiles: ['b5', 'b6', 'b7'], seat: 0 },
    ],
  };
  const claims = coachContext(claimPosition).facts.filter((f) => f.type === 'claimOption');
  assert.equal(claims.length, 2, 'both chow options should be represented');
  assert.deepEqual(claims.map((f) => f.tiles).sort(), [
    ['b3', 'b4', 'b5'],
    ['b5', 'b6', 'b7'],
  ]);
  for (const c of claims) {
    assert.equal(c.claimType, 'chow');
    assert.equal(c.onTile, 'b5');
    assert.ok(['yes', 'no'].includes(c.verdict));
    assert.equal(typeof c.advice, 'string');
  }
});

test('the rules fact carries the active rule keys for scoring-claim checks', () => {
  const rules = coachContext(POSITION).facts.find((f) => f.type === 'rules');
  assert.deepEqual(rules.keys.sort(), ['dragonPong', 'halfFlush']);
});

// --- relevantFacts: narrow the situational facts to the question --------------------------------

test('relevantFacts keeps core facts always and narrows the situational ones by question', () => {
  const { facts } = coachContext(POSITION); // has discardPick (f5) and handValue (f6)
  const core = ['rules', 'seat', 'wall', 'distance', 'waits'];

  const forValue = relevantFacts(facts, 'roughly how much is this hand worth');
  assert.deepEqual(
    forValue.map((f) => f.type),
    [...core, 'handValue'],
  );

  const forDiscard = relevantFacts(facts, 'which tile should I throw');
  assert.deepEqual(
    forDiscard.map((f) => f.type),
    [...core, 'discardPick'],
  );

  // Nothing situational clearly matches -> keep everything (this agent runs on unplaceable
  // questions, so dropping a fact we might have needed is the worse failure).
  const forVague = relevantFacts(facts, 'what is going on');
  assert.deepEqual(forVague, facts);

  // Ids are never renumbered by filtering.
  assert.deepEqual(forValue.map((f) => f.id), ['f0', 'f1', 'f2', 'f3', 'f4', 'f6']);
});
