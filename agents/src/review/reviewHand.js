// The post-hand review pipeline — the framework's first agent.
//
//   state.decisions ──► decisionContext ─┐
//   state.rules     ──► rulesContext ────┼─► buildUserPrompt ─► callModel ─► parse+validate ─► ReviewResult
//                                        │                                        │
//                                        └────────── deterministicReview ◄─────────┘  (on ANY failure)
//
// The model only ever phrases facts our own deterministic code already graded. If there is no
// model configured, or it errors, or it returns something that doesn't fit schema.js, or it
// claims more than the facts support, the deterministic review is returned instead — so a caller
// always gets a well-formed ReviewResult, and the model can never be the source of a claim the
// engine's own grading doesn't back.

import { decisionContext } from '../context/decisionContext.js';
import { rulesContext } from '../context/rulesContext.js';
import { callModel, parseJsonObject } from '../model.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { deterministicReview } from './deterministic.js';
import { isReviewResult, normalizeReviewResult } from '../schema.js';

/**
 * @param {{ decisions?:Array, rules?:Object, useModel?:boolean }} input
 *        `useModel` defaults to true; pass false (or leave AGENT_MODEL_ID unset in a context
 *        where you don't want a call) to force the deterministic path.
 * @returns {Promise<import('../schema.js').ReviewResult>}
 */
export async function runReview({ decisions, rules, useModel = true } = {}) {
  const facts = decisionContext(decisions);
  const rctx = rulesContext(rules);
  const fallback = () => deterministicReview(decisions, rules);

  // Nothing to say, or caller opted out — skip the spend entirely.
  if (!useModel || facts.total === 0) return fallback();

  try {
    const raw = await callModel({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(facts, rctx),
      maxTokens: 400,
      temperature: 0.2,
    });
    const parsed = parseJsonObject(raw);
    if (!isReviewResult(parsed)) return fallback();

    // Grounding guard: the deterministic facts ARE the analysis; the model only phrases them, so
    // it can never surface more "improve" notes than there were sub-optimal moves, or credit more
    // "well played" notes than there were optimal ones. A reply that does isn't grounded in the
    // decision log — discard it and use the deterministic review. (Schema validation checks the
    // shape; this checks it against the facts it was given.)
    if (parsed.improvements.length > facts.mistakes.length || parsed.goodMoves.length > facts.optimalCount) {
      return fallback();
    }

    return normalizeReviewResult(parsed, { modelAssisted: true });
  } catch {
    // Bedrock unavailable / throttled / access denied — the review still happens, model-free.
    return fallback();
  }
}
