// The curated puzzle library screen: tier picker, opening a puzzle onto a full table, and grading
// an answer. Expectations are derived from the real PUZZLE_LIBRARY/checkDiscardAnswer rather than
// hardcoded, so this stays correct if the library's content changes.
// Run with `npm run test:components` from frontend/.

import { test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Puzzle from '../src/components/Puzzle.jsx';
import { PUZZLE_LIBRARY } from '../src/game/puzzleLibrary.js';
import { checkDiscardAnswer } from '../src/game/puzzles.js';
import { tileName } from '../src/game/tiles.js';

test('the picker shows 3 puzzles per tier, and switches tiers with the tabs', () => {
  render(<Puzzle />);
  expect(screen.getByRole('tab', { name: 'Easy', selected: true })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^Puzzle \d$/ })).toHaveLength(3);

  fireEvent.click(screen.getByRole('tab', { name: 'Hard' }));
  expect(screen.getByRole('tab', { name: 'Hard', selected: true })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^Puzzle \d$/ })).toHaveLength(3);
});

test('opening a puzzle shows the opponents, the curated discards, and every hand tile', () => {
  const easy1 = PUZZLE_LIBRARY.easy[0];
  render(<Puzzle />);
  fireEvent.click(screen.getAllByRole('button', { name: /^Puzzle \d$/ })[0]);

  // Opponent seats, rendered by the same Table/Seat components the live game uses.
  expect(screen.getByText('Ah Ma')).toBeTruthy();
  expect(screen.getByText('Ah Gong')).toBeTruthy();
  expect(screen.getByText('Ah Huat')).toBeTruthy();

  // The curated discard pile, not the live game's empty-pool placeholder text.
  expect(screen.queryByText('No tiles discarded yet')).toBeNull();

  for (const tile of new Set(easy1.hand)) {
    expect(screen.getAllByRole('button', { name: tileName(tile) }).length).toBeGreaterThan(0);
  }
});

test('tapping the best tile is graded Correct', () => {
  const easy1 = PUZZLE_LIBRARY.easy[0];
  render(<Puzzle />);
  fireEvent.click(screen.getAllByRole('button', { name: /^Puzzle \d$/ })[0]);

  fireEvent.click(screen.getAllByRole('button', { name: tileName(easy1.bestTile) })[0]);
  expect(screen.getByText('Correct!')).toBeTruthy();
});

test('tapping a wrong tile is graded Not quite, and names the best one', () => {
  const easy1 = PUZZLE_LIBRARY.easy[0];
  const wrongTile = [...new Set(easy1.hand)].find((t) => !checkDiscardAnswer(easy1, t).correct);
  render(<Puzzle />);
  fireEvent.click(screen.getAllByRole('button', { name: /^Puzzle \d$/ })[0]);

  fireEvent.click(screen.getAllByRole('button', { name: tileName(wrongTile) })[0]);
  expect(screen.getByText('Not quite.')).toBeTruthy();
  expect(screen.getByText(new RegExp(`${tileName(easy1.bestTile)} keeps you closest to winning`))).toBeTruthy();
});

test('"Choose another puzzle" returns to the picker', () => {
  render(<Puzzle />);
  fireEvent.click(screen.getAllByRole('button', { name: /^Puzzle \d$/ })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Choose another puzzle' }));
  expect(screen.getByText('Discard puzzles')).toBeTruthy();
});
