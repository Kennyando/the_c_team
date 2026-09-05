// The landing screen: renders three doors in, and each one navigates.
// Run with `npm run test:components` from frontend/.

import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Home from '../src/components/Home.jsx';

test('renders a Play, Puzzle, and Rules button', () => {
  render(<Home onNavigate={() => {}} />);
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Puzzle' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Rules' })).toBeTruthy();
});

test('each button navigates to its own screen', () => {
  const onNavigate = vi.fn();
  render(<Home onNavigate={onNavigate} />);

  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(onNavigate).toHaveBeenLastCalledWith('play');

  fireEvent.click(screen.getByRole('button', { name: 'Puzzle' }));
  expect(onNavigate).toHaveBeenLastCalledWith('puzzle');

  fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
  expect(onNavigate).toHaveBeenLastCalledWith('rules');
});
