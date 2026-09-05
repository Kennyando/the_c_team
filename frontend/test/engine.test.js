// Rules-accuracy test suite (proposal Section 9): hand-verified sample hands checked against the
// engine.  Run with `npm test` from frontend/.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWall, sortTiles, tileName } from '../src/game/tiles.js';
import { decompose, isWinningHand, getClaimsFor, getSelfKongs, bestClaim } from '../src/game/melds.js';
import { scoreHand, settle, seatWindOf, pointsForTai, DEFAULT_RULES } from '../src/game/scoring.js';
import { newGame, drawTile, discardTile, resolveClaims } from '../src/game/engine.js';

const rules = { ...DEFAULT_RULES };

test('wall holds 144 tiles, or 148 with the animal house rule', () => {
  assert.equal(buildWall(false).length, 144);
  assert.equal(buildWall(true).length, 148);

  // Every standard tile appears exactly four times; bonus tiles exactly once.
  const counts = {};
  for (const t of buildWall(false)) counts[t] = (counts[t] || 0) + 1;
  assert.equal(counts.d5, 4);
  assert.equal(counts.we, 4);
  assert.equal(counts.dr, 4);
  assert.equal(counts.f1, 1);
  assert.equal(counts.s4, 1);
});

test('deal gives the dealer 14 tiles and everyone else 13', () => {
  const state = newGame(rules, 0);
  assert.equal(state.players[0].hand.length + state.players[0].bonus.length * 0, 14);
  for (const seat of [1, 2, 3]) assert.equal(state.players[seat].hand.length, 13);
  // Bonus tiles are set aside, never left in hand.
  for (const p of state.players) assert.ok(p.hand.every((t) => !'fsa'.includes(t[0])));
});

test('a plain four-chow hand wins and scores 1 tai for all chows', () => {
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we', 'we'];
  assert.ok(isWinningHand(hand, []));

  const score = scoreHand({ concealed: hand, seatWind: 'ws', prevailingWind: 'we', rules });
  assert.equal(score.tai, 1);
  assert.deepEqual(score.items.map((i) => i.name), ['All chows 平胡']);
  assert.equal(score.points, 1);
});

test('all pungs scores 2 tai', () => {
  const hand = ['d1', 'd1', 'd1', 'b2', 'b2', 'b2', 'c3', 'c3', 'c3', 'ww', 'ww', 'ww', 'd9', 'd9'];
  const score = scoreHand({ concealed: hand, seatWind: 'we', prevailingWind: 'we', rules });
  assert.equal(score.tai, 2);
  assert.equal(score.points, 2);
});

test('dragon, seat wind and prevailing wind pongs each add a tai', () => {
  const hand = ['dr', 'dr', 'dr', 'we', 'we', 'we', 'b1', 'b2', 'b3', 'c4', 'c5', 'c6', 'd9', 'd9'];
  // Seat East and prevailing East: the East pong counts for both.
  const score = scoreHand({ concealed: hand, seatWind: 'we', prevailingWind: 'we', rules });
  const names = score.items.map((i) => i.name).sort();
  assert.deepEqual(names, ['Prevailing wind pong', 'Red Dragon pong', 'Seat wind pong']);
  assert.equal(score.tai, 3);
  assert.equal(score.points, 4);
});

test('full flush plus seat flowers is capped at the 5 tai limit', () => {
  const hand = ['d1', 'd1', 'd1', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd9', 'd9'];
  const score = scoreHand({
    concealed: hand,
    bonus: ['f1', 's1'],       // East's own flower and season
    seatWind: 'we',
    prevailingWind: 'we',
    rules,
  });
  assert.equal(score.rawTai, 6);   // 4 full flush + 1 seat flower + 1 seat season
  assert.equal(score.tai, 5);
  assert.ok(score.limited);
  assert.equal(score.points, 16);
});

test('half flush scores 2 tai, not full flush', () => {
  const hand = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'dg', 'dg', 'dg', 'we', 'we'];
  const score = scoreHand({ concealed: hand, seatWind: 'ws', prevailingWind: 'we', rules });
  const names = score.items.map((i) => i.name);
  assert.ok(names.includes('Half flush 混一色'));
  assert.ok(!names.includes('Full flush 清一色'));
  assert.equal(score.tai, 3); // 2 half flush + 1 green dragon pong
});

