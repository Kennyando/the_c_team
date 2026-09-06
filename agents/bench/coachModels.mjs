// Single-model runner for the coach-agent comparison. One child process per candidate model;
// bench/run.mjs spawns this with AGENT_MODEL_ID set in the environment so model.js picks it up
// at import time (the reason this is a child process and not a loop in one process).
//
// It hits REAL Bedrock. For each fixture it wraps BedrockRuntimeClient.prototype.send to pass
// the call straight through while recording the raw reply, token usage, stop reason and latency,
// then runs the real runCoachAnswer() pipeline so the pass/fail is the production verdict, not a
// re-implementation. One JSON line per case goes to stdout; every raw reply is dumped to
// bench/out/<modelId>.json for a human to read.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

import { CASES } from './cases.mjs';
import { runCoachAnswer } from '../src/coach/coachAnswer.js';
import { parseJsonObject } from '../src/model.js';
import { isCoachAnswerShape } from '../src/schema.js';

const MODEL_ID = process.env.AGENT_MODEL_ID || 'us.amazon.nova-lite-v1:0';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'out');

// Pass-through spy: keep the real implementation, record what the one call in runCoachAnswer did.
const realSend = BedrockRuntimeClient.prototype.send;
let lastCall = null;
BedrockRuntimeClient.prototype.send = async function (command, ...rest) {
  const started = performance.now();
  try {
    const result = await realSend.call(this, command, ...rest);
    const content = result?.output?.message?.content ?? [];
    lastCall = {
      ms: Math.round(performance.now() - started),
      raw: content.map((c) => c?.text).filter((t) => typeof t === 'string').join('\n'),
      contentBlocks: content.map((c) => Object.keys(c ?? {}).join('+') || 'empty'),
      stopReason: result?.stopReason ?? null,
      inTokens: result?.usage?.inputTokens ?? null,
      outTokens: result?.usage?.outputTokens ?? null,
      error: null,
    };
    return result;
  } catch (err) {
    lastCall = {
      ms: Math.round(performance.now() - started),
      raw: '',
      contentBlocks: [],
      stopReason: null,
      inTokens: null,
      outTokens: null,
      error: err?.name || String(err),
    };
    throw err;
  }
};

const dump = [];

for (const c of CASES) {
  lastCall = null;
  let result;
  try {
    result = await runCoachAnswer({ position: c.position, question: c.question });
  } catch (err) {
    result = { modelAssisted: false, lines: [], error: err?.message };
  }

  const call = lastCall ?? {};
  const parsed = parseJsonObject(call.raw ?? '');
  const row = {
    type: 'case',
    name: c.name,
    bedrockError: call.error ?? null,
    jsonParsed: parsed !== null,
    shapeOk: isCoachAnswerShape(parsed),
    modelAssisted: result.modelAssisted === true,
    truncated: call.stopReason === 'max_tokens',
    stopReason: call.stopReason ?? null,
    ms: call.ms ?? null,
    inTokens: call.inTokens ?? null,
    outTokens: call.outTokens ?? null,
    contentBlocks: call.contentBlocks ?? [],
  };
  // shapeOk but not modelAssisted == a grounding rejection (bad ref / unsupported pattern /
  // misstated number). Which one needs a human eye on the raw text below.
  row.groundingRejected = row.shapeOk && !row.modelAssisted;
  process.stdout.write(JSON.stringify(row) + '\n');

  dump.push({
    name: c.name,
    note: c.note,
    question: c.question,
    verdict: row,
    rawReply: call.raw ?? '',
    finalLines: result.lines ?? [],
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const safe = MODEL_ID.replace(/[^a-z0-9._-]/gi, '_');
writeFileSync(join(OUT_DIR, `${safe}.json`), JSON.stringify({ model: MODEL_ID, cases: dump }, null, 2));
process.stdout.write(JSON.stringify({ type: 'done', model: MODEL_ID, dump: `bench/out/${safe}.json` }) + '\n');
