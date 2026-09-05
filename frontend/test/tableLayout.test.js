// The wall ring drawn around the table.

import test from 'node:test';
import assert from 'node:assert/strict';

import { wallStacks, EDGES } from '../src/game/tableLayout.js';

const total = (ring) => ring.reduce((sum, e) => sum + e.stacks, 0);

test('a full wall makes stacks two tiles high on every edge', () => {
  const ring = wallStacks(144);
  assert.equal(ring.length, 4);
  assert.equal(total(ring), 72); // 144 tiles stacked in pairs
  assert.deepEqual(ring.map((e) => e.stacks), [18, 18, 18, 18]);
  assert.deepEqual(ring.map((e) => e.edge), EDGES);
});

test('the ring thins as the wall is drawn down', () => {
  const counts = [144, 100, 60, 20, 4].map((n) => total(wallStacks(n)));
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] < counts[i - 1], `${counts[i]} should be fewer than ${counts[i - 1]}`);
  }
});

test('an odd remainder is spread without losing or inventing stacks', () => {
  for (const remaining of [143, 99, 61, 37, 7, 3, 1]) {
    const ring = wallStacks(remaining);
    assert.equal(total(ring), Math.ceil(remaining / 2), `wall of ${remaining}`);
    // Edges stay within one stack of each other, so the ring never looks lopsided.
    const sizes = ring.map((e) => e.stacks);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `wall of ${remaining} is lopsided`);
  }
});

test('an empty or exhausted wall draws nothing, never a negative', () => {
  for (const remaining of [0, -1, -20]) {
    const ring = wallStacks(remaining);
    assert.equal(total(ring), 0);
    assert.ok(ring.every((e) => e.stacks === 0), `wall of ${remaining} should be empty`);
  }
});
