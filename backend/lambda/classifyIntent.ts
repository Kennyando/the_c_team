import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

/**
 * "classify-intent": a stateless HTTP route the help coach falls back to when
 * its own local keyword patterns (frontend/src/game/coach.js) find no match.
 *
 * This is deliberately narrow. It does not answer the player's question — it
 * only picks *which one* of the coach's existing, locally-computed answers
 * best fits an unusual phrasing. The model never generates the text a player
 * reads; the answer still comes from coach.js's rules-accurate handlers, so
 * every accuracy guarantee documented in docs/mvp-notes.md (correct by
 * construction, aware of this table's own house-rule toggles) still holds.
 * That is also why this is a plain HTTP endpoint rather than a new WebSocket
 * route: it needs no room, no connection, no game state — just one string in
 * and one label out.
 *
 * The valid intent ids are NOT hardcoded here. The caller (coach.js) sends
 * its own current `INTENTS` list on every request, so this Lambda never goes
 * stale if a new intent is added or renamed on the frontend.
 */

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION });

// Amazon Nova Micro: the cheapest/fastest Bedrock text model, well suited to
// a one-word classification task like this one. Override via context/env if
// your account's Bedrock model access differs.
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "amazon.nova-micro-v1:0";

const MAX_QUESTION_LENGTH = 300;
const MAX_INTENTS = 30;
const INTENT_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/i;

interface ClassifyBody {
  question: string;
  intents: { id: string; hint?: string }[];
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function buildPrompt(question: string, intents: { id: string; hint?: string }[]): string {
  const options = intents.map((i) => `- ${i.id}: ${i.hint || i.id}`).join("\n");
  return [
    "You are classifying a question from a player at a Singapore Mahjong table into exactly one category.",
    "Categories:",
    options,
    "- fallback: none of the above fit",
    "",
    `Question: "${question}"`,
    "",
    "Reply with ONLY the category id from the list above (or the word fallback). No punctuation, no explanation, nothing else.",
  ].join("\n");
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body: ClassifyBody;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Malformed JSON body" });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const intents = Array.isArray(body.intents) ? body.intents : [];

  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return json(400, { error: `question is required and must be <= ${MAX_QUESTION_LENGTH} chars` });
  }
  if (intents.length === 0 || intents.length > MAX_INTENTS) {
    return json(400, { error: `intents must be a non-empty list of at most ${MAX_INTENTS}` });
  }
  const validIds = new Set<string>();
  for (const intent of intents) {
    if (typeof intent.id !== "string" || !INTENT_ID_PATTERN.test(intent.id)) {
      return json(400, { error: `invalid intent id: ${String(intent.id)}` });
    }
    validIds.add(intent.id);
  }

  try {
    const result = await bedrock.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: "user", content: [{ text: buildPrompt(question, intents) }] }],
        inferenceConfig: { maxTokens: 16, temperature: 0 },
      }),
    );

    const raw = result.output?.message?.content?.[0]?.text ?? "";
    // Strict parse: only ever trust an id we were explicitly given, or the literal "fallback".
    // Anything else the model returns (extra words, a made-up id, empty output) is fallback too.
    const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9.]/g, "");
    const intent = validIds.has(cleaned) ? cleaned : "fallback";

    return json(200, { intent });
  } catch (err) {
    // Bedrock unavailable, model access not granted, throttled, etc. — the coach
    // treats this the same as "fallback" and keeps working with its local answer.
    console.error("classifyIntent: Bedrock call failed", err);
    return json(200, { intent: "fallback" });
  }
};
