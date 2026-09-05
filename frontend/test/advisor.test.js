// The value-aware half of bestDiscard(): estimateValue(), contextFor(), and evaluateDiscard().
// shanten()/waits()/claimAdvice()/handSummary()/situationHint() are covered indirectly through
// coach.test.js/engine.test.js, as they always have been — this file is for the pieces that came
// with weighing a discard's value alongside its speed.
// Run with `npm test` from frontend/.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newGame, discardTile } from '../src/game/engine.js';
import { DEFAULT_RULES } from '../src/game/scoring.js';
import { bestDiscard, evaluateDiscard, estimateValue, contextFor } from '../src/game/advisor.js';

const rules = { ...DEFAULT_RULES };
const ctxFor = (hand, overrides = {}) => {
  const visibleTiles = {};
  for (const t of hand) visibleTiles[t] = (visibleTiles[t] || 0) + 1;
  return { rules: { ...rules, ...overrides }, seatWind: 'we', prevailingWind: 'we', visibleTiles };
};

// --- estimateValue at tenpai: real scoreHand(), not a guess -----------------------------------

test('estimateValue at tenpai scores the real wait, and respects the rule it depends on', () => {
  // Ready on c6/c9 — an "all chows" completion (1 tai) either way, so allChows being on is the
  // entire reason this is worth anything.
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we'];
  const player = { seat: 0, hand, melds: [], bonus: [] };

  assert.equal(estimateValue(player, ctxFor(hand)), 1);
  assert.equal(estimateValue(player, ctxFor(hand, { allChows: false })), 0);
});

// --- estimateValue before tenpai: the hand-authored heuristic ----------------------------------

test('a formed honour pair only counts when the matching rule is actually on', () => {
  const hand = ['d1', 'd2', 'd4', 'd8', 'b1', 'b2', 'b3', 'b8', 'b9', 'c1', 'c7', 'dr', 'dr', 'ws'];
  const player = { seat: 0, hand, melds: [], bonus: [] };

  assert.equal(estimateValue(player, ctxFor(hand)), 1);
  assert.equal(estimateValue(player, ctxFor(hand, { dragonPong: false })), 0);
});

test('even a single scoring-relevant honour is worth a little, unlike a plain tile', () => {
  // Isolated d8/dr differ only in kind: neither is part of any pair, run, or partial. Only dr
  // (a dragon, with dragonPong on) gets a lone-tile credit.
  const hand = ['d1', 'd2', 'd4', 'd8', 'b1', 'b2', 'b3', 'b8', 'b9', 'c1', 'c7', 'we', 'ww', 'dr'];
  const player = { seat: 0, hand, melds: [], bonus: [] };
  const ctx = ctxFor(hand);

  assert.ok(estimateValue(player, ctx) > 0, 'a lone dragon plus the seat wind should count for something');
  assert.equal(estimateValue({ ...player, hand: hand.filter((t) => t !== 'dr' && t !== 'we') }, ctx), 0);
});

// --- bestDiscard(): the blended ranking end to end ---------------------------------------------

test('bestDiscard prefers preserving a dragon pair over an equally-fast plain tile, and never breaks it for speed', () => {
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b8', 'c7', 'c8', 'dr', 'dr', 'we'];
  const player = { seat: 0, hand, melds: [], bonus: [] };
  const ctx = ctxFor(hand);

  const rec = bestDiscard(player, ctx);
  assert.equal(rec.tile, 'b8', 'the tile that touches neither the dragon pair nor the lone seat wind');

  // Breaking the dragon pair is not just lower-value, it is also structurally slower — bestDiscard
  // should never recommend it here on either axis.
  const breakingThePair = evaluateDiscard(player, 'dr', ctx);
  assert.ok(breakingThePair.after > rec.shantenAfter);
  assert.ok(breakingThePair.blended < rec.blended);
});

test('evaluateDiscard grades an arbitrary tile the same way bestDiscard ranks its own candidates', () => {
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
  const player = { seat: 0, hand, melds: [], bonus: [] };
  const ctx = ctxFor(hand);

  const rec = bestDiscard(player, ctx);
  const chosen = evaluateDiscard(player, rec.tile, ctx);
  assert.equal(chosen.blended, rec.blended);
  assert.equal(chosen.after, rec.shantenAfter);
});

// --- contextFor(): building visibility from a live state, never from state.wall ----------------

test('contextFor treats your own hand, every exposed meld/bonus, and every discard as visible', () => {
  const state = newGame(rules, 0);
  // newGame deals randomly, and its own initial deal already moves any flower/season tiles drawn
  // into each player's `.bonus` (see engine.js's post-deal bonus-replacement pass) — pin every
  // hand AND clear every bonus so the counts below come only from what this test adds, not
  // whatever the shuffle happened to hand out.
  state.players[0].hand = ['d1', 'd1', 'd2', 'd2', 'd3', 'd3', 'd4', 'd4', 'd5', 'd5', 'd6', 'd6', 'd7', 'd7'];
  state.players[1].hand = ['b1', 'b1', 'b2', 'b2', 'b3', 'b3', 'b4', 'b4', 'b5', 'b5', 'b6', 'b6', 'b7'];
  state.players[2].hand = ['c1', 'c1', 'c2', 'c2', 'c3', 'c3', 'c4', 'c4', 'c5', 'c5', 'c6', 'c6', 'c7'];
  state.players[3].hand = ['we', 'we', 'ws', 'ws', 'ww', 'ww', 'wn', 'wn', 'd8', 'd8', 'd9', 'd9', 'c8'];
  for (const p of state.players) p.bonus = [];
  state.players[1].melds = [{ type: 'pong', tiles: ['dr', 'dr', 'dr'], concealed: false }];
  state.players[2].bonus = ['f1'];
  discardTile(state, 'd1');

  const ctx = contextFor(state, state.players[0]);
  assert.equal(ctx.visibleTiles.dr, 3, 'the exposed dragon pong should be counted');
  assert.equal(ctx.visibleTiles.f1, 1, 'an exposed bonus tile should be counted');
  assert.equal(ctx.visibleTiles.d1, 2, 'the one remaining in hand plus the one just discarded');
  // Regression: contextFor() previously summed every seat's hand, not just the deciding player's
  // own — silently contradicting its own doc comment, which has always said opponents' concealed
  // hands are unknown. player[3]'s two West Winds are held concealed, never melded, bonused, or
  // discarded, so they must not show up as visible to player 0 at all.
  assert.equal(ctx.visibleTiles.ww, undefined, 'another seat\'s concealed hand must stay unknown');
  // The engine's wall is a real, fully-determined array in this single-player implementation, but
  // contextFor() must never read it directly — a real player wouldn't know its contents, and
  // advice built on that knowledge wouldn't be honest advice.
  const wallTotal = Object.values(ctx.visibleTiles).reduce((a, b) => a + b, 0);
  assert.ok(wallTotal < 136, 'visibility should cover far less than the full tile set');
});

test('contextFor reads the seat and prevailing wind that actually apply to this player', () => {
  const state = newGame(rules, 2); // dealer is seat 2, so seat 0 is not East
  const ctx = contextFor(state, state.players[0]);
  assert.equal(ctx.seatWind, 'ww'); // two seats after the dealer, counting East/South/West/North
  assert.equal(ctx.prevailingWind, state.prevailingWind);
});
