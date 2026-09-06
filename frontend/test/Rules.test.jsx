// The rules page: the rulebook retyped as text on the page (no embedded PDF). Its "Home" button
// lives in App.jsx's shared topbar, not in this component — see App.test.jsx for navigation.
// Run with `npm run test:components` from frontend/.

import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import Rules from '../src/components/Rules.jsx';

test('renders the rules as text, not an embedded PDF', () => {
  const { container } = render(<Rules />);

  expect(container.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('heading', { level: 1, name: /Rules & Regulations/i })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Basic Rules of Play/i })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Doubles & Payments/i })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Glossary/i })).toBeTruthy();
});

test('the payments and scoring tables are present', () => {
  const { container } = render(<Rules />);
  const tables = container.querySelectorAll('table');
  expect(tables.length).toBeGreaterThanOrEqual(4);
  expect(screen.getByText(/How to score a double/i)).toBeTruthy();
});

test('no organisation branding, address or contact details remain', () => {
  const { container } = render(<Rules />);
  const text = container.textContent;
  for (const banned of [/SPGG/i, /Graduates' Guild/i, /Dover Road/i, /spgg\.org/i, /\(65\)6796/, /NUS Mahjong/i]) {
    expect(text).not.toMatch(banned);
  }
});
