// The help coach: what it knows, and how a typed question reaches the right answer.
//
// Every answer is either curated text or computed from the live game state — never generated — so
// it always matches the rules this table is actually playing. Answers are deliberately short:
// MAX_LINES is enforced by test/coach.test.js, because prose has no other way of staying brief.

import { tileName } from './tiles.js';
import { seatWindOf, RULE_LABELS } from './scoring.js';
import { bestDiscard, contextFor, handSummary, claimAdvice, describeDistance } from './advisor.js';

export const MAX_LINES = 3;
export const MAX_LINE_LENGTH = 120;

const WIND_NAMES = { we: 'East', ws: 'South', ww: 'West', wn: 'North' };

const you = (state) => state.players[0];

// ---------------------------------------------------------------------------
// Answers computed from the live position
// ---------------------------------------------------------------------------

function adviceDiscard(state) {
  if (state.phase === 'over') return { title: 'The hand is over', lines: ['Deal a new hand and I can help again.'] };
  if (state.turn !== 0 || state.phase !== 'act') {
    return { title: 'Not your turn yet', lines: ['Ask me again when it is your turn to discard.'] };
  }

  const { tile, shantenAfter, reasons, alternatives } = bestDiscard(you(state), contextFor(state, you(state)));
  const lines = [`Discard ${tileName(tile)}.`];
  if (reasons.length) lines.push(reasons[0]);
  lines.push(
    alternatives.length
      ? `That leaves you ${describeDistance(shantenAfter)}. ${tileName(alternatives[0])} is just as good.`
      : `That leaves you ${describeDistance(shantenAfter)}.`,
  );
  // `tile` alongside the text, not instead of it — Coach.jsx renders it as an image next to the
  // words for a player who finds a picture faster to recognise than a tile's spoken name.
  return { title: 'Best discard', lines, tile };
}

function adviceClaim(state) {
  const options = state.claimOptions || [];
  if (state.phase !== 'claim' || options.length === 0) {
    return { title: 'Nothing to call', lines: ['There is no tile on offer for you right now.'] };
  }

  const claim = options[0];
  const advice = claimAdvice(you(state), claim, state.pending.tile);
  return {
    title: `${claim.type.toUpperCase()} on ${tileName(state.pending.tile)}?`,
    lines: advice.lines,
    tile: state.pending.tile,
  };
}

function adviceProgress(state) {
  const { distance, waits: ready } = handSummary(you(state), state);
  const lines = [`You are ${describeDistance(distance)}.`];

  if (ready.length) {
    lines.push(`Waiting on ${ready.map(tileName).join(' or ')}.`);
  } else {
    const { tile } = bestDiscard(you(state), contextFor(state, you(state)));
    lines.push(`Letting go of ${tileName(tile)} is your best way forward.`);
  }
  return { title: 'How your hand stands', lines };
}

function adviceValue(state) {
  const { best, bonusCount } = handSummary(you(state), state);
  if (!best) {
    return {
      title: 'What your hand is worth',
      lines: [
        'Not enough of your hand is settled to score it yet.',
        bonusCount ? `Your ${bonusCount} bonus tile(s) will add to whatever you finish with.` : 'Ask again once you are closer.',
      ],
    };
  }

  const top = best.score.items[0];
  return {
    title: 'What your hand is worth',
    lines: [
      `Winning on ${tileName(best.tile)} scores ${best.score.tai} tai, paying ${best.score.points}.`,
      top ? `That comes from ${top.name.toLowerCase()}.` : 'That is a plain hand with no bonus pattern.',
      best.score.limited ? 'It is capped at the table limit.' : null,
    ].filter(Boolean),
  };
}

function answerSeat(state) {
  const wind = WIND_NAMES[seatWindOf(0, state.dealer)];
  return {
    title: 'Your seat',
    lines: [
      `You are ${wind} this hand${state.dealer === 0 ? ', and you are the dealer' : ''}.`,
      `The prevailing wind is ${WIND_NAMES[state.prevailingWind]}.`,
      'A triplet of either wind is worth 1 tai.',
    ],
  };
}

