// Cross-package smoke test: askWithModel() (frontend) -> fetch -> the REAL compiled Lambda
// handler (backend) -> Bedrock (mocked). Everything else in this repo tests one side of that
// chain in isolation; this proves the two sides actually agree on the request/response shape.
//
// Lives here (not frontend/test/) so this file, the compiled Lambda it imports, and the Bedrock
// SDK class it mocks all resolve through the SAME backend/node_modules — otherwise mocking
// BedrockRuntimeClient.prototype.send here could silently miss a differently-resolved copy the
// Lambda actually uses, and a "test" could make a real, billed Bedrock call. `.mjs` so this one
// file runs as native ESM without touching backend's CommonJS setup for everything else.
//
// Prerequisite: `npm run build` in backend/ (so dist/lambda/classifyIntent.js exists). Not part
// of the default `npm test` for either package — run explicitly with `npm run test:integration`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

import classifyIntentModule from '../dist/lambda/classifyIntent.js';
import { askWithModel, INTENTS } from '../../frontend/src/game/coach.js';
import { newGame } from '../../frontend/src/game/engine.js';
import { DEFAULT_RULES } from '../../frontend/src/game/scoring.js';

const { handler } = classifyIntentModule;
const FAKE_URL = 'https://example.invalid/classify-intent';
const state = () => newGame({ ...DEFAULT_RULES }, 0);

/** Wires askWithModel's fetch() straight into the real Lambda handler, in-process. No HTTP,
 * no real network — Bedrock itself is mocked per test below. */
async function fetchViaLambda(_url, options) {
  const result = await handler({ body: options.body }, {}, () => {});
  return { ok: result.statusCode >= 200 && result.statusCode < 300, json: async () => JSON.parse(result.body) };
}

function withFakeFetch(t, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchViaLambda;
  t.after(() => { globalThis.fetch = original; });
  return run();
}

test('an unusual phrasing makes it all the way through to the right local answer', async (t) => {
  t.mock.method(BedrockRuntimeClient.prototype, 'send', async () => ({
    output: { message: { content: [{ text: 'rules.kong' }] } },
  }));

  const answer = await withFakeFetch(t, () =>
    askWithModel('What do I do when I have four identical tiles?', state(), { classifyUrl: FAKE_URL }),
  );

  assert.equal(answer.intent, 'rules.kong');
  assert.equal(answer.modelAssisted, true);
  const localKongAnswer = INTENTS.find((i) => i.id === 'rules.kong').answer(state());
  assert.deepEqual(answer.lines, localKongAnswer.lines);
});

test('Bedrock unavailable end to end still resolves to the plain local fallback', async (t) => {
  t.mock.method(BedrockRuntimeClient.prototype, 'send', async () => {
    throw new Error('ServiceUnavailableException');
  });

  const withoutModel = await import('../../frontend/src/game/coach.js').then((m) =>
    m.ask('what is the weather like', state()),
  );
  const answer = await withFakeFetch(t, () =>
    askWithModel('what is the weather like', state(), { classifyUrl: FAKE_URL }),
  );

  assert.equal(answer.intent, 'fallback');
  assert.deepEqual(answer, withoutModel);
});
