// Help coach: the position maths, the question routing, and the brevity requirement.

import test from 'node:test';
import assert from 'node:assert/strict';

import { tileName } from '../src/game/tiles.js';
import { newGame, discardTile } from '../src/game/engine.js';
import { DEFAULT_RULES } from '../src/game/scoring.js';
import {
  shanten, waits, bestDiscard, claimAdvice, handSummary, describeDistance, situationHint,
} from '../src/game/advisor.js';
import { ask, INTENTS, QUICK_QUESTIONS, STATIC_ANSWERS, MAX_LINES, MAX_LINE_LENGTH } from '../src/game/coach.js';

const rules = { ...DEFAULT_RULES };
const player = (hand, melds = [], bonus = []) => ({ seat: 0, hand, melds, bonus, points: 0 });

// --- position maths ---------------------------------------------------------

test('shanten reads a complete hand as done and a ready hand as one away', () => {
  const complete = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we', 'we'];
  assert.equal(shanten(complete, []), -1);

  // Same hand minus c9: three sets, a pair, and c7c8 waiting on c6 or c9.
  const ready = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we'];
  assert.equal(shanten(ready, []), 0);

  // Four sets and a lone tile, waiting to pair it up.
  const readyOnPair = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we'];
  assert.equal(shanten(readyOnPair, []), 0);
});

test('shanten counts exposed melds toward the four sets', () => {
  const melds = [{ type: 'pong', tiles: ['dr', 'dr', 'dr'] }, { type: 'kong', tiles: ['b5', 'b5', 'b5', 'b5'] }];
  assert.equal(shanten(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'we', 'we'], melds), -1);
  // One set short of complete.
  assert.equal(shanten(['d1', 'd2', 'd3', 'd4', 'd6', 'we', 'we'], melds), 0);
});

test('a hand with nothing connected sits at the maximum distance', () => {
  const scattered = ['we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw', 'd1', 'd4', 'd7', 'b2', 'b5', 'c8'];
  assert.equal(shanten(scattered, []), 8);
});

test('waits lists exactly the tiles that finish the hand', () => {
  const ready = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we']);
  assert.deepEqual(waits(ready), ['c6', 'c9']);

  const notReady = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b9', 'c7', 'c8', 'we', 'we']);
  assert.deepEqual(waits(notReady), []);
});

test('bestDiscard picks the dead tile and says why', () => {
  // Everything works together except b9, which touches nothing.
  const p = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9']);
  const advice = bestDiscard(p);
  assert.equal(advice.tile, 'b9');
  assert.equal(advice.shantenAfter, 0); // discarding it leaves you ready
  assert.ok(advice.reasons.length > 0, 'advice should explain itself');
  assert.ok(advice.reasons.some((r) => /nothing next to it/i.test(r)));
});

test('bestDiscard keeps a pair over a lone honour', () => {
  const p = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c7', 'we', 'we', 'dg']);
  const advice = bestDiscard(p);
  assert.equal(advice.tile, 'dg', 'the lone green dragon should go, not half a pair');
});

test('claim advice recommends a call that helps and declines one that does not', () => {
  // Ponging c7 completes a set and moves the hand forward.
  const helped = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c7', 'we', 'we']);
  const good = claimAdvice(helped, { type: 'pong', tiles: ['c7', 'c7', 'c7'] });
  assert.equal(good.verdict, 'yes');
  assert.match(good.lines[0], /^Yes/);

  // Already ready, waiting on c6/c9. Ponging the dragon pair costs the eyes and gains nothing.
  const wasteful = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'dg', 'dg']);
  const bad = claimAdvice(wasteful, { type: 'pong', tiles: ['dg', 'dg', 'dg'] }, 'dg');
  assert.equal(bad.verdict, 'no');

  const winning = claimAdvice(helped, { type: 'win', tiles: ['c7'] }, 'c7');
  assert.equal(winning.verdict, 'yes');
});

test('a chow is modelled on the right tiles wherever the claimed one sits', () => {
  // getClaimsFor returns chow tiles in rank order, so the claimed tile is often the middle one.
  const p = player(['d1', 'd2', 'd3', 'b4', 'b6', 'c1', 'c1', 'c2', 'c3', 'we', 'we', 'ws', 'ww']);
  const advice = claimAdvice(p, { type: 'chow', tiles: ['b4', 'b5', 'b6'] }, 'b5');
  // b4 and b6 are both in hand, so this call is possible and must not be refused.
  assert.doesNotMatch(advice.lines[0], /do not hold/);

  // Claiming a tile the hand cannot support is refused rather than answered with nonsense.
  const cannot = claimAdvice(p, { type: 'pong', tiles: ['dg', 'dg', 'dg'] }, 'dg');
  assert.equal(cannot.verdict, 'no');
  assert.match(cannot.lines[0], /do not hold/);
});

test('claim advice always mentions what calling costs', () => {
  const p = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c7', 'we', 'we']);
  const pong = claimAdvice(p, { type: 'pong', tiles: ['c7', 'c7', 'c7'] });
  assert.ok(pong.lines.some((l) => /face up/i.test(l)));

  const chow = claimAdvice(p, { type: 'chow', tiles: ['d4', 'd5', 'd6'] });
  assert.ok(chow.lines.some((l) => /left/i.test(l)), 'chow advice must mention the left-hand rule');
});

