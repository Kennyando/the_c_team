// The help-coach agent — the framework's second agent.
//
//   position ─► coachContext ─► relevantFacts ─► buildUserPrompt ─► callModel ─► parse ─► validate ─► CoachAnswerResult
//                                                                                            │
//                                                               deterministicCoachAnswer ◄───┘  (on ANY failure)
//
// The model reads the structured facts our own advisor.js computed against this table's house
// rules (narrowed to the ones the question is about, then rendered to sentences) and answers in
// words, citing per line the fact ids it rests on. The reply is dropped for a fixed deterministic
// answer if there is no model, it errors, the reply is not `{ "answer": [{ refs, text }] }`, or a
// line: cites an id that was not in the prompt; asserts a scoring pattern this table does not
// play; states a tai / point / wall-count number that contradicts a fact it cited; treats a
// non–Singapore-Mahjong concept (riichi, dora, …) as if it applied; or claims to know a
// concealed hand it was never given (an opponent's tiles). Each of the last three is checked per
// clause and skips a line that is *dismissing* the thing ("no, riichi isn't a rule here"). The
// frontend's local coach is the real offline floor, so the player still always gets a useful
// reply.

import { coachContext, relevantFacts } from '../context/coachContext.js';
import { callModel, parseJsonObject } from '../model.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { deterministicCoachAnswer } from './deterministic.js';
import { isCoachAnswerShape, normalizeCoachAnswer } from '../schema.js';

/** The clause a match sits in: from the previous clause break (,;.) to the next. */
function clauseAround(text, at, len) {
  const before = text.slice(0, at);
  const cut = before.search(/[,;.\n][^,;.\n]*$/);
  const after = text.slice(at + len).split(/[,;.\n]/, 1)[0];
  return `${cut === -1 ? before : before.slice(cut + 1)} ${after}`;
}

// A clause that negates / waves off whatever it is about. Used so "no, don't chase a full flush"
// and "riichi isn't a thing here" are not treated as the model *asserting* those things.
const DISMISSAL =
  /\b(no|not|never|isn'?t|aren'?t|wasn'?t|won'?t|can'?t|cannot|don'?t|doesn'?t|do not|avoid|forget|skip|ignore|instead|rather than|steer clear|stay away|no such|not a (real )?(rule|thing)|does not apply|doesn'?t apply|not worth|too slow|too risky)\b/;
const isDismissed = (clause) => DISMISSAL.test(clause);

// --- scoring pattern the table does not play --------------------------------------------------

// Unambiguous multi-word names for the scoring patterns a model might suggest as a goal. Single
// words like "dragon" or "flower" are left out — they collide with tile names.
const PATTERN_PHRASES = [
  { re: /\b(half|mixed)[- ]?flush\b/, key: 'halfFlush' },
  { re: /\b(full|pure|clean)[- ]?flush\b/, key: 'fullFlush' },
  { re: /\ball[ -]?(pungs?|pongs?|triplets?)\b/, key: 'allPungs' },
  { re: /\ball[ -]?(chows?|sequences?|runs?)\b/, key: 'allChows' },
];

/** True if a line asserts a scoring pattern whose rule key is not in `activeKeys`. */
function namesUnsupportedPattern(text, activeKeys) {
  const t = String(text).toLowerCase();
  for (const p of PATTERN_PHRASES) {
    if (activeKeys.has(p.key)) continue;
    const m = p.re.exec(t);
    if (m && !isDismissed(clauseAround(t, m.index, m[0].length))) return true;
  }
  return false;
}

// --- numbers a cited fact pins down ----------------------------------------------------------

const NUMERIC_SLOTS = [
  { field: 'tai', factType: 'handValue', res: [/(\d+)\s*tai\b/g] },
  { field: 'points', factType: 'handValue', res: [/\bpays?\s+(\d+)\b/g, /(\d+)\s*points?\b/g] },
  { field: 'count', factType: 'wall', res: [/(\d+)\s*tiles?\s+(?:left|remaining|in the wall)\b/g] },
];
const HEDGE =
  /\b(about|around|roughly|approximately|maybe|might|probably|possibly|likely|nearly|almost|up to|at least|or so|several|a few|some|between|~)\b/;
const LIMIT_CONTEXT = /\b(limit|cap|capped|max|maximum|most it can|ceiling)\b/;

