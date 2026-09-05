import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { runReview } from "@kaki/agents";

/**
 * "review-hand": a stateless HTTP route the frontend calls once, when a hand ends, to get a
 * short, encouraging walk-through of the human's discards and calls.
 *
 * Like classify-intent, the model never writes the authoritative content here — @kaki/agents
 * builds the facts deterministically from the engine's own `state.decisions` log (already graded
 * against advisor.js when each move was made) and the model only phrases them. Any model failure
 * inside runReview() degrades to a deterministic, model-free review, so this handler almost never
 * 5xxs; the catch below exists for genuinely unexpected errors so the CloudWatch alarm on this
 * route can see them.
 *
 * No room, no connection, no game state — one POST body in, one review object out — so it shares
 * the plain CoachApi HTTP API with classify-intent rather than a WebSocket route.
 */

const MAX_DECISIONS = 60; // a long hand is ~30 human decisions; 60 is generous headroom

interface ReviewBody {
  decisions?: unknown;
  rules?: unknown;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body: ReviewBody;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Malformed JSON body" });
  }

  const decisions = Array.isArray(body.decisions) ? body.decisions.slice(0, MAX_DECISIONS) : [];
  const rules = body.rules && typeof body.rules === "object" ? (body.rules as Record<string, unknown>) : undefined;

  try {
    const review = await runReview({ decisions, rules });
    return json(200, { review });
  } catch (err) {
    // runReview() is written not to throw — a model failure returns the deterministic review.
    // Reaching here means something genuinely unexpected broke; surface it as a 5xx so the
    // route's error alarm fires. The frontend treats any non-2xx as "use the local review".
    console.error("reviewHand: unexpected failure", err);
    return json(502, { error: "Review failed" });
  }
};
