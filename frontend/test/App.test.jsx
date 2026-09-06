// Top-level screen navigation: landing on Home, and a way back from every destination.
// The "Home" button lives in App.jsx's shared topbar (not duplicated into Puzzle.jsx/Rules.jsx),
// so this is where that behavior actually gets tested.
// Run with `npm run test:components` from frontend/.

import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

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

test('the narration pill shows the latest line, then hides itself after a second', () => {
  vi.useFakeTimers();
  try {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    const log = container.querySelector('.log');
    expect(log.textContent).toMatch(/New hand dealt/);
    expect(log.hidden).toBe(false);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(container.querySelector('.log').hidden).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test('a new table starts flat (top-down) with the animal tiles in', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));

  expect(container.querySelector('main.table').className).toMatch(/view-flat/);

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  const animals = screen.getByLabelText(/animal tiles/);
  expect(animals.checked).toBe(true);
});

test('the Discards panel lists every player\'s thrown tiles', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));

  fireEvent.click(screen.getByRole('button', { name: 'Discards' }));
  const panel = screen.getByRole('dialog', { name: 'All discarded tiles' });
  // One row per seat, none of them with any discards on a freshly dealt hand.
  expect(panel.querySelectorAll('.discard-log-row').length).toBe(4);
  expect(panel.querySelectorAll('.discard-log-tiles .hint').length).toBe(4);

  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog', { name: 'All discarded tiles' })).toBeNull();
});
