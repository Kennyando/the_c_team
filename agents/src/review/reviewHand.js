// The post-hand review pipeline — the framework's first agent.
//
//   state.decisions ──► decisionContext ─┐
//   state.rules     ──► rulesContext ────┼─► buildUserPrompt ─► callModel ─► parse+validate ─► ReviewResult
//                                        │                                        │
//                                        └────────── deterministicReview ◄─────────┘  (on ANY failure)
//
// The model only ever phrases facts our own deterministic code already graded. If there is no
// model configured, or it errors, or it returns something that doesn't fit schema.js, the
// deterministic review is returned instead — so a caller always gets a well-formed ReviewResult.

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
  const dctx = decisionContext(decisions);
  const rctx = rulesContext(rules);
  const fallback = () => deterministicReview(dctx);

  // Nothing to say, or caller opted out — skip the spend entirely.
  if (!useModel || dctx.total === 0) return fallback();

  try {
    const raw = await callModel({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(dctx, rctx),
      maxTokens: 400,
      temperature: 0.2,
    });
    const parsed = parseJsonObject(raw);
    if (!isReviewResult(parsed)) return fallback();
    return normalizeReviewResult(parsed, { modelAssisted: true });
  } catch {
    // Bedrock unavailable / throttled / access denied — the review still happens, model-free.
    return fallback();
  }
}
