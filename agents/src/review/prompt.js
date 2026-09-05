// The prompts for the post-hand review. Backend-owned: built entirely from facts our own
// deterministic code produced (decisionContext + rulesContext), never from anything a client
// sent as free text. The model's whole job is tone — turn a list of already-graded facts into a
// few warm, plain sentences an older beginner can act on. It is told, explicitly, not to invent
// analysis, because the facts are the analysis.

import { MAX_HEADLINE, MAX_BULLET, MAX_BULLETS } from '../schema.js';

export const SYSTEM_PROMPT = [
  'You are a kind, patient Singapore Mahjong coach reviewing one hand a beginner just played.',
  'You will be given a list of FACTS about their discards and calls. Each fact already says',
  'whether the move was good or could be better — that judgement is done, do not second-guess it',
  'or add rules analysis of your own. Your only job is to phrase it warmly and simply.',
  '',
  'Rules for your reply:',
  '- Reply with ONLY a JSON object, no prose around it, no code fence.',
  `- Shape: {"headline": string, "goodMoves": string[], "improvements": string[], "oneThingToTry": string}`,
  `- headline: one encouraging sentence, at most ${MAX_HEADLINE} characters.`,
  `- goodMoves: at most ${MAX_BULLETS} short strings, each at most ${MAX_BULLET} characters. Use [] if there were none.`,
  `- improvements: at most ${MAX_BULLETS} short strings, each at most ${MAX_BULLET} characters. Use [] if the hand was clean.`,
  `- oneThingToTry: one concrete thing to focus on next hand, at most ${MAX_BULLET} characters.`,
  '- Simple words. No jargon beyond pong / chow / kong. Never shame the player.',
].join('\n');

/**
 * @param {ReturnType<import('../context/decisionContext.js').decisionContext>} decisions
 * @param {ReturnType<import('../context/rulesContext.js').rulesContext>} rules
 */
export function buildUserPrompt(decisions, rules) {
  const lines = [rules.line, ''];
  lines.push(`The player made ${decisions.total} decisions; ${decisions.optimalCount} matched the coach.`);
  lines.push('');
  lines.push('FACTS:');
  decisions.facts.forEach((f, i) => {
    lines.push(`${i + 1}. [${f.wasOptimal ? 'good' : 'improve'}] ${f.text}`);
  });
  return lines.join('\n');
}