test('scoring picks the highest-value reading of an ambiguous hand', () => {
  // b2..b7 reads as two chows (2-3-4 / 5-6-7); with the pungs it is also all-chows-free.
  const hand = ['b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'd1', 'd2', 'd3', 'c5', 'c5', 'c5', 'we', 'we'];
  assert.ok(decompose(hand, 4).length >= 1);
  const score = scoreHand({ concealed: hand, seatWind: 'ws', prevailingWind: 'we', rules });
  assert.equal(score.tai, 0); // three chows + a pung: no pattern applies
});

test('a 14-tile hand with no pair does not win', () => {
  const hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we', 'ws'];
  assert.equal(isWinningHand(hand, []), false);
  assert.equal(scoreHand({ concealed: hand, seatWind: 'we', prevailingWind: 'we', rules }), null);
});

test('exposed melds count toward the four sets', () => {
  const player = {
    seat: 0,
    hand: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'we', 'we'],
    melds: [
      { type: 'pong', tiles: ['dr', 'dr', 'dr'] },
      { type: 'kong', tiles: ['b5', 'b5', 'b5', 'b5'] },
    ],
  };
  assert.ok(isWinningHand(player.hand, player.melds));
  const score = scoreHand({
    concealed: player.hand,
    melds: player.melds,
    seatWind: 'ws',
    prevailingWind: 'we',
    rules,
  });
  assert.equal(score.tai, 1); // Red Dragon pong
});

test('chow is only legal from the player on your left', () => {
  const player = { seat: 2, hand: ['d3', 'd4', 'd9', 'we', 'we'], melds: [] };

  // Seat 1 is seat 2's left-hand neighbour: (2 + 3) % 4 === 1.
  const fromLeft = getClaimsFor(player, 'd5', 1);
  assert.ok(fromLeft.some((c) => c.type === 'chow'));

  const fromElsewhere = getClaimsFor(player, 'd5', 3);
  assert.ok(!fromElsewhere.some((c) => c.type === 'chow'));
});

test('pong and kong are legal from any seat', () => {
  const player = { seat: 2, hand: ['d5', 'd5', 'd5', 'we', 'we'], melds: [] };
  for (const discarder of [0, 1, 3]) {
    const types = getClaimsFor(player, 'd5', discarder).map((c) => c.type);
    assert.ok(types.includes('pong'), `pong from seat ${discarder}`);
    assert.ok(types.includes('kong'), `kong from seat ${discarder}`);
  }
});

test('claim priority puts a win above a pong, and ties go to the nearest seat', () => {
  const winner = { type: 'win', seat: 3 };
  const ponger = { type: 'pong', seat: 1 };
  assert.equal(bestClaim([ponger, winner], 0), winner);

  const near = { type: 'pong', seat: 1 };
  const far = { type: 'pong', seat: 3 };
  assert.equal(bestClaim([far, near], 0), near);
});

test('self kongs are offered for four concealed tiles and for a fourth onto an own pong', () => {
  const concealed = { seat: 0, hand: ['b7', 'b7', 'b7', 'b7', 'we'], melds: [] };
  assert.deepEqual(getSelfKongs(concealed), [{ type: 'concealedKong', tile: 'b7' }]);

  const added = { seat: 0, hand: ['c2', 'we'], melds: [{ type: 'pong', tiles: ['c2', 'c2', 'c2'] }] };
  assert.deepEqual(getSelfKongs(added), [{ type: 'addedKong', tile: 'c2' }]);
});

test('seat winds run East, South, West, North from the dealer', () => {
  assert.equal(seatWindOf(0, 0), 'we');
  assert.equal(seatWindOf(1, 0), 'ws');
  assert.equal(seatWindOf(3, 0), 'wn');
  assert.equal(seatWindOf(0, 1), 'wn'); // dealer moved to seat 1
});

test('points double with each tai', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(pointsForTai), [1, 1, 2, 4, 8, 16]);
});

