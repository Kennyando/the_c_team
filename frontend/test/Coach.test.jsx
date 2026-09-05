// The help coach: a tile image accompanies an answer that names a specific tile, and only those.
// Run with `npm run test:components` from frontend/.

import { test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Coach from '../src/components/Coach.jsx';
import { newGame } from '../src/game/engine.js';
import { DEFAULT_RULES } from '../src/game/scoring.js';
import { bestDiscard } from '../src/game/advisor.js';
import { tileName } from '../src/game/tiles.js';

test('asking what to discard renders a tile image for the recommended tile', async () => {
  const state = newGame(DEFAULT_RULES, 0);
  const rec = bestDiscard(state.players[0]);
  render(<Coach state={state} voice={false} hints={false} initialOpen />);

  fireEvent.click(screen.getByRole('button', { name: 'What should I discard?' }));

  const title = await screen.findByText('Best discard');
  const tileImage = title.parentElement.querySelector('.coach-a-tile');
  expect(tileImage).toBeTruthy();
  expect(tileImage.querySelector(`[aria-label="${tileName(rec.tile)}"]`)).toBeTruthy();
});

test('a rules question with no specific tile renders no tile image', async () => {
  const state = newGame(DEFAULT_RULES, 0);
  render(<Coach state={state} voice={false} hints={false} initialOpen />);

  fireEvent.click(screen.getByRole('button', { name: 'What does pong do?' }));

  const title = await screen.findByText('Pong 碰');
  expect(title.parentElement.querySelector('.coach-a-tile')).toBeNull();
});
