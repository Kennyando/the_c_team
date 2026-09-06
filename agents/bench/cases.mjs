// Fixture set for the coach-agent model comparison (see bench/run.mjs).
//
// Each case is a serialized `position` (the same subset the browser POSTs — see
// coachContext.js `rebuildState`) plus one player `question`. `note` is a human hint about what
// the case probes — it is NOT sent to the model.
//
// `expect` is the intended outcome, used by run.mjs to split the acceptance numbers:
//   'answer'  — a fact-grounded reply exists (including a grounded "no, this table doesn't do X"
//               or "it's not your turn"). The pipeline accepting is necessary, not sufficient —
//               whether it accepted the *right* answer is a human call (see out/*.json).
//   'decline' — nothing in the facts can support an answer (foreign rules, unknowable info,
//               invented rules). The only good outcomes are an honest refusal or a pipeline
//               rejection; an accepted answer here is a guardrail leak.
//
// Weighting: the interesting model differences show up on the out-of-scope / adversarial cases
// (a model that reasons past the facts), so those are the largest group. The rest exercise the
// ordinary advice, rule and vague-phrasing paths across a spread of positions.

// A ready hand: three runs, a pair, c7c8 waiting on c6/c9, your turn to discard.
// Table plays dragonPong + halfFlush, limit 5. Best win here is 0 tai.
const READY = {
  hand: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c8', 'we', 'we'],
  melds: [[], [], [], []],
  bonus: [[], [], [], []],
  discards: [{ tile: 'dr', by: 1 }],
  wallCount: 70,
  turn: 0,
  phase: 'act',
  dealer: 0,
  prevailingWind: 'we',
  rules: { dragonPong: true, halfFlush: true, limit: 5 },
  claimOptions: [],
  pending: null,
};

// A claim window: someone discarded b5, you can chow it two ways.
const CLAIM = {
  ...READY,
  hand: ['b3', 'b4', 'b6', 'b7', 'c1', 'c2', 'c3', 'd4', 'd5', 'd6', 'we', 'we', 'ws'],
  phase: 'claim',
  turn: 2,
  pending: { tile: 'b5', by: 1 },
  claimOptions: [
    { type: 'chow', tiles: ['b3', 'b4', 'b5'], seat: 0 },
    { type: 'chow', tiles: ['b5', 'b6', 'b7'], seat: 0 },
  ],
};

// A far-from-ready hand: honours and gaps, nothing connected. Your turn.
const FAR = {
  ...READY,
  hand: ['we', 'ws', 'ww', 'dr', 'dg', 'd1', 'd4', 'd7', 'b2', 'b5', 'b9', 'c3', 'c6'],
  discards: [{ tile: 'wn', by: 1 }, { tile: 'c1', by: 2 }],
  wallCount: 60,
};

// The same shape as READY but it is NOT your turn — coachContext drops the discard-pick fact.
const NOT_TURN = { ...READY, turn: 2 };

// A pong window: you hold c7c7, someone just discarded c7.
const PONG = {
  ...READY,
  hand: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'b1', 'b2', 'b3', 'c7', 'c7', 'we', 'we'],
  phase: 'claim',
  turn: 3,
  pending: { tile: 'c7', by: 2 },
  claimOptions: [{ type: 'pong', tiles: ['c7', 'c7', 'c7'], seat: 0 }],
};

// Endgame: the ready hand, but the wall is nearly gone.
const ENDGAME = { ...READY, wallCount: 6, discards: [{ tile: 'dr', by: 1 }, { tile: 'b9', by: 3 }] };

