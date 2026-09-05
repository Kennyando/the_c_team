// Top-level screen navigation: landing on Home, and a way back from every destination.
// The "Home" button lives in App.jsx's shared topbar (not duplicated into Puzzle.jsx/Rules.jsx),
// so this is where that behavior actually gets tested.
// Run with `npm run test:components` from frontend/.

import { test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import App from '../src/App.jsx';

test('the site lands on Home, not straight into a live hand', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Kaki Mahjong' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  // No topbar, no wall count, no live-game chrome until a destination is chosen.
  expect(screen.queryByText(/tiles left in the wall/)).toBeNull();
});

test('Play shows the live game, and Home returns to the landing screen', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(screen.getByText(/tiles left in the wall/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Home' }));
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  expect(screen.queryByText(/tiles left in the wall/)).toBeNull();
});

test('Puzzle and Rules are both reachable from Home and return to it', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Puzzle' }));
  expect(screen.getByText('Discard puzzles')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Home' }));
  expect(screen.getByRole('button', { name: 'Rules' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
  expect(document.querySelector('iframe[src="/rules.pdf"]')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Home' }));
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
});
