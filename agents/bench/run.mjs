// Coach-agent model comparison. Runs the fixed question set in bench/cases.mjs through the real
// runCoachAnswer() grounding pipeline against each candidate model and prints a comparison table.
//
//   cd agents && BEDROCK_REGION=us-east-1 npm run bench:coach
//
// Decision support only — it changes no config. It hits real Bedrock (~1 call per case per
// model, cents total) and needs AWS credentials plus a region where every candidate below is
// enabled for the account. Nothing here runs in `npm test`.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// Verify the exact ids and their regional availability in the Bedrock console before trusting a
// run — Nova 2 naming / inference-profile prefix in particular. Override with MODELS="a,b,c".
// Nova 2 Pro is Preview: its id may be dated (e.g. ...nova-2-pro-preview-<yyyymmdd>-v1:0) and
// access can be gated (Nova Forge) — confirm the id in the console, then add it via MODELS=.
const MODELS = (process.env.MODELS
  ? process.env.MODELS.split(',').map((s) => s.trim()).filter(Boolean)
  : [
      'us.amazon.nova-2-lite-v1:0', // current default
      'us.amazon.nova-lite-v1:0', // previous default, kept as a baseline
      'us.amazon.nova-pro-v1:0',
    ]);

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—');
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

const rows = [];
for (const model of MODELS) {
  process.stderr.write(`\n=== ${model} ===\n`);
  const res = spawnSync(process.execPath, [join(HERE, 'coachModels.mjs')], {
    cwd: join(HERE, '..'),
    env: { ...process.env, AGENT_MODEL_ID: model },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) {
    process.stderr.write((res.stderr || 'child exited non-zero') + '\n');
    rows.push({ model, harnessError: true });
    continue;
  }

  const cases = res.stdout
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((o) => o.type === 'case');

  const n = cases.length;
  const answerCases = cases.filter((c) => (c.expect ?? 'answer') === 'answer');
  const declineCases = cases.filter((c) => c.expect === 'decline');
  rows.push({
    model,
    n,
    jsonValid: pct(cases.filter((c) => c.jsonParsed && c.shapeOk).length, n),
    // `accepted` = the production pipeline let the reply through. NOT a quality score — a hallucination
    // the guardrails missed also counts. Split by intended outcome so recklessness can't inflate it:
    acceptAnswer: pct(answerCases.filter((c) => c.pipelineAccepted).length, answerCases.length),
    leakedDecline: `${declineCases.filter((c) => c.pipelineAccepted).length}/${declineCases.length}`,
    grounding: cases.filter((c) => c.groundingRejected).length,
    nonJson: cases.filter((c) => !c.bedrockError && !c.jsonParsed).length,
    bedrock: cases.filter((c) => c.bedrockError).length,
    truncated: cases.filter((c) => c.truncated).length,
    avgMs: avg(cases.filter((c) => c.ms != null).map((c) => c.ms)),
    avgOut: avg(cases.filter((c) => c.outTokens != null).map((c) => c.outTokens)),
  });
}

const H = ['model', 'n', 'JSON-valid', 'accept (answer-cases)', 'leaked (decline-cases)', 'grounding-rej', 'non-JSON', 'bedrock-err', 'truncated', 'avg ms', 'avg out-tok'];
const line = (cells) => `| ${cells.join(' | ')} |`;
console.log('\n' + line(H));
console.log(line(H.map(() => '---')));
for (const r of rows) {
  if (r.harnessError) {
    console.log(line([r.model, 'HARNESS ERROR — see stderr', '', '', '', '', '', '', '', '', '']));
    continue;
  }
  console.log(line([r.model, r.n, r.jsonValid, r.acceptAnswer, r.leakedDecline, r.grounding, r.nonJson, r.bedrock, r.truncated, r.avgMs ?? '—', r.avgOut ?? '—']));
}
console.log('\n`accept (answer-cases)` — pipeline let it through on a case where a grounded reply exists.');
console.log('It is NOT a quality metric: it says nothing about whether the *right* answer was given,');
console.log('and a model that reasons past the facts scores higher until a guardrail catches it.');
console.log('`leaked (decline-cases)` — accepted an answer on a case the facts cannot support: a');
console.log('guardrail miss. Lower is better; 0 is the goal.');
console.log('\nFor model selection, score each case by hand: agents/bench/out/<model>.json has a');
console.log('`humanVerdict: null` slot per case — fill with correct / grounded-refusal / unsupported /');
console.log('wrong / leak while reading `rawReply` and `finalLines`, then compare those, not `accept`.');