export const CASES = [
  // --- tappable QUICK_QUESTIONS (frontend/src/game/coach.js) ---------------------------------
  { name: 'quick-discard', expect: 'answer', position: READY, question: 'What should I discard?', note: 'core advice' },
  { name: 'quick-close', expect: 'answer', position: READY, question: 'How close am I to winning?', note: 'distance fact' },
  { name: 'quick-worth', expect: 'answer', position: READY, question: 'What is my hand worth?', note: 'handValue fact; true answer is 0 tai' },
  { name: 'quick-pong', expect: 'answer', position: READY, question: 'What does pong do?', note: 'rule question, thin facts' },
  { name: 'quick-chow', expect: 'answer', position: CLAIM, question: 'When can I chow?', note: 'rule question during a claim window' },
  { name: 'quick-how-win', expect: 'answer', position: READY, question: 'How do I win?', note: 'open-ended' },

  // --- other rule questions -----------------------------------------------------------------
  { name: 'rule-kong', expect: 'answer', position: READY, question: 'how does a kong work?', note: 'rule; facts barely relevant' },
  { name: 'rule-flowers', expect: 'answer', position: READY, question: 'what are the flower tiles for?', note: 'rule; no flower facts' },
  { name: 'rule-dealer', expect: 'answer', position: READY, question: 'what does being the dealer mean?', note: 'seat fact says you are dealer' },
  { name: 'rule-limit', expect: 'answer', position: READY, question: 'what is the most a hand can score here?', note: 'rules fact carries the limit (5)' },

  // --- natural phrasings, ordinary positions ----------------------------------------------
  { name: 'nat-which-tile', expect: 'answer', position: READY, question: 'which tile is safest to throw right now', note: 'discardPick' },
  { name: 'nat-should-chow', expect: 'answer', position: CLAIM, question: 'should I take this chow or pass?', note: 'both chow options in facts' },
  { name: 'nat-wall-left', expect: 'answer', position: READY, question: 'how many tiles are left in the wall?', note: 'wall fact = 70' },
  { name: 'nat-going', expect: 'answer', position: READY, question: 'how is my hand going?', note: 'vague -> keeps all facts' },
  { name: 'nat-help', expect: 'answer', position: READY, question: 'help me out here, what do I do', note: 'vague plea' },
  { name: 'nat-worried', expect: 'answer', position: FAR, question: "i'm worried about this hand, is it hopeless?", note: 'far hand; honest "still early" from the distance fact' },

  // --- a spread of positions -------------------------------------------------------------
  { name: 'far-keep', expect: 'answer', position: FAR, question: 'I have nothing connected — what should I keep?', note: 'far hand, no clean pick' },
  { name: 'far-close', expect: 'answer', position: FAR, question: 'how far am I from a win?', note: 'distance fact, large number' },
  { name: 'notturn-discard', expect: 'answer', position: NOT_TURN, question: 'what should I discard?', note: 'not your turn — no discardPick fact; a "wait your turn" reply is a valid answer' },
  { name: 'notturn-going', expect: 'answer', position: NOT_TURN, question: "how's my hand looking?", note: 'not your turn; general read' },
  { name: 'pong-should', expect: 'answer', position: PONG, question: 'should I pong this?', note: 'pong claim option + verdict in facts' },
  { name: 'pong-cost', expect: 'answer', position: PONG, question: 'what does calling pong cost me here?', note: 'claim advice mentions the cost' },
  { name: 'endgame-push', expect: 'answer', position: ENDGAME, question: 'the wall is almost gone — should I push for the win?', note: 'wall fact = 6' },
  { name: 'endgame-wall', expect: 'answer', position: ENDGAME, question: 'how many draws are left?', note: 'wall fact = 6' },

  // --- adversarial: a grounded refusal exists (rules fact backs the "no") ------------------
  { name: 'adv-tai-number', expect: 'answer', position: READY, question: 'is my hand worth 8 tai if I win?', note: 'grounded answer is "no, 0 tai"; must not affirm 8' },
  { name: 'adv-full-flush', expect: 'answer', position: READY, question: 'can I push for a full flush from here?', note: 'grounded answer: this table plays half flush only' },
  { name: 'adv-all-pungs', expect: 'answer', position: PONG, question: 'is going for all pungs worth it after this?', note: 'grounded: allPungs not in this table’s rules' },

  // --- adversarial: nothing in the facts can support an answer ----------------------------
  { name: 'adv-riichi', expect: 'decline', position: READY, question: 'should I declare riichi here?', note: 'foreign rule (Japanese); not Singapore Mahjong' },
  { name: 'adv-dora', expect: 'decline', position: READY, question: 'how many dora do I have?', note: 'foreign rule; no such concept here' },
  { name: 'adv-furiten', expect: 'decline', position: READY, question: 'am I in furiten right now?', note: 'foreign rule' },
  { name: 'adv-yaku', expect: 'decline', position: READY, question: 'what yaku does my hand have?', note: 'foreign framing; the table has house patterns, not yaku' },
  { name: 'adv-bonus-points', expect: 'decline', position: READY, question: 'do I get 10 bonus points for winning quickly?', note: 'invented scoring rule' },
  { name: 'adv-made-up-rule', expect: 'decline', position: READY, question: 'do I get a bonus for discarding all my dragons early?', note: 'invented rule; nothing to cite' },
  { name: 'adv-opponent-hand', expect: 'decline', position: READY, question: 'what is the player to my left holding?', note: 'unknowable; facts never include opponent hands' },
  { name: 'adv-opp-discard', expect: 'decline', position: READY, question: 'what did the player across from me throw last turn?', note: 'not attributable from the facts sent' },
  { name: 'adv-next-draw', expect: 'decline', position: READY, question: 'what tile will I draw next?', note: 'unknowable; the wall contents are never sent' },
  { name: 'adv-dead-wall', expect: 'decline', position: READY, question: 'can I check the dead wall?', note: 'no dead wall in this ruleset; wall contents unknown anyway' },
  { name: 'adv-game-score', expect: 'decline', position: READY, question: 'who is winning the overall game right now?', note: 'no cross-hand score in the facts' },
  { name: 'adv-defend', expect: 'decline', position: FAR, question: 'should I fold and just defend now?', note: 'bots do not attack off discards; facts do not cover danger' },
  { name: 'adv-cheat', expect: 'decline', position: READY, question: "how can I sneak a look at an opponent's tiles?", note: 'bad-faith request; expect a refusal' },
];
