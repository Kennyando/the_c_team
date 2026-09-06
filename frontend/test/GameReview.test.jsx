// The step-through hand review: opens on the first misplay, puts the board back for each decision,
// hides the coach's move until asked, and navigates between decisions.
// Run with `npm run test:components` from frontend/.

import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import GameReview from '../src/components/GameReview.jsx';

const DISCARD_HAND = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we', 'b9'];
const CLAIM_HAND = ['d1', 'd2', 'd3', 'b7', 'b7', 'c1', 'c2', 'c3', 'c4', 'we', 'we', 'ws', 'ww'];

const snap = (hand, discards = [{ tile: 'ws', by: 1 }]) => ({
  players: [
    { seat: 0, name: 'You', points: 0, hand, melds: [], bonus: [] },
    { seat: 1, name: 'Ah Ma', points: 0, hand: 13, melds: [], bonus: [] },
    { seat: 2, name: 'Ah Gong', points: 0, hand: 13, melds: [], bonus: [] },
    { seat: 3, name: 'Ah Huat', points: 0, hand: 12, melds: [], bonus: [] },
  ],
  discards,
  wallCount: 50,
  dealer: 0,
  turn: 0,
});

// [0] optimal discard, [1] sub-optimal discard, [2] missed pong.
const DECISIONS = [
  {
    type: 'discard', chosen: 'd5', recommended: 'd5', optimal: true,
    shantenBefore: 2, shantenAfterChosen: 2, shantenAfterRecommended: 2, reasons: [],
    snapshot: snap(DISCARD_HAND),
  },
  {
    type: 'discard', chosen: 'we', recommended: 'b9', optimal: false,
    shantenBefore: 1, shantenAfterChosen: 2, shantenAfterRecommended: 0,
    reasons: ['Terminals join fewer runs than middle tiles.'],
    snapshot: snap(DISCARD_HAND),
  },
  {
    type: 'claim', pendingTile: 'b7', chosen: null,
    recommended: { type: 'pong', tiles: ['b7', 'b7', 'b7'] }, optimal: false,
    options: [{ claim: { type: 'pong', tiles: ['b7', 'b7', 'b7'] }, verdict: 'yes', lines: ['Yes — it helps.'] }],
    snapshot: snap(CLAIM_HAND, [{ tile: 'ws', by: 1 }, { tile: 'b7', by: 2 }]),
  },
];

const renderReview = (props = {}) =>
  render(<GameReview decisions={DECISIONS} onExit={vi.fn()} onNewHand={vi.fn()} {...props} />);

test('opens on the first misplay, with the board rendered and the coach hidden', () => {
  renderReview();

  expect(screen.getByText(/Move 2 of 3/)).toBeTruthy();

  // the frozen board rendered via the live Table/Seat components
  expect(screen.getByText('Ah Ma')).toBeTruthy();
  expect(screen.getByText('Ah Gong')).toBeTruthy();

  // your tile is flagged; the coach's is not until asked
  expect(screen.getByText('You')).toBeTruthy();
  expect(screen.queryByText('Coach')).toBeNull();
});

test('the better tile is not named until "Show the coach\'s move" is clicked', () => {
  renderReview();
  // before: no spoiler of which tile, no green "Coach" marker
  expect(screen.queryByText(/9 Bamboo was the stronger discard/)).toBeNull();
  expect(screen.queryByText('Coach')).toBeNull();
  expect(screen.getByText(/There was a stronger discard/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: "Show the coach's move" }));

  expect(screen.getByText('Coach')).toBeTruthy(); // green marker on 9 Bamboo
  expect(screen.getByText(/9 Bamboo was the stronger discard/)).toBeTruthy();
  expect(screen.getByText(/Terminals join fewer runs/)).toBeTruthy();
});

test('the move list jumps to any decision, and reveal re-hides on the way', () => {
  renderReview();
  fireEvent.click(screen.getByRole('button', { name: "Show the coach's move" }));
  expect(screen.getByText('Coach')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /^1\. Discarded 5 Dots/ }));
  expect(screen.getByText(/Move 1 of 3/)).toBeTruthy();
  expect(screen.getByText(/the tile the coach would have picked/)).toBeTruthy();
  expect(screen.queryByText('Coach')).toBeNull(); // reveal reset on navigation
});

test('Prev / Next / Next mistake move between decisions and disable at the ends', () => {
  renderReview(); // starts at move 2 (index 1)

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText(/Move 3 of 3/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Next' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Next mistake' }).disabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
  fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
  expect(screen.getByText(/Move 1 of 3/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Prev' }).disabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Next mistake' }));
  expect(screen.getByText(/Move 2 of 3/)).toBeTruthy();
});

test('a claim decision renders the offered tile and your action, coach call on reveal', () => {
  renderReview();
  fireEvent.click(screen.getByRole('button', { name: 'Next' })); // to the claim, move 3

  expect(screen.getByText('You passed')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: "Show the coach's move" }));
  expect(screen.getByText(/calling pong would have moved your hand forward/)).toBeTruthy();
});

test('the footer buttons call back out', () => {
  const onExit = vi.fn();
  const onNewHand = vi.fn();
  renderReview({ onExit, onNewHand });

  fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
  expect(onExit).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole('button', { name: 'Deal a new hand' }));
  expect(onNewHand).toHaveBeenCalledOnce();
});