test('handSummary scores a ready hand under the live house rules', () => {
  const state = newGame(rules, 0);
  state.players[0] = player(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we']);
  const summary = handSummary(state.players[0], state);

  assert.equal(summary.distance, 0);
  assert.deepEqual(summary.waits, ['c6', 'c9']);
  assert.ok(summary.best, 'a ready hand should have a best winning tile');
  assert.ok(summary.best.score.tai >= 0);
});

test('describeDistance reads naturally at every step', () => {
  assert.equal(describeDistance(-1), 'a complete hand');
  assert.equal(describeDistance(0), 'one tile from winning');
  assert.equal(describeDistance(2), '3 tiles from winning');
});

// --- question routing -------------------------------------------------------

const state = () => newGame(rules, 0);

test('rule questions reach the right rule', () => {
  const cases = [
    ['what does pong do?', 'rules.pong'],
    ['when can I chow', 'rules.chow'],
    ['whats a kong', 'rules.kong'],
    ['how do I win', 'rules.win'],
    ['what are flowers for', 'rules.flowers'],
    ['what is the limit hand', 'rules.limit'],
    ['how many tiles are left in the wall', 'rules.wall'],
    ['which wind am I', 'rules.seat'],
    ['who is the dealer', 'rules.dealer'],
  ];
  for (const [question, expected] of cases) {
    assert.equal(ask(question, state()).intent, expected, `"${question}"`);
  }
});

test('the words players actually use are understood', () => {
  assert.equal(ask('what is peng', state()).intent, 'rules.pong');
  assert.equal(ask('can i chi that', state()).intent, 'rules.chow');
  assert.equal(ask('explain gang', state()).intent, 'rules.kong');
});

test('asking about this position beats the general rule for the same word', () => {
  // "pong" appears in both, but one is asking for advice and the other for the rule.
  assert.equal(ask('should I pong this?', state()).intent, 'advice.claim');
  assert.equal(ask('what does pong do?', state()).intent, 'rules.pong');
});

test('position questions route to the advisor', () => {
  assert.equal(ask('what should I discard?', state()).intent, 'advice.discard');
  assert.equal(ask('what is the best play here', state()).intent, 'advice.discard');
  assert.equal(ask('how close am I?', state()).intent, 'advice.progress');
  assert.equal(ask('what is my hand worth', state()).intent, 'advice.value');
});

test('an unrecognised question offers help instead of failing', () => {
  const answer = ask('what is the weather like', state());
  assert.equal(answer.intent, 'fallback');
  assert.ok(answer.lines.length > 0);
  assert.match(answer.lines.join(' '), /pong|discard/i);

  assert.equal(ask('', state()).lines.length > 0, true);
  assert.equal(ask(null, state()).lines.length > 0, true);
});

test('every quick question resolves to a real answer, not the fallback', () => {
  for (const question of QUICK_QUESTIONS) {
    const answer = ask(question, state());
    assert.notEqual(answer.intent, 'fallback', `quick question missed: "${question}"`);
    assert.ok(answer.title && answer.lines.length, `empty answer for "${question}"`);
  }
});

test('advice is refused politely when it is not your turn', () => {
  const s = state();
  s.turn = 2;
  s.phase = 'act';
  const answer = ask('what should I discard?', s);
  assert.match(answer.title, /not your turn/i);
});

// --- brevity ----------------------------------------------------------------

test('every answer stays short enough to read at a glance', () => {
  const check = (answer, label) => {
    assert.ok(answer.lines.length <= MAX_LINES, `${label}: ${answer.lines.length} lines, max ${MAX_LINES}`);
    for (const line of answer.lines) {
      assert.ok(line.length <= MAX_LINE_LENGTH, `${label}: line too long (${line.length}) — "${line}"`);
    }
    assert.ok(answer.title.length <= 40, `${label}: title too long`);
  };

  for (const [key, answer] of Object.entries(STATIC_ANSWERS)) check(answer, `static.${key}`);

  // The computed answers too, against a real dealt game.
  const s = state();
  for (const intent of INTENTS) check(ask(intent.patterns[0].source.replace(/[^a-z ]/gi, ' '), s), intent.id);
  for (const question of QUICK_QUESTIONS) check(ask(question, s), question);
});

// --- against a real game -----------------------------------------------------

test('the coach advises on a genuine dealt position', () => {
  const s = newGame(rules, 0); // you are the dealer, holding 14 tiles
  const advice = ask('what should I discard?', s);

  assert.equal(advice.intent, 'advice.discard');
  // It must name a tile actually in the hand.
  const named = s.players[0].hand.find((t) => advice.lines[0].includes(tileName(t)));
  assert.ok(named, `advice "${advice.lines[0]}" should name a tile from the hand`);
  assert.match(advice.lines.at(-1), /from winning|complete hand/);
});

test('the situation hint follows the turn', () => {
  const s = newGame(rules, 0);
  assert.match(situationHint(s), /your turn/i);

  // After you discard it is someone else's move, so there is nothing to nudge about.
  discardTile(s, s.players[0].hand[0]);
  s.claimOptions = [];
  assert.equal(situationHint(s), null);
});