/** True if a line states a number for a slot that its cited fact contradicts. */
function misstatesNumber(text, citedFacts) {
  const t = String(text).toLowerCase();
  for (const slot of NUMERIC_SLOTS) {
    const fact = citedFacts.find((f) => f.type === slot.factType);
    if (!fact) continue;
    const limitSlot = slot.field === 'tai' || slot.field === 'points';
    const stated = new Set();
    for (const re of slot.res) {
      for (const m of t.matchAll(re)) {
        const clause = clauseAround(t, m.index, m[0].length);
        if (HEDGE.test(clause) || (limitSlot && LIMIT_CONTEXT.test(clause))) continue;
        stated.add(Number(m[1]));
      }
    }
    if (stated.size === 1 && !stated.has(fact[slot.field])) return true; // one clear number, wrong
  }
  return false;
}

// --- out-of-scope: foreign rules and unknowable opponent hands ------------------------------

// Concepts from other Mahjong variants (mostly Japanese) that don't exist in Singapore Mahjong.
// A line that treats one as applicable here is inventing a rule the facts can't back.
const FOREIGN_RULE =
  /\b(riichi|reach declaration|dora|aka ?dora|kan[- ]?dora|ura[- ]?dora|ippatsu|furiten|nagashi mangan|rinshan|haitei|houtei|pao)\b/;

// A line claiming knowledge of a hand it was never shown — coachContext never includes opponents'
// concealed tiles. "you can't know what they hold" is fine; a positive claim is not.
const OPPONENT_CLAIM =
  /\b(they|them|their|his|her|opponent'?s?|opponents'?|neighbou?r'?s?|other players?|another player|(left|right)[- ]?hand player|player (to|on) (your|the) (left|right))\b[^.;]{0,40}\b(hold|holds|holding|has|have|keeping|sitting on|waiting on|going for)\b/;
const OPPONENT_DISMISSAL =
  /\b(can'?t|cannot|don'?t know|no way|not (visible|shown|known|possible|sure)|never know|impossible to|hidden|concealed|unknown|not tell you)\b/;

function inventsForeignRule(text) {
  const t = String(text).toLowerCase();
  const m = FOREIGN_RULE.exec(t);
  return !!m && !isDismissed(clauseAround(t, m.index, m[0].length));
}

function claimsOpponentHand(text) {
  const t = String(text).toLowerCase();
  const m = OPPONENT_CLAIM.exec(t);
  if (!m) return false;
  const clause = clauseAround(t, m.index, m[0].length);
  return !isDismissed(clause) && !OPPONENT_DISMISSAL.test(clause);
}

/**
 * @param {{ position?:Object, question?:string, useModel?:boolean }} input
 *        `useModel` defaults to true; pass false to force the deterministic answer.
 * @returns {Promise<import('../schema.js').CoachAnswerResult>}
 */
export async function runCoachAnswer({ position, question, useModel = true } = {}) {
  const q = typeof question === 'string' ? question.trim() : '';

  // Nothing to answer, or caller opted out — skip the spend entirely.
  if (!useModel || !q) return deterministicCoachAnswer();

  try {
    const ctx = coachContext(position);
    const facts = relevantFacts(ctx.facts, q);

    const raw = await callModel({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(facts, q),
      maxTokens: 300,
      temperature: 0.3,
    });
    const parsed = parseJsonObject(raw);
    if (!isCoachAnswerShape(parsed)) return deterministicCoachAnswer();

    // Grounding — the boundary shape validation can't give. Any failing check drops the whole
    // reply for the deterministic answer.
    const factById = new Map(facts.map((f) => [f.id, f]));
    if (!parsed.answer.every((line) => line.refs.every((ref) => factById.has(ref)))) {
      return deterministicCoachAnswer();
    }

    const rulesFact = ctx.facts.find((f) => f.type === 'rules');
    const activeKeys = new Set(rulesFact ? rulesFact.keys : []);
    const badLine = (line) => {
      const cited = line.refs.map((r) => factById.get(r)).filter(Boolean);
      return (
        namesUnsupportedPattern(line.text, activeKeys) ||
        misstatesNumber(line.text, cited) ||
        inventsForeignRule(line.text) ||
        claimsOpponentHand(line.text)
      );
    };
    if (parsed.answer.some(badLine)) return deterministicCoachAnswer();

    return normalizeCoachAnswer(parsed);
  } catch {
    // Bedrock unavailable / throttled / access denied, or a context build that threw on a
    // malformed payload — the coach still answers, model-free.
    return deterministicCoachAnswer();
  }
}