function answerWall(state) {
  return {
    title: 'The wall',
    lines: [
      'The wall is the pile nobody has drawn from yet.',
      `${state.wall.length} tiles are left.`,
      'If it runs out, the hand is a draw and nobody pays.',
    ],
  };
}

function answerLimit(state) {
  return {
    title: 'The limit hand',
    lines: [
      `The most a hand can score here is ${state.rules.limit} tai.`,
      'A hand worth more than that still only pays the limit.',
      'You can change the cap in Settings.',
    ],
  };
}

function answerTai(state) {
  return {
    title: 'Tai and payment',
    lines: [
      'Tai are the points a winning hand is worth.',
      'Each tai doubles the payout: 1 tai pays 1, 3 tai pays 4, 5 tai pays 16.',
      state.rules.discarderPaysAll
        ? 'Here, whoever threw the winning tile pays for everyone.'
        : 'Here, all three losers pay their own share.',
    ],
  };
}

function answerRules(state) {
  const on = Object.keys(RULE_LABELS).filter((k) => state.rules[k] === true).length;
  return {
    title: 'Your table rules',
    lines: [
      `${on} scoring patterns are switched on, with a ${state.rules.limit} tai limit.`,
      'Open Settings to see them all and change any of them.',
      'Singapore scoring varies from table to table, so these are yours to set.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Curated rules answers
// ---------------------------------------------------------------------------

const STATIC = {
  pong: {
    title: 'Pong 碰',
    lines: [
      'Pong means claiming a discarded tile to make three of the same tile.',
      'You need the other two already in your hand.',
      'Anyone can pong, from any player, and it beats a chow.',
    ],
  },
  chow: {
    title: 'Chow 吃',
    lines: [
      'Chow means claiming a discard to finish a run of three in one suit, like 4-5-6.',
      'You may only chow from the player on your left.',
      'A pong, kong or win always takes the tile ahead of you.',
    ],
  },
  kong: {
    title: 'Kong 槓',
    lines: [
      'A kong is all four of the same tile.',
      'Claim a fourth from a discard, or declare it from your own hand on your turn.',
      'You then draw a replacement from the back of the wall.',
    ],
  },
  win: {
    title: 'How to win',
    lines: [
      'A winning hand is four sets plus one pair.',
      'A set is three of a kind, four of a kind, or a run of three in the same suit.',
      'You can win on a tile you draw or on one someone discards.',
    ],
  },
  flowers: {
    title: 'Flowers and seasons',
    lines: [
      'These are bonus tiles. They are set aside for you and you draw a replacement.',
      'The one matching your seat is worth 1 tai.',
      'All four flowers, or all four seasons, is worth 2 tai.',
    ],
  },
  dealer: {
    title: 'The dealer',
    lines: [
      'The dealer sits East and starts with one extra tile.',
      'The dealer discards first, without drawing.',
      'The deal passes to the next player each hand.',
    ],
  },
  concealed: {
    title: 'Calling costs you concealment',
    lines: [
      'Tiles you claim sit face up for everyone to see.',
      'That tells the other players what you are collecting.',
      'It is usually still worth it if the call brings you closer to winning.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/**
 * Intents in order — the first pattern to match wins.
 * Advice about *this* position is listed before the general rules, so "should I pong this?" is
 * answered about the tile on the table while "what does pong do?" gets the rule.
 *
 * `keywords` are a looser safety net: when no `patterns` entry matches, `ask()` scores each intent
 * by how many of its keywords appear as whole words (or phrases) in the question. A single intent
 * has to hold the top score outright — a tie means the words point at more than one intent, which
 * is not confident enough, so the question falls through to `fallback()` instead. Lists are
 * deliberately narrow and Mahjong-specific so a stray common word can't misroute a question.
 */
export const INTENTS = [
  { id: 'advice.discard', answer: adviceDiscard,
    patterns: [
      /what.*(should|do).*(discard|throw|play)/, /(best|optimal|right).*(play|move|discard|tile)/,
      /which tile/, /what.*(get rid of|let go)/, /^(discard|throw)\??$/,
      /what (should i|do i|to) do( now| here)?\??$/, /\bmy (move|turn)\b/, /\bwhat now\b/,
    ],
    keywords: ['discard', 'discarding', 'throw', 'dump', 'toss', 'chuck', 'ditch'] },
  { id: 'advice.claim', answer: adviceClaim,
    patterns: [
      /should i.*(pong|peng|chow|chi|kong|gang|call|take|claim)/,
      /(worth|good idea).*(pong|chow|kong|calling)/, /(pong|chow|kong).*(this|it|that one)/,
    ],
    keywords: ['call', 'calling', 'claim'] },
  { id: 'advice.progress', answer: adviceProgress,
    patterns: [
      /how (close|near|far)/, /am i (close|near|ready|winning)/, /(tiles?|much).*(away|left to win)/,
      /waiting (on|for)/, /can i win/,
    ],
    // "close" / "near" are left to the patterns above — as bare keywords they catch "close the
    // coach" / "near the end" and route a UI or filler question to a position readout.
    keywords: ['tenpai', 'waiting', 'behind', 'progress'] },
  { id: 'advice.value', answer: adviceValue,
    patterns: [
      /(my|i).*(hand).*(worth|score|tai)/, /how (many|much).*(tai|points|worth).*(i|my|me)/,
      /what.*my hand.*worth/, /score my hand/, /how much (is|would|are).*(hand|this|it|these)/,
    ],
    keywords: ['worth', 'value'] },
  { id: 'rules.limit', answer: answerLimit,
    patterns: [
      /limit/, /maximum|max.*(tai|score|payout)/, /cap/,
      /(biggest|largest|highest).*(hand|score|tai|win|payout)/,
    ],
    keywords: ['limit', 'cap', 'capped', 'maximum', 'ceiling'] },
  { id: 'rules.tai', answer: answerTai,
    patterns: [/\btai\b/, /scoring|score|points|payment|pay(s|ing)?\b/, /how much.*win/],
    keywords: ['tai', 'points', 'payout', 'payment', 'scoring'] },
  { id: 'rules.table', answer: answerRules,
    patterns: [/house rules?/, /(what|which) rules/, /settings/],
    keywords: ['rules', 'settings', 'house', 'variant', 'toggles'] },
  { id: 'rules.wall', answer: answerWall,
    patterns: [/\bwall\b/, /tiles? (left|remaining)/, /run out/, /\bdraw game\b/],
    keywords: ['wall', 'remaining', 'pile', 'stock', 'undrawn'] },
  { id: 'rules.seat', answer: answerSeat,
    patterns: [/(my )?seat/, /prevailing/, /which wind/, /\bwind\b/],
    keywords: ['seat', 'wind', 'prevailing'] },
  { id: 'rules.dealer', answer: () => STATIC.dealer,
    patterns: [/dealer|banker/],
    keywords: ['dealer', 'banker'] },
  { id: 'rules.pong', answer: () => STATIC.pong,
    patterns: [/\b(pong|peng|pung)\b/, /three of a kind/, /triplet/],
    keywords: ['pong', 'peng', 'pung', 'triplet'] },
  { id: 'rules.chow', answer: () => STATIC.chow,
    patterns: [/\b(chow|chi|chii)\b/, /\brun\b/, /\beat\b/, /straight/],
    keywords: ['chow', 'chi', 'chii', 'sequence', 'consecutive'] },
  { id: 'rules.kong', answer: () => STATIC.kong,
    patterns: [/\b(kong|gang|kan)\b/, /four of a kind/],
    keywords: ['kong', 'gang', 'kan', 'quad'] },
  { id: 'rules.win', answer: () => STATIC.win,
    patterns: [/how\b.*\bwin(ning)?\b/, /\b(win|hu|mahjong|winning hand)\b/, /complete.*hand/],
    keywords: ['win', 'winning', 'mahjong'] },
  { id: 'rules.flowers', answer: () => STATIC.flowers,
    patterns: [/flower|season|bonus tile|animal/],
    keywords: ['flower', 'flowers', 'season', 'seasons', 'bonus'] },
  { id: 'rules.concealed', answer: () => STATIC.concealed,
    patterns: [/conceal|expose|face up|hide my hand/],
    keywords: ['concealed', 'conceal', 'exposed', 'expose', 'hidden'] },
];

/** The tappable questions offered in the panel, so nobody has to type to get help. */
export const QUICK_QUESTIONS = [
  'What should I discard?',
  'How close am I to winning?',
  'What is my hand worth?',
  'What does pong do?',
  'When can I chow?',
  'How do I win?',
];

function fallback() {
  return {
    title: "I'm not sure about that one",
    lines: [
      'Try one of the buttons above, or ask about pong, chow, kong, flowers, tai or the wall.',
      'You can also ask what to discard, or how close you are to winning.',
    ],
  };
}

function build(intent, state) {
  const answer = intent.answer(state);
  return { ...answer, intent: intent.id, lines: answer.lines.slice(0, MAX_LINES) };
}

/**
 * Looser second pass: score each intent by how many of its `keywords` appear in the question as
 * whole words (or, for multi-word keywords, as a phrase). Returns an intent only when exactly one
 * holds the top score — a tie means the words point at more than one intent, so it's returned as
 * `null` and the caller falls through to `fallback()` (and, with Phase 2, on to the model).
 */
function guessIntent(text) {
  const words = new Set(text.split(/[^a-z]+/).filter(Boolean));
  const scored = INTENTS.map((intent) => {
    let score = 0;
    for (const kw of intent.keywords || []) {
      if (kw.includes(' ') ? text.includes(kw) : words.has(kw)) score += 1;
    }
    return { intent, score };
  });

  const top = Math.max(...scored.map((s) => s.score));
  if (top === 0) return null;

  const leaders = scored.filter((s) => s.score === top);
  return leaders.length === 1 ? leaders[0].intent : null;
}

/** Route a question to an answer. Never throws and never returns nothing. */
export function ask(question, state) {
  const text = String(question || '').toLowerCase().trim();
  if (!text) return fallback();

  for (const intent of INTENTS) {
    if (intent.patterns.some((p) => p.test(text))) return build(intent, state);
  }

  // No pattern fit — fall back to a keyword score before giving up entirely.
  const guess = guessIntent(text);
  if (guess) return { ...build(guess, state), matchedBy: 'keyword' };

  return { ...fallback(), intent: 'fallback' };
}

/** Every curated answer, for the brevity test to check. */
export const STATIC_ANSWERS = STATIC;

// ---------------------------------------------------------------------------
// Model-assisted fallback (optional, additive)
// ---------------------------------------------------------------------------
//
// `ask()` above is untouched and stays fully local and synchronous — every existing behaviour,
// and every test against it, is unaffected by anything below this line.
//
// `askWithModel()` wraps it and only reaches for the network when `ask()` returned its guided
// fallback (nothing matched). Two tiers, either of which can be left unconfigured:
//
//   1. classify-intent — the model picks which *existing* rules-accurate handler fits the
//      wording. It never writes what the player reads; guarantees above are untouched.
//   2. coach-answer — the model reads the position and answers in its own words. This one *does*
//      write player-facing text, a deliberate exception (docs/mvp-notes.md #7). It is fenced:
//      the backend builds the facts from advisor.js against this table's rules, the reply is
//      length-checked, the answer is flagged `modelAssisted` for the UI, and any failure falls
//      through to the local `fallback()` — so the floor is always the offline coach.

// import.meta.env only exists under Vite; plain Node (the test runner) leaves it undefined, so
// these are unconfigured — and askWithModel falls straight back to ask() — in every test.
const CLASSIFY_INTENT_URL = import.meta.env?.VITE_CLASSIFY_INTENT_URL;
const CLASSIFY_TIMEOUT_MS = 4000;
const COACH_ANSWER_URL = import.meta.env?.VITE_COACH_ANSWER_URL;
// A cold Lambda plus a Bedrock call; the handler itself allows 15s. Same reasoning as
// review.js's REVIEW_TIMEOUT_MS — the coach is not on any critical path.
const COACH_ANSWER_TIMEOUT_MS = 13000;

/**
 * Calls the backend classifier. Never throws: any failure is reported as `null`.
 *
 * The request carries only the question — nothing else. The backend owns the intent catalogue
 * (backend/shared/intents.json) and builds its own prompt from it; this used to also send the
 * intent list and a free-text "hint" per intent, which let an untrusted caller inject arbitrary
 * text straight into the Bedrock prompt. Sending less is both the fix and the smaller request.
 */
async function classifyIntentRemote(question, url) {
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.intent === 'string' ? data.intent : null;
  } catch {
    return null; // network error, timeout, malformed response — all treated the same
  } finally {
    clearTimeout(timer);
  }
}

/** The `state` subset the coach agent needs to rebuild the position — never opponents' hands. */
function serializePosition(state) {
  const seats = Array.isArray(state.players) ? state.players : [];
  return {
    hand: seats[0]?.hand ?? [],
    melds: seats.map((p) => p?.melds ?? []),
    bonus: seats.map((p) => p?.bonus ?? []),
    discards: state.discards ?? [],
    wallCount: state.wall?.length ?? 0,
    turn: state.turn,
    phase: state.phase,
    dealer: state.dealer,
    prevailingWind: state.prevailingWind,
    rules: state.rules,
    claimOptions: state.claimOptions ?? [],
    pending: state.pending ?? null,
  };
}

/**
 * Asks the coach agent to read the position and answer the question in words. Never throws: any
 * failure (no endpoint, non-2xx, timeout, malformed reply) is reported as `null`.
 */
async function answerFromModel(question, state, coachUrl) {
  if (!coachUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COACH_ANSWER_TIMEOUT_MS);
  try {
    const res = await fetch(coachUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, position: serializePosition(state) }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const { answer } = await res.json();
    const wellFormed =
      answer &&
      typeof answer.title === 'string' &&
      Array.isArray(answer.lines) &&
      answer.lines.length > 0 &&
      answer.lines.every((l) => typeof l === 'string');
    return wellFormed ? { title: answer.title, lines: answer.lines.slice(0, MAX_LINES) } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Route a question exactly like `ask()`, but when the local patterns find nothing, escalate:
 * first to the classifier (pick an existing handler), then to the coach agent (answer in words).
 * Always resolves; never throws.
 *
 * Takes `getState()`, not a state value, and re-reads it after each round trip. The game keeps
 * moving on its own timer while a request is in flight, so answering against the state that is
 * true *now* — not the snapshot from when the question was asked — is what makes "not your turn
 * yet" and the position facts the coach agent gets stay correct.
 *
 * `classifyUrl` / `coachUrl` default to the configured endpoints and only need overriding in
 * tests — Coach.jsx always calls this with just the two arguments.
 */
export async function askWithModel(
  question,
  getState,
  { classifyUrl = CLASSIFY_INTENT_URL, coachUrl = COACH_ANSWER_URL } = {},
) {
  const local = ask(question, getState());
  if (local.intent !== 'fallback') return local;

  // Tier 1: the classifier picks one of the existing, rules-accurate handlers.
  const intentId = await classifyIntentRemote(question, classifyUrl);
  const intent = intentId ? INTENTS.find((i) => i.id === intentId) : null;
  if (intent) {
    const answer = intent.answer(getState());
    return { ...answer, intent: intent.id, lines: answer.lines.slice(0, MAX_LINES), modelAssisted: true };
  }

  // Tier 2: nothing fit a handler — let the coach agent read the position and answer in words.
  const written = await answerFromModel(question, getState(), coachUrl);
  if (written) return { ...written, intent: 'model.coach', modelAssisted: true };

  return local;
}
