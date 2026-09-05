import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js on purpose: component-rendering tests (test/*.test.jsx) run under
// Vitest + jsdom, while the existing game-logic suite (test/*.test.js) keeps running under Node's
// built-in test runner via `npm test`. The two never overlap — different file extensions, different
// commands — so neither needed to change for the other to exist.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.jsx'],
    globals: false,
    setupFiles: ['./test/setup.js'],
  },
});
