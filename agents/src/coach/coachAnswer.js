// The help-coach agent — the framework's second agent.
//
//   position ─► coachContext ─► buildUserPrompt ─► callModel ─► parse ─► shape + grounding ─► CoachAnswerResult
//                                                                              │
//                                                         deterministicCoachAnswer ◄──┘  (on ANY failure)
//
// The model reads facts our own advisor.js already computed against this table's house rules and
// answers the player's question in words, citing per line the fact ids it rests on. If there is
// no model, or it errors, or its reply is not `{ "answer": [{ refs, text }] }`, or a line cites
// a fact id that coachContext() did not produce, a fixed deterministic answer is returned instead
// — and, because the frontend's local coach is the real offline floor, the player still always
// gets a useful reply.

import { coachContext } from '../context/coachContext.js';
import { callModel, parseJsonObject } from '../model.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { deterministicCoachAnswer } from './deterministic.js';
import { isCoachAnswerShape, normalizeCoachAnswer } from '../schema.js';

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
    const raw = await callModel({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(ctx, q),
      maxTokens: 300,
      temperature: 0.3,
    });
    const parsed = parseJsonObject(raw);
    if (!isCoachAnswerShape(parsed)) return deterministicCoachAnswer();

    // Grounding — the boundary shape validation can't give: every id a line cites must be a real
    // fact from coachContext(). A line that cites nothing real is invention; drop the whole reply.
    const factIds = new Set(ctx.facts.map((f) => f.id));
    const grounded = parsed.answer.every((line) => line.refs.every((ref) => factIds.has(ref)));
    if (!grounded) return deterministicCoachAnswer();

    return normalizeCoachAnswer(parsed);
  } catch {
    // Bedrock unavailable / throttled / access denied, or a context build that threw on a
    // malformed payload — the coach still answers, model-free.
    return deterministicCoachAnswer();
  }
}