test('the discarder pays for everyone by default, and self-draw is paid by all three', () => {
  const onDiscard = settle({ points: 16, winnerSeat: 0, selfDraw: false, fromSeat: 2, rules });
  assert.deepEqual(onDiscard, [48, 0, -48, 0]);

  const onSelfDraw = settle({ points: 16, winnerSeat: 0, selfDraw: true, fromSeat: null, rules });
  assert.deepEqual(onSelfDraw, [48, -16, -16, -16]);

  const shared = settle({
    points: 16, winnerSeat: 0, selfDraw: false, fromSeat: 2,
    rules: { ...rules, discarderPaysAll: false },
  });
  assert.deepEqual(shared, [48, -16, -16, -16]);
});

test('house rules can switch a pattern off', () => {
  const hand = ['d1', 'd1', 'd1', 'b2', 'b2', 'b2', 'c3', 'c3', 'c3', 'ww', 'ww', 'ww', 'd9', 'd9'];
  const off = scoreHand({
    concealed: hand, seatWind: 'we', prevailingWind: 'we',
    rules: { ...rules, allPungs: false },
  });
  assert.equal(off.tai, 0);
});

test('a discard moves the tile from hand to the table and opens the claim window', () => {
  const state = newGame(rules, 0);
  const tile = state.players[0].hand[0];
  const before = state.players[0].hand.length;

  discardTile(state, tile);
  assert.equal(state.players[0].hand.length, before - 1);
  assert.deepEqual(state.discards.at(-1), { tile, by: 0 });
  assert.equal(state.phase, 'claim');
});

test('drawing reduces the wall and hands the tile to the current player', () => {
  const state = newGame(rules, 0);
  discardTile(state, state.players[0].hand[0]);
  state.pending = null;
  state.turn = 1;
  state.phase = 'draw';

  const wallBefore = state.wall.length;
  drawTile(state);
  assert.ok(state.wall.length < wallBefore);
  assert.equal(state.players[1].hand.length, 14);
  assert.equal(state.phase, 'act');
});

// --- decision log (groundwork for a future teaching agent, docs/mvp-notes.md #9) --------------

test('a new game starts with an empty decision log', () => {
  assert.deepEqual(newGame(rules, 0).decisions, []);
});

test('a discard records an optimal decision when the human discards the recommended tile', () => {
  const state = newGame(rules, 0);
  // Same hand as advisor.test's "bestDiscard picks the dead tile": b9 touches nothing and is the
  // only tile whose removal leaves the hand one away from winning.
  state.players[0].hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];

  discardTile(state, 'b9');

  const entry = state.decisions.at(-1);
  assert.equal(entry.type, 'discard');
  assert.equal(entry.chosen, 'b9');
  assert.equal(entry.recommended, 'b9');
  assert.equal(entry.shantenAfterChosen, 0);
  assert.equal(entry.optimal, true);
});

test('a discard records a mistake when a worse tile is thrown than the one recommended', () => {
  const state = newGame(rules, 0);
  state.players[0].hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];

  discardTile(state, 'we'); // breaks the pair instead of shedding the dead tile

  const entry = state.decisions.at(-1);
  assert.equal(entry.chosen, 'we');
  assert.equal(entry.recommended, 'b9');
  assert.equal(entry.shantenAfterChosen, 1);
  assert.equal(entry.shantenAfterRecommended, 0);
  assert.equal(entry.optimal, false);
});

test('a discard tied with the recommended tile is not read as a mistake', () => {
  const state = newGame(rules, 0);
  // Four complete sets plus two unpaired honours: discarding either is equally good, leaving four
  // sets and one tile waiting to pair up.
  state.players[0].hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'we', 'ws'];

  discardTile(state, 'ws');

  const entry = state.decisions.at(-1);
  assert.equal(entry.recommended, 'we'); // the other tied tile, picked first
  assert.equal(entry.chosen, 'ws');
  assert.ok(entry.chosen !== entry.recommended, 'this case only tests something if the two differ');
  assert.equal(entry.optimal, true);
});

