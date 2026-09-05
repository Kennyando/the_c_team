// The ONE place this package calls a language model.
//
// Every agent flow funnels through `callModel()`. It is a thin wrapper over Bedrock's Converse
// API — the same API backend/lambda/classifyIntent.ts uses — which is model-agnostic, so the
// model is a single environment variable and swapping Nova Micro for Nova Lite or a Claude Haiku
// model on Bedrock is a config change, not a code change.
//
// Cost posture (matches the rest of the repo): the default is the cheapest Bedrock text model,
// temperature is low, and callers pass a tight `maxTokens`. Nothing here retries or fans out.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

// AGENT_MODEL_ID is the knob for this package; it falls back to the same BEDROCK_MODEL_ID the
// classify-intent Lambda already reads, then to the US cross-region inference profile for Amazon
// Nova Micro — cheapest and fastest, and fine until real testing shows a review needs more. In
// the deployed Lambda the CDK stack always sets AGENT_MODEL_ID; this fallback is for local runs,
// and its profile prefix (us./eu./apac.) has to match the region.
export const MODEL_ID =
  process.env.AGENT_MODEL_ID || process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-micro-v1:0';

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
});

/**
 * Send one system + user turn and return the model's raw text. Throws if Bedrock itself fails
 * (unavailable, throttled, access denied) — callers treat that as "no model" and fall back to a
 * deterministic result, they do not surface it to the player.
 *
 * @param {{ system:string, user:string, maxTokens?:number, temperature?:number }} args
 * @returns {Promise<string>}
 */
export async function callModel({ system, user, maxTokens = 400, temperature = 0.2 }) {
  const result = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: user }] }],
      inferenceConfig: { maxTokens, temperature },
    }),
  );
  return result.output?.message?.content?.[0]?.text ?? '';
}

/**
 * Pull the first JSON object out of a model reply. Tolerant of a leading sentence or a ```json
 * fence, since small models sometimes add one despite instructions. Returns null if there is no
 * parseable object — the caller then falls back, exactly as classifyIntent.ts does for a
 * response it can't use.
 */
export function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
