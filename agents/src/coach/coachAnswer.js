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
// line cites an id that was not in the prompt, or a line names a scoring pattern this table does
// not play. The frontend's local coach is the real offline floor, so the player still always
// gets a useful reply.

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

    // Grounding — the boundary shape validation can't give. Two checks, either failing drops the
    // whole reply for the deterministic answer:
    //  1. every id a line cites must be a fact that was actually in the prompt (the narrowed set);
    //  2. no line may name a scoring pattern this table does not play (checked against the rules
    //     fact's own key list, not the prose).
    const factIds = new Set(facts.map((f) => f.id));
    if (!parsed.answer.every((line) => line.refs.every((ref) => factIds.has(ref)))) {
      return deterministicCoachAnswer();
    }

    const rulesFact = ctx.facts.find((f) => f.type === 'rules');
    const activeKeys = new Set(rulesFact ? rulesFact.keys : []);
    if (parsed.answer.some((line) => namesUnsupportedPattern(line.text, activeKeys))) {
      return deterministicCoachAnswer();
    }

    return normalizeCoachAnswer(parsed);
  } catch {
    // Bedrock unavailable / throttled / access denied, or a context build that threw on a
    // malformed payload — the coach still answers, model-free.
    return deterministicCoachAnswer();
  }
}
