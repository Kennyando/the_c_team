// The dark plate in the middle of the table: round, tiles left, and each seat's score.

import { test, expect } from 'vitest';
import { render } from '@testing-library/react';

import CenterBoard from '../src/components/CenterBoard.jsx';

test('shows the round, the draw count, and one score per seat with the dealer marked', () => {
  const { container } = render(
    <CenterBoard round="East 2" dealer={1} remaining={49} scores={[0, 12, -4, -8]} />,
  );

  expect(container.textContent).toMatch(/East 2/);
  expect(container.textContent).toMatch(/49 left/);

  const scores = container.querySelectorAll('.center-score');
  expect(scores.length).toBe(4);
  expect(scores[1].textContent).toBe('+12');
  expect(scores[2].textContent).toBe('-4');
  // Only the dealer's score carries the marker class.
  expect(container.querySelectorAll('.center-score.is-dealer').length).toBe(1);
  expect(scores[1].classList.contains('is-dealer')).toBe(true);
});
