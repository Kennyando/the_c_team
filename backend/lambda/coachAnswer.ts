import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { runCoachAnswer } from "@kaki/agents";

/**
 * "coach-answer": a stateless HTTP route the help coach falls back to when its own local keyword
 * patterns AND the classify-intent route both fail to place a typed question.
 *
 * Unlike classify-intent (which only picks an existing local answer) this one has the model read
 * the position and answer in words. It is still fenced: @kaki/agents builds the FACTS
 * deterministically from advisor.js against this table's house rules, the model's reply must be
 * `{ "answer": string[] }` or it is dropped for a fixed answer, and runCoachAnswer() is written
 * never to throw — so this handler almost never 5xxs. The catch below is for genuinely
 * unexpected breakage, so the shared CoachApi error alarm can see it. The frontend treats any
 * non-2xx as "use the local coach answer".
 *
 * Same no-credentials posture as the other two CoachApi routes: request-rate throttling and
 * reserved concurrency in the stack are the barrier against unbounded Bedrock spend.
 */

const MAX_QUESTION_LENGTH = 300; // matches classifyIntent.ts
const MAX_HAND = 20; // a real concealed hand is 13–14 tiles
const MAX_DISCARDS = 40;

interface CoachBody {
  question?: unknown;
  position?: unknown;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body: CoachBody;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Malformed JSON body" });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return json(400, { error: `question is required and must be <= ${MAX_QUESTION_LENGTH} chars` });
  }

  const raw =
    body.position && typeof body.position === "object" ? (body.position as Record<string, unknown>) : {};
  const position = {
    ...raw,
    hand: Array.isArray(raw.hand) ? raw.hand.slice(0, MAX_HAND) : [],
    discards: Array.isArray(raw.discards) ? raw.discards.slice(0, MAX_DISCARDS) : [],
  };

  try {
    const answer = await runCoachAnswer({ question, position });
    return json(200, { answer });
  } catch (err) {
    console.error("coachAnswer: unexpected failure", err);
    return json(502, { error: "Coach answer failed" });
  }
};
