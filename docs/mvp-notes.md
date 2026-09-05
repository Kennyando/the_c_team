# Kaki Mahjong — MVP notes

A working prototype of the app described in `Mahjong rules.pdf`. Run it with:

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm test         # 56 tests: rules accuracy, tile artwork, help coach, table layout
```

Seat 0 is you (bottom of the screen). The other three seats are AI bots named Ah Ma, Ah Gong and
Ah Huat.

## What is built

Roadmap **Phase 2 (game engine)** and **Phase 4 (accessible UI)**, plus the single-player mode.

| Proposal objective | Status |
| --- | --- |
| 1. Rules-accurate Singapore engine | Built — tile set, turn logic, Chow/Pong/Kong/Win validation, tai scoring with limit |
| 2. Elderly-first interface | Built — size slider, high-contrast theme, confirm steps, legal-move highlighting, voice, help coach |
| 3. Single-player vs bots | Built |
| 3. Real-time multiplayer | Deferred (Phase 5) |
| 4. AWS deployment | Deferred (Phase 3) |
| 5. Usability session with elderly testers | Not started (Phase 6) |

### Engine

`src/game/` has no React imports, so these modules lift straight into AWS Lambda handlers when
Phase 3 starts — which is what the proposal's architecture table assumes ("stateless functions
validating moves and scoring each hand").

- `tiles.js` — the tile set, wall, sort order and spoken names.
- `melds.js` — hand decomposition, win validation, legal-call detection, claim priority.
- `scoring.js` — the tai table, limit cap and payouts.
- `engine.js` — deal, draw, discard, flower replacement, claim resolution, hand settlement.
- `bots.js` — heuristic opponents.

### The table

The game is drawn as if you are sitting at it: a wooden-rimmed table receding away from you, the
undrawn wall stacked around its edge, the three opponents at their own sides with their tiles
standing backs-toward-you, and the discards pooled loose in the middle.

**Your own hand is deliberately not part of that.** It renders outside the perspective entirely —
flat, square to you, full size. The rule that makes this safe is that **nothing interactive is ever
inside the tilted scene**: `Seat` and the discard pool draw tiles with no click handler, so no tap
target in the app is rotated, shrunk or skewed. Alongside that, name plates and scores counter-rotate
to stay square to the reader, and the tile just discarded stands up at full size rather than lying
foreshortened in the pool — it is the one thing on the table a decision depends on.

Two more things protect legibility:

- **The size slider is damped on the table.** It exists so you can read *your* hand; applied at full
  strength to the felt it makes the opponents' racks and the pool outgrow the table itself. Table
  contents follow `--table-tiles`, a damped version of `--tile-scale`.
- **The discard pool fills from the bottom.** In a long hand it overflows, and clipping the oldest
  discards is much better than clipping the newest.

Seated and flat are one layout with one different value — `--tilt` — rather than two layouts to keep
in sync. `Settings` offers **Seated** (default) or **Flat**, and the tilt also flattens automatically
under `prefers-reduced-motion` and shallows on small screens, where the page scrolls rather than
cropping the table.

`src/components/Table.jsx` builds the scene; `src/game/tableLayout.js` works out the wall ring.

### Tile artwork

Tiles are drawn as inline SVG in the traditional style, so players see the faces they already know
rather than an abstraction of them:

- **Dots and Bamboo** use the traditional pip arrangements — 3 Dots on a diagonal, 5 as a quincunx,
  7 Dots as three slanted above a 2×2, 8 Bamboo as two slanted groups, and 1 Bamboo as the bird.
  The red centre cane of 5 Bamboo and the red crown of 7 Bamboo are painted as on a real set.
- **Characters** show the Chinese numeral over 萬; **Winds** and the Red and Green Dragons are their
  characters, because on a real set that *is* their artwork; the **White Dragon** is the traditional
  blue double frame on a blank tile.
- **Flowers** carry their plants (plum, orchid, chrysanthemum, bamboo).
- A small **corner numeral** indexes every suited tile, the way a playing card does, so nobody has to
  count nine pips to read a tile.

Faces live in `src/components/tileArt.js` (layout data, plain JS) and `TileFace.jsx` (the SVG
renderer). Because they are SVG with a `viewBox`, they scale with the size slider exactly like
everything else, and their colours come from CSS variables so the high-contrast theme flattens the
whole set to black on white in one place.

**Stylised, not authentic:** the four Season tiles traditionally show figurative scenes (fisherman,
woodcutter, farmer, scholar) that do not survive being drawn at tile size, so they get a simple
seasonal mark plus their number instead. The 4 optional animal tiles keep character faces for the
same reason.

Settings offers **Traditional tiles** (default) or **Big numbers** — one large numeral per tile — for
testers whose vision makes pips hard to count. The proposal's Phase 6 usability session is exactly
where that choice should be evaluated.

### Help coach

A button in the bottom-right corner opens a panel that answers questions about the rules and about
the hand in front of you — "what does pong do?", "what should I discard?", "how close am I?".

**It runs entirely locally.** No API key, no backend, no network call, no per-question cost. That is
not only cheaper, it is more accurate here:

- It reads the **actual game state**, so discard advice is computed from the real hand rather than
  guessed at.
- It reads **your own house-rule toggles**, so it can never contradict the settings your table is
  playing under — something a general language model has no way of knowing.
- **Singapore rules are the variant a general model knows least well.** The proposal's own problem
  statement notes that most available material covers Hong Kong, Riichi or Chinese Official instead.

The trade-off is that it matches questions by keyword, so an unusual phrasing can miss. Six tappable
questions are offered above the text box for exactly that reason — recognising a question is easier
than composing one, which suits the audience anyway.

- `src/game/advisor.js` — the position maths: distance from winning, best discard and why, which
  tiles you are waiting on, whether a call is worth taking, what the hand would score.
- `src/game/coach.js` — the curated rules answers and the question routing.
- `src/components/Coach.jsx` — the panel. Scales with the size slider, works in the contrast theme,
  becomes a bottom sheet on narrow screens, and reads answers aloud when voice is on.

Discard advice ranks each tile by **how close the hand would still be after letting it go**, which
makes it better founded than the bots' own play — they only consult `keepValue`, which the coach
uses just as a tie-break. Both share that one function, so advice and play cannot drift apart.

Proactive hints are **off by default**: when switched on, the Help button gets a quiet mark when a
call is available and the panel leads with a tip. Nothing pops up, nothing makes a sound, and there
is no timer anywhere — Section 4 is explicit that time pressure is the thing to avoid.

### Accessibility (proposal Section 6)

- **One size control.** The slider sets a single `--tile-scale` CSS variable; tiles, text, buttons
  and tap targets are all derived from it, so nothing is left behind at large sizes.
- **High-contrast theme.** Pure black/white with yellow focus rings. Tile faces are identified by
  pip count, shape and corner numeral — never by colour, which is decoration only — so every rank
  stays distinguishable for colour-blind players and in the flattened black-on-white theme.
- **Confirm before anything irreversible.** Discards and calls both go through an "Are you sure?"
  dialog with large Yes/No targets.
- **Legal-move highlighting.** Every Chow/Pong/Kong/Win you are entitled to appears as its own large
  button, so no opportunity has to be spotted by the player.
- **Voice narration.** The browser's built-in Web Speech API, off by default. Amazon Polly would
  slot in behind `hooks/useNarration.js` without the rest of the app changing.
- **No timers anywhere.** "Kopitiam mode" is the only mode.
- Minimum tap target is 56px, above the 48px guideline the proposal's Section 9 check calls for.

## A correction to the proposal

Section 5 says *"136-tile set: three suits … Wind tiles … Dragon tiles …, and 8 bonus tiles"*.
Those numbers do not add up: 108 suited + 16 wind + 12 dragon is **already 136**, so adding 8 bonus
tiles gives **144**. This build uses 144, with the 4 animal tiles (for the 148-tile set some
Singapore tables use) available as a house rule. Worth fixing in the proposal text.

## Scoring defaults

Every pattern is switchable from the house-rules screen, since the proposal rightly notes Singapore
scoring is "subject to table-to-table agreement".

| Pattern | Tai |
| --- | --- |
| Seat flower / season | 1 each |
| All four flowers, or all four seasons | 2 |
| Dragon pong/kong | 1 each |
| Seat wind pong/kong | 1 |
| Prevailing wind pong/kong | 1 |
| All chows 平胡 | 1 |
| All pungs 对对胡 | 2 |
| Half flush 混一色 | 2 |
| Full flush 清一色 | 4 |
| **Limit** | **5 (configurable)** |

Points double per tai (1→1, 2→2, 3→4, 4→8, 5→16). On a self-draw all three losers pay; on a discard
win the discarder covers all three by default, which is switchable.

Where a hand can be read more than one way, the engine evaluates every reading and keeps the
highest-scoring one.

## Known simplifications

These are deliberate MVP boundaries, not defects:

1. **No minimum tai to win.** Many Singapore tables require at least 1 tai to go out. A 3,000-hand
   simulation of this build finished 41% of its wins as 0-tai chicken hands, which is higher than a
   real table would see. This is the clearest next rules change, and belongs as a house-rule toggle.
2. **No special hands.** Thirteen wonders, seven pairs, all honours, heavenly/earthly hand and
   robbing the kong are not implemented. Proposal Section 5 lists these as a configurable set.
3. **Sacred discard / furiten** is not enforced.
4. **Prevailing wind is always East** — there is no four-round game structure yet; the dealer rotates
   each hand and scores carry over.
5. **Bots are heuristic, not strategic.** They keep pairs and neighbours, drift toward a flush, and
   shed lone honours. No lookahead, no defensive play.
6. **State is in memory only.** Reloading the page starts a fresh session — no profiles, friends
   list or game history (those need Phase 3's Cognito and DynamoDB).
7. **The coach understands set phrasings, not free-form English — partially addressed.** It covers
   the questions players actually ask, and offers tappable ones, so an unusual wording used to fall
   straight back to a menu of suggestions. `askWithModel()` in `src/game/coach.js` now escalates
   exactly that case to a Bedrock-backed classifier (`backend/lambda/classifyIntent.ts`, deployed
   separately) which picks which *existing* local answer fits — the model never writes what the
   player reads, so the accuracy guarantees above are unchanged. Optional: with no backend deployed
   (`VITE_CLASSIFY_INTENT_URL` unset), the coach behaves exactly as before, 100% local. The route
   takes no credentials (see `backend/README.md`'s "no credentials — throttling is the actual
   defense" section), so it's deliberately rate-limited and concurrency-capped rather than
   authenticated — appropriate for a same-table coach, but worth revisiting if this ever needs
   real accounts.
8. **Discard advice optimises for speed to a win, not defence.** It does not weigh how dangerous a
   tile is to throw, because the bots do not play to win off discards yet.
9. **`state.decisions` is groundwork, not a feature yet.** `engine.js` now records a structured
   entry (chosen vs. `advisor.js`-recommended move, and whether they matched) for every discard and
   claim decision the human faces, alongside the existing narrative `state.log`. Nothing reads it
   yet — no UI, no post-game review. It exists so a future teaching agent (explaining reasoning,
   setting puzzles, reviewing a finished hand for mistakes) has real decision history to work from
   instead of having to reconstruct it from the narrative log.

## Deferred to later phases

AWS deployment, Cognito auth, DynamoDB game state, WebSocket multiplayer rooms with room codes,
friends list, sticker reactions, family-visible game history, session-length reminders, and the
React Native packaging for iOS/Android.

## Testing

`npm test` runs 59 cases. Twenty-one cover the rules — wall composition, the deal, win validation,
each scoring pattern, the limit cap, ambiguous-hand readings, chow-only-from-the-left, claim
priority, kong detection, seat winds and payouts. The other nine cover the tile artwork: that all 46
distinct faces resolve, that each rank draws exactly that many pips, that no pip or cane overflows
the tile or collides with its neighbour, and that no two ranks draw identically. Twenty-four
cover the help coach: the distance-from-winning maths against hand-built positions, discard and call
advice, question routing (including that "should I pong this?" gets advice while "what does pong do?"
gets the rule), that **every answer stays within the length budget** — the brevity requirement
checked mechanically rather than by good intentions — that `askWithModel()` matches `ask()`
exactly both when a local pattern already fits and when no classifier endpoint is configured, and
that `coach.js`'s intent ids never drift from `backend/shared/intents.json`, the classifier's own
catalogue. Five
more cover the table's wall ring: that it accounts for every tile, stays balanced across the four
edges, thins as the wall is drawn, and never produces a negative or ragged ring.

The backend has its own suite: `cd backend && npm test` runs 17 cases against the classify-intent
Lambda (mocked Bedrock, no AWS calls) covering request validation and every way the model could
misbehave, plus `npm run test:integration` — a cross-package smoke test proving `askWithModel()`
and the real compiled Lambda actually agree on the request/response shape, not just that each
side's own tests pass in isolation. See `backend/README.md`'s Testing section.

The engine was additionally soak-tested over 3,000 complete bot-vs-bot hands, asserting on every
single step that tiles are conserved (wall + hands + melds + flowers + discards = 144), that hand
sizes stay legal for the phase, that no bonus tile is ever left in a hand, and that payments sum to
zero. All 3,000 hands terminated.

The coach was soak-tested the same way: 19,800 questions asked at every human decision point across
120 complete games, checking that it never fell back to "I don't know", never produced a malformed
or over-long answer, and routed every question to the intended handler.
