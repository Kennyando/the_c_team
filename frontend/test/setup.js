// Explicit RTL cleanup between tests. Testing Library's automatic afterEach(cleanup) relies on a
// global test framework being detected; this config runs with `globals: false` (matching the rest
// of this repo's explicit-import style), so cleanup is wired up here instead.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
