// Which seat sits at which table edge, and how many backs get laid along it.

import test from 'node:test';
import assert from 'node:assert/strict';

import { handRows, EDGE_SEATS } from '../src/game/tableLayout.js';

// Only `hand.length` is ever read, so the tiles themselves don't matter here.
const seatedAs = (sizes) => sizes.map((n, seat) => ({ seat, hand: Array(n) }));
const byEdge = (rows) => Object.fromEntries(rows.map((r) => [r.edge, r.tiles]));

test('all four edges are drawn, each mapped to the seat that sits there', () => {
  const rows = handRows(seatedAs([14, 13, 13, 13]));

  assert.deepEqual(rows.map((r) => r.edge), ['far', 'right', 'near', 'left']);
  // Play runs counter-clockwise: seat 1 plays after you (right), seat 3 before you (left).
  assert.deepEqual(rows.map((r) => r.seat), [2, 1, 0, 3]);
  // You are always nearest yourself, and the opponent you face is across the table.
  assert.equal(EDGE_SEATS.near, 0);
  assert.equal(EDGE_SEATS.far, 2);
});

test('each edge lays one back per tile that seat is holding', () => {
  // Seat 0 is mid-turn on 14; everyone else holds their standing 13.
  const tiles = byEdge(handRows(seatedAs([14, 13, 13, 13])));

  assert.equal(tiles.near, 14);
  assert.deepEqual([tiles.far, tiles.left, tiles.right], [13, 13, 13]);
});

test('a row shrinks with the hand it draws, so exposed melds are not counted twice', () => {
  // Seat 2 has ponged twice: 6 of its tiles are face up in front of it, 7 still concealed.
  const rows = handRows(seatedAs([13, 13, 7, 13]));

  assert.equal(rows.find((r) => r.edge === 'far').tiles, 7);
});

test('a seat holding nothing draws no backs, never a negative', () => {
  const rows = handRows(seatedAs([0, 0, 0, 0]));

  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.tiles === 0));
});
