// The rules page: embeds the rulebook PDF. (Its "Home" button lives in App.jsx's shared topbar,
// not in this component — see App.test.jsx for that navigation.)
// Run with `npm run test:components` from frontend/.

import { test, expect } from 'vitest';
import { render } from '@testing-library/react';

import Rules from '../src/components/Rules.jsx';

test('embeds the rulebook PDF in an iframe', () => {
  const { container } = render(<Rules />);
  const iframe = container.querySelector('iframe');
  expect(iframe).toBeTruthy();
  expect(iframe.getAttribute('src')).toBe('/rules.pdf');
  expect(iframe.getAttribute('title')).toBe('Mahjong rules');
});
