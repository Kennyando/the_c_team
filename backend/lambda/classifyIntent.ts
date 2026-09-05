import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import intentCatalog from "../shared/intents.json";

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
 * The valid intent ids and their classifier hints are NOT client-supplied.
 * They live in backend/shared/intents.json, which this Lambda bundles at
 * build time and frontend/test/coach.test.js cross-checks against coach.js's
 * own INTENTS list (so the two can't silently drift). Earlier versions of
 * this route accepted the intent catalogue from the request body — that let
 * an untrusted caller inject arbitrary free-form text straight into the
 * Bedrock prompt via the "hint" field. The backend now owns that data
 * entirely; the request carries nothing but the player's question.
 */

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION });

// Amazon Nova Micro (US cross-region inference profile): the cheapest/fastest
// Bedrock text model, well suited to a one-word classification task. The CDK
// stack always sets BEDROCK_MODEL_ID; this fallback only applies to a local
// invoke. Match the profile prefix to the region (us./eu./apac.).
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-micro-v1:0";

const MAX_QUESTION_LENGTH = 300;

const VALID_INTENT_IDS = new Set(intentCatalog.map((i) => i.id));

interface ClassifyBody {
  question: string;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function buildPrompt(question: string): string {
  const options = intentCatalog.map((i) => `- ${i.id}: ${i.hint}`).join("\n");
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
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return json(400, { error: `question is required and must be <= ${MAX_QUESTION_LENGTH} chars` });
  }

  try {
    const result = await bedrock.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: "user", content: [{ text: buildPrompt(question) }] }],
        inferenceConfig: { maxTokens: 16, temperature: 0 },
      }),
    );

    const raw = result.output?.message?.content?.[0]?.text ?? "";
    // Exact match only: the trimmed, lowercased output must equal one of our own catalogue ids or
    // the literal "fallback" — nothing is stripped or reshaped first. Extra words, stray
    // punctuation, a made-up id, or empty output all fail this and become fallback too.
    const candidate = raw.trim().toLowerCase();
    const intent = candidate === "fallback" || VALID_INTENT_IDS.has(candidate) ? candidate : "fallback";

    return json(200, { intent });
  } catch (err) {
    // Bedrock unavailable, model access not granted, throttled, etc. — this is a genuine
    // infrastructure failure, not "no match", so it gets a 5xx: monitoring (the CloudWatch alarm
    // on this route in kaki-mahjong-stack.ts) can then tell classifier failures apart from the
    // model successfully picking "fallback". The frontend's classifyIntentRemote() already treats
    // any non-2xx response as "no answer" and falls back to its own local answer, so this changes
    // nothing for the player.
    console.error("classifyIntent: Bedrock call failed", err);
    return json(502, { error: "Bedrock call failed" });
  }
};
