// The post-hand review pipeline — the framework's first agent.
//
//   state.decisions ──► decisionContext ─┐
//   state.rules     ──► rulesContext ────┼─► buildUserPrompt ─► callModel ─► parse+validate ─► ReviewResult
//                                        │                                        │
//                                        └────────── deterministicReview ◄─────────┘  (on ANY failure)
//
// The model only ever phrases facts our own deterministic code already graded. If there is no
// model configured, or it errors, or it returns something that doesn't fit schema.js, or any
// bullet fails per-item grounding (below), the deterministic review is returned instead — so a
// caller always gets a well-formed ReviewResult, and the model can never be the source of a
// claim the engine's own grading doesn't back.

import { decisionContext } from '../context/decisionContext.js';
import { rulesContext } from '../context/rulesContext.js';
import { callModel, parseJsonObject } from '../model.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { deterministicReview } from './deterministic.js';
import { isModelReviewShape, normalizeReviewResult } from '../schema.js';

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
    if (!isModelReviewShape(parsed)) return fallback();

    // Per-item grounding — the durable "the model never writes authoritative content" boundary.
    // Schema validation (above) checked the shape; this checks each bullet against the specific
    // decision it points at:
    //   bullet.ref -> a real fact id -> the fact's own grade matches the bullet's bucket
    // A [good] bullet on a decision the engine graded sub-optimal (or vice versa) is not
    // grounded; nor is the same decision cited twice (padding). Any failure -> deterministic.
    const factById = new Map(facts.facts.map((f) => [f.id, f]));
    const usedRefs = new Set();
    const allGrounded = (items, wantOptimal) =>
      items.every((it) => {
        const fact = factById.get(it.ref);
        if (!fact || fact.wasOptimal !== wantOptimal || usedRefs.has(it.ref)) return false;
        usedRefs.add(it.ref);
        return true;
      });
    if (!allGrounded(parsed.goodMoves, true) || !allGrounded(parsed.improvements, false)) {
      return fallback();
    }

    return normalizeReviewResult(parsed, { modelAssisted: true });
  } catch {
    // Bedrock unavailable / throttled / access denied — the review still happens, model-free.
    return fallback();
  }
}
