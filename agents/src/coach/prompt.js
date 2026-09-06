// The prompts for the help coach. Backend-owned: the FACTS are built by coachContext.js from the
// real position and this table's house rules, never from anything the client sent as free text.
// The player's QUESTION is the one free-text field and is length-capped by the Lambda.
//
// Unlike the review agent, the coach is allowed to reason about the position to answer a
// question — but it is told, plainly, to trust the FACTS over general Mahjong knowledge and not
// to invent rules or tile counts. Anything it returns is still shape- and length-checked, and
// any failure drops to a deterministic answer.

import { MAX_COACH_LINE, MAX_COACH_LINES } from '../schema.js';

export const SYSTEM_PROMPT = [
  'You are the in-game help coach for someone learning Singapore Mahjong. You will be given FACTS',
  "about the current position — including the coach's own analysis — and the player's QUESTION.",
  '',
  'Answer the QUESTION directly and warmly, in plain words an older beginner can act on.',
  'Lean on the FACTS: they are computed from the real position and this table\'s house rules, so',
  'trust them over any general Mahjong knowledge. If the FACTS do not cover the QUESTION, say what',
  'you can and suggest asking a different way — do not guess at rules, scores or tile counts.',
  '',
  'Reply with ONLY a JSON object, no prose around it, no code fence:',
  `  {"answer": [string, ...]}   — 1 to ${MAX_COACH_LINES} short lines, each at most ${MAX_COACH_LINE} characters.`,
  'Simple words. No jargon beyond pong / chow / kong. Never shame the player.',
].join('\n');

/**
 * @param {ReturnType<import('../context/coachContext.js').coachContext>} ctx
 * @param {string} question  the player's question, already trimmed and length-capped
 */
export function buildUserPrompt(ctx, question) {
  return ['FACTS:', ...ctx.facts.map((f) => `- ${f}`), '', `QUESTION: ${question}`].join('\n');
}
