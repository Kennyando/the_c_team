// The help-coach agent — the framework's second agent.
//
//   position ─► coachContext ─► relevantFacts ─► buildUserPrompt ─► callModel ─► parse ─► validate ─► CoachAnswerResult
//                                                                                            │
//                                                               deterministicCoachAnswer ◄───┘  (on ANY failure)
//
// The model reads the structured facts our own advisor.js computed against this table's house
// rules (narrowed to the ones the question is about, then rendered to sentences) and answers in
// words, citing per line the fact ids it rests on. The reply is dropped for a fixed deterministic
// answer if there is no model, it errors, the reply is not `{ "answer": [{ refs, text }] }`, a
// line cites an id that was not in the prompt, a line names a scoring pattern this table does not
// play, or a line states a tai / point / wall-count number that contradicts a fact it cited. The
// frontend's local coach is the real offline floor, so the player still always gets a useful
// reply.

import { coachContext, relevantFacts } from '../context/coachContext.js';
import { callModel, parseJsonObject } from '../model.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { deterministicCoachAnswer } from './deterministic.js';
import { isCoachAnswerShape, normalizeCoachAnswer } from '../schema.js';

// Unambiguous multi-word names for the scoring patterns a model might suggest as a goal. Single
// words like "dragon" or "flower" are left out — they collide with tile names.
const PATTERN_PHRASES = [
  { re: /\b(half|mixed)[- ]?flush\b/, key: 'halfFlush' },
  { re: /\b(full|pure|clean)[- ]?flush\b/, key: 'fullFlush' },
  { re: /\ball[ -]?(pungs?|pongs?|triplets?)\b/, key: 'allPungs' },
  { re: /\ball[ -]?(chows?|sequences?|runs?)\b/, key: 'allChows' },
];

/** True if `text` names a scoring pattern whose rule key is not in `activeKeys`. */
function namesUnsupportedPattern(text, activeKeys) {
  const t = String(text).toLowerCase();
  return PATTERN_PHRASES.some((p) => p.re.test(t) && !activeKeys.has(p.key));
}

// Numbers a line can state that a cited fact pins down exactly. Deliberately narrow: three slots
// with stereotyped phrasings, and each candidate number is only checked if nothing in its *own
// clause* hedges it or ties it to the table limit — a hedge or "limit" elsewhere in the sentence
// does not excuse a separate definite claim. More than one surviving number for a slot is treated
// as ambiguous and skipped.
const NUMERIC_SLOTS = [
  { field: 'tai', factType: 'handValue', res: [/(\d+)\s*tai\b/g] },
  { field: 'points', factType: 'handValue', res: [/\bpays?\s+(\d+)\b/g, /(\d+)\s*points?\b/g] },
  { field: 'count', factType: 'wall', res: [/(\d+)\s*tiles?\s+(?:left|remaining|in the wall)\b/g] },
];
const HEDGE =
  /\b(about|around|roughly|approximately|maybe|might|probably|possibly|likely|nearly|almost|up to|at least|or so|several|a few|some|between|~)\b/;
const LIMIT_CONTEXT = /\b(limit|cap|capped|max|maximum|most it can|ceiling)\b/;

/** The clause a matched number sits in: from the previous clause break to the next one. */
function clauseAround(text, at, len) {
  const before = text.slice(0, at);
  const cut = before.search(/[,;.\n][^,;.\n]*$/);
  const after = text.slice(at + len).split(/[,;.\n]/, 1)[0];
  return `${cut === -1 ? before : before.slice(cut + 1)} ${after}`;
}

/** True if a line states a number for a slot that its cited fact contradicts. */
function misstatesNumber(text, citedFacts) {
  const t = String(text).toLowerCase();
  for (const slot of NUMERIC_SLOTS) {
    const fact = citedFacts.find((f) => f.type === slot.factType);
    if (!fact) continue;
    const limitSlot = slot.field === 'tai' || slot.field === 'points';
    const stated = new Set();
    for (const re of slot.res) {
      for (const m of t.matchAll(re)) {
        const clause = clauseAround(t, m.index, m[0].length);
        if (HEDGE.test(clause) || (limitSlot && LIMIT_CONTEXT.test(clause))) continue;
        stated.add(Number(m[1]));
      }
    }
    if (stated.size === 1 && !stated.has(fact[slot.field])) return true; // one clear number, wrong
  }
  return false;
}

/**
 * @param {{ position?:Object, question?:string, useModel?:boolean }} input
 *        `useModel` defaults to true; pass false to force the deterministic answer.
 * @returns {Promise<import('../schema.js').CoachAnswerResult>}
 */
export async function runCoachAnswer({ position, question, useModel = true } = {}) {
  const q = typeof question === 'string' ? question.trim() : '';

  // Nothing to answer, or caller opted out — skip the spend entirely.
  if (!useModel || !q) return deterministicCoachAnswer();

  try {
    const ctx = coachContext(position);
    const facts = relevantFacts(ctx.facts, q);

    const raw = await callModel({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(facts, q),
      maxTokens: 300,
      temperature: 0.3,
    });
    const parsed = parseJsonObject(raw);
    if (!isCoachAnswerShape(parsed)) return deterministicCoachAnswer();

    // Grounding — the boundary shape validation can't give. Any of these failing drops the whole
    // reply for the deterministic answer:
    //  1. every id a line cites must be a fact that was actually in the prompt (the narrowed set);
    //  2. no line may name a scoring pattern this table does not play (checked against the rules
    //     fact's own key list, not the prose);
    //  3. no line may state a tai / point / wall-count number that a fact it cited contradicts.
    const factById = new Map(facts.map((f) => [f.id, f]));
    if (!parsed.answer.every((line) => line.refs.every((ref) => factById.has(ref)))) {
      return deterministicCoachAnswer();
    }

    const rulesFact = ctx.facts.find((f) => f.type === 'rules');
    const activeKeys = new Set(rulesFact ? rulesFact.keys : []);
    const badLine = (line) => {
      const cited = line.refs.map((r) => factById.get(r)).filter(Boolean);
      return namesUnsupportedPattern(line.text, activeKeys) || misstatesNumber(line.text, cited);
    };
    if (parsed.answer.some(badLine)) return deterministicCoachAnswer();

    return normalizeCoachAnswer(parsed);
  } catch {
    // Bedrock unavailable / throttled / access denied, or a context build that threw on a
    // malformed payload — the coach still answers, model-free.
    return deterministicCoachAnswer();
  }
}
