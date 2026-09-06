// Which seat sits at which table edge, and where each discard lands in that seat's river.

import test from 'node:test';
import assert from 'node:assert/strict';

import { EDGE_SEATS, discardPosition } from '../src/game/tableLayout.js';

test('each edge maps to the seat that sits there', () => {
  assert.deepEqual(EDGE_SEATS, { far: 2, right: 1, near: 0, left: 3 });
  // You are always nearest yourself; the opponent you face is across the table; play runs
  // counter-clockwise, so seat 1 is on your right and seat 3 on your left.
  assert.equal(EDGE_SEATS.near, 0);
  assert.equal(EDGE_SEATS.far, 2);
});

test('a river fills six across, then wraps to the next row', () => {
  assert.deepEqual(discardPosition(0), { row: 0, column: 0 });
  assert.deepEqual(discardPosition(5), { row: 0, column: 5 });
  assert.deepEqual(discardPosition(6), { row: 1, column: 0 });
  assert.deepEqual(discardPosition(13), { row: 2, column: 1 });
});

test('the river keeps extending downward — no cap, never a negative', () => {
  assert.deepEqual(discardPosition(23), { row: 3, column: 5 });
  const p = discardPosition(0);
  assert.ok(p.row >= 0 && p.column >= 0);
});
