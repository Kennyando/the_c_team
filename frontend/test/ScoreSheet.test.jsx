// The end-of-hand result sheet: it shows the winner's whole hand, not just the tile they won on.
// Run with `npm run test:components` from frontend/.

import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ScoreSheet from '../src/components/ScoreSheet.jsx';

// Winner (seat 0) finished on 5 Dots: 11 concealed tiles (the winning tile folded in by
// engine.finishHand) plus one exposed pong of Green Dragon and a flower.
const winnerHand = ['d1', 'd2', 'd3', 'd5', 'd5', 'b7', 'b8', 'b9', 'c2', 'c3', 'c4'];
const players = [
  { seat: 0, name: 'You', points: 12, hand: winnerHand, melds: [{ type: 'pong', tiles: ['dg', 'dg', 'dg'] }], bonus: ['f1'] },
  { seat: 1, name: 'Ah Ma', points: -4, hand: [], melds: [], bonus: [] },
  { seat: 2, name: 'Ah Gong', points: -4, hand: [], melds: [], bonus: [] },
  { seat: 3, name: 'Ah Huat', points: -4, hand: [], melds: [], bonus: [] },
];
const result = {
  drawn: false,
  winnerSeat: 0,
  winnerName: 'You',
  winningTile: 'd5',
  selfDraw: false,
  fromSeat: 2,
  payments: [12, -4, -4, -4],
  tai: 3,
  points: 4,
  items: [{ name: 'All in one suit', tai: 3 }],
  limited: false,
};

test('the winning hand shows every concealed tile, the exposed meld and the flower', () => {
  render(<ScoreSheet result={result} players={players} onNewHand={vi.fn()} />);

  const hand = screen.getByLabelText("You's winning hand");
  // 11 concealed + 3 in the pong + 1 flower = 15 tiles rendered.
  expect(hand.querySelectorAll('.tile').length).toBe(15);
  // The three Green Dragons of the exposed pong are all present.
  expect(hand.querySelectorAll('[aria-label="Green Dragon"]').length).toBe(3);
});

test('exactly one copy of the winning tile is flagged, even though the hand holds two', () => {
  render(<ScoreSheet result={result} players={players} onNewHand={vi.fn()} />);

  const hand = screen.getByLabelText("You's winning hand");
  expect(hand.querySelectorAll('[aria-label="5 Dots"]').length).toBe(2);
  expect(hand.querySelectorAll('.winning-tile').length).toBe(1);
  expect(hand.querySelector('.winning-tile [aria-label="5 Dots"]')).toBeTruthy();
});

test('every rendered tile carries its spoken name as a hover title', () => {
  render(<ScoreSheet result={result} players={players} onNewHand={vi.fn()} />);

  const firstTile = screen.getByLabelText("You's winning hand").querySelector('.tile');
  expect(firstTile.getAttribute('title')).toBe(firstTile.getAttribute('aria-label'));
  expect(firstTile.getAttribute('title')).toBeTruthy();
});