test('a bot discard is never added to the decision log', () => {
  const state = newGame(rules, 0);
  state.turn = 1;
  state.phase = 'act';

  discardTile(state, state.players[1].hand[0]);

  assert.deepEqual(state.decisions, []);
});

test('passing on a discard that would have helped is recorded as a missed call', () => {
  const state = newGame(rules, 0);
  // 3 sets, a pair of wn, and two unrelated singles: two tiles from winning. Ponging the wn pair
  // uses up the only pair, but the three completed sets plus the new pong leave just one single
  // tile short of a fourth set with no pair yet needed — one tile from winning, an improvement.
  state.players[0].hand = ['d1', 'd2', 'd3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'wn', 'wn', 'we', 'ws'];
  state.players[1].hand = ['wn', ...Array(12).fill('d9')];
  state.players[2].hand = Array(13).fill('ws');
  state.players[3].hand = Array(13).fill('ww');
  state.turn = 1;
  state.phase = 'act';

  discardTile(state, 'wn');
  assert.deepEqual(state.claimOptions, [{ type: 'pong', tiles: ['wn', 'wn', 'wn'], seat: 0 }]);

  resolveClaims(state, null); // the human passes

  const entry = state.decisions.at(-1);
  assert.equal(entry.type, 'claim');
  assert.equal(entry.chosen, null);
  assert.deepEqual(entry.recommended, { type: 'pong', tiles: ['wn', 'wn', 'wn'], seat: 0 });
  assert.equal(entry.optimal, false);
});

test('taking the one call that helps is recorded as optimal', () => {
  const state = newGame(rules, 0);
  state.players[0].hand = ['d1', 'd2', 'd3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'wn', 'wn', 'we', 'ws'];
  state.players[1].hand = ['wn', ...Array(12).fill('d9')];
  state.players[2].hand = Array(13).fill('ws');
  state.players[3].hand = Array(13).fill('ww');
  state.turn = 1;
  state.phase = 'act';

  discardTile(state, 'wn');
  const [claim] = state.claimOptions;

  resolveClaims(state, claim);

  const entry = state.decisions.at(-1);
  assert.equal(entry.chosen, claim);
  assert.equal(entry.recommended, claim);
  assert.equal(entry.optimal, true);
});

test('taking a call that does not help is recorded as a mistake', () => {
  const state = newGame(rules, 0);
  // Same "wasteful" hand as advisor.test's claimAdvice case: already one away from winning, and
  // ponging the dragon pair costs the eyes for no gain.
  state.players[0].hand = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'dg', 'dg'];
  state.players[1].hand = ['dg', ...Array(12).fill('wn')];
  state.players[2].hand = Array(13).fill('ws');
  state.players[3].hand = Array(13).fill('ww');
  state.turn = 1;
  state.phase = 'act';

  discardTile(state, 'dg');
  const [claim] = state.claimOptions;

  resolveClaims(state, claim);

  const entry = state.decisions.at(-1);
  assert.equal(entry.chosen, claim);
  assert.equal(entry.recommended, null);
  assert.equal(entry.optimal, false);
});

test('no decision is recorded when the human has no legal claim to make', () => {
  const state = newGame(rules, 0);
  state.players[0].hand = Array(13).fill('ws'); // nothing that could ever claim a wn discard
  state.players[1].hand = ['wn', ...Array(12).fill('c1')];
  state.players[2].hand = Array(13).fill('b1');
  state.players[3].hand = Array(13).fill('b2');
  state.turn = 1;
  state.phase = 'act';

  discardTile(state, 'wn');
  assert.deepEqual(state.claimOptions, []);

  resolveClaims(state, null);

  assert.deepEqual(state.decisions, []);
});

test('tiles sort and read out in a stable, speakable way', () => {
  // Suits sort Dots, Bamboo, Characters, then winds, then dragons, then bonus tiles.
  assert.deepEqual(sortTiles(['dr', 'd5', 'we', 'b1']), ['d5', 'b1', 'we', 'dr']);
  assert.equal(tileName('d5'), '5 Dots');
  assert.equal(tileName('dr'), 'Red Dragon');
  assert.equal(tileName('s1'), 'Spring');
});
