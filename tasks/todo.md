# Kaki Mahjong — MVP Todo

Source: `Mahjong rules.pdf` proposal. Scope = roadmap Phase 2 (game engine) + Phase 4 (accessible UI),
single-player vs 3 AI bots. AWS backend and real-time multiplayer are deferred (proposal Section 10
says to ship single-player first as the always-working fallback).

## Todo

- [x] 1. Scaffold `frontend/` — package.json, vite.config.js, index.html, main.jsx
- [x] 2. `src/game/tiles.js` — 144-tile set, wall builder, display names, tile faces
- [x] 3. `src/game/melds.js` — hand decomposition, win check, legal Chow/Pong/Kong detection
- [x] 4. `src/game/scoring.js` — Singapore tai table, limit cap, payouts, house rules
- [x] 5. `src/game/engine.js` — deal, draw, discard, flower replacement, claim resolution
- [x] 6. `src/game/bots.js` — 3 heuristic AI opponents
- [x] 7. `src/components/` — Tile, Seat, Hand, CallBar, ConfirmDialog, ScoreSheet, Settings
- [x] 8. `src/hooks/useNarration.js` — Web Speech API narration
- [x] 9. `src/styles.css` — tile-scale slider variable, high-contrast theme, 56px tap targets
- [x] 10. `src/App.jsx` — game loop wiring, bot pacing, confirm gating
- [x] 11. `test/engine.test.js` — hand-verified sample hands (proposal Section 9)
- [x] 12. `docs/mvp-notes.md` — what's built, what's deferred, the 136-vs-144 tile-count correction
- [x] 13. Run tests + dev server, hand over the localhost link

## Review

### What was built

A playable Kaki Mahjong MVP at **http://localhost:5173** — one human player versus three AI bots
(Ah Ma, Ah Gong, Ah Huat), on a rules-accurate Singapore engine with an elderly-first interface.

**Game engine** (`frontend/src/game/`, ~600 lines, no React imports anywhere). Kept free of UI
dependencies on purpose so these modules lift straight into AWS Lambda handlers in Phase 3, which is
exactly what the proposal's architecture table assumes.

- 144-tile wall, dealing (dealer 14 / others 13), automatic flower replacement from the back of the
  wall, draw/discard turn flow.
- Win validation by recursive decomposition into four sets plus a pair, counting exposed melds.
- Legal calls with correct priority (Win > Kong/Pong > Chow) and Chow restricted to the player on
  one's left; concealed and added kongs on your own turn, each drawing a replacement tile.
- Singapore tai scoring with a configurable limit, and payouts that double per tai. Where a hand
  reads more than one way, every reading is scored and the best kept.

**Accessible UI** (`frontend/src/components/`). All four features requested:

- Size slider driving a single `--tile-scale` CSS variable, so tiles, text, buttons and tap targets
  all scale together — nothing gets left behind at large sizes.
- High-contrast black/white theme; every tile carries a glyph *and* a text label, so colour is never
  the only cue.
- "Are you sure?" confirmation before every discard and every call.
- Legal-move highlighting: each available Chow/Pong/Kong/Win gets its own large button.
- Voice narration through the browser's built-in speech, off by default, behind a hook that Amazon
  Polly can later replace without touching anything else.
- No timers anywhere — untimed "kopitiam mode" is the only mode.

**House rules screen.** Every scoring pattern, the limit value, the discarder-pays-all convention and
the 148-tile animal set are all individually switchable, since the proposal stresses Singapore
scoring is settled table by table.

### One bug found and fixed at the root

Dragons (`dr`, `dg`, `dw`) share the `d` prefix with the Dots suit and are also two characters long,
so the original `isSuited` test read every dragon as a Dots tile. That silently corrupted three
things at once: dragon pongs scored as "NaN Dots pong", half flushes were misread as full flushes,
and dragons would have been offered in illegal chows. Fixed at the source in `isSuited` by also
requiring the second character to be a digit, rather than patching the three symptoms separately.

### Verification

- `npm test` — 21 rules-accuracy tests pass, covering wall composition, the deal, win validation,
  each scoring pattern, the limit cap, ambiguous hands, chow-only-from-the-left, claim priority,
  kong detection, seat winds and payouts.
- Soak test of 3,000 complete bot-vs-bot hands, asserting on every step that tiles are conserved
  (wall + hands + melds + flowers + discards = 144), hand sizes stay legal for the phase, no bonus
  tile is ever left in a hand, and payments sum to zero. All 3,000 terminated; 55 ended as draws.
- `npm run build` succeeds; a server-render smoke test confirms the table renders with the correct
  39 face-down opponent tiles and the dealer's 14-tile hand.

### Worth knowing

- **The proposal's tile count is wrong.** Section 5 describes a "136-tile set … and 8 bonus tiles",
  but 136 is already the total without bonus tiles, so the real figure is 144. Built as 144.
- **No minimum tai to win.** Many Singapore tables require at least 1 tai to go out; without it, 41%
  of simulated wins were 0-tai chicken hands. This is the clearest next rules change and belongs as
  a house-rule toggle. Left out because it wasn't in the agreed scope.
- Special hands (thirteen wonders, seven pairs, all honours), the four-round wind rotation, and
  persistence across page reloads are all deferred. `docs/mvp-notes.md` has the full list.

---

# Follow-up: traditional tile faces

Replace the numeral-and-word tile faces with traditional artwork. Presentation layer only — the
engine is not touched.

## Todo

- [x] 1. `frontend/src/components/tileArt.js` — pip layouts, character faces, motifs, `faceSpec()`
- [x] 2. `frontend/src/components/TileFace.jsx` — SVG renderer (Pip, Stick, bird, motifs)
- [x] 3. `frontend/src/components/Tile.jsx` — pick face by style, export the style context
- [x] 4. `frontend/src/App.jsx` — `display.tileStyle` + provider
- [x] 5. `frontend/src/components/Settings.jsx` — tile-style chooser
- [x] 6. `frontend/src/styles.css` — pip colour vars, contrast overrides, svg sizing
- [x] 7. `frontend/test/tileArt.test.js` — artwork coverage over all 148 tile ids
- [x] 8. Proof sheet render + browser check; update `docs/mvp-notes.md`

## Review

### What changed

Tile faces are now inline SVG drawn in the traditional style, replacing the numeral-and-word faces.
Confined entirely to the presentation layer — nothing in `src/game/` changed except that `tiles.js`
no longer needs to describe faces.

- **`src/components/tileArt.js`** (new) — the layout data as plain JS: pip coordinates for all nine
  Dots and nine Bamboo ranks in a 100×140 viewBox, per-rank pip radii and cane sizes, Chinese
  numerals, honour glyphs and bonus motifs, behind a single `faceSpec()` lookup.
- **`src/components/TileFace.jsx`** (new) — the renderer, built from three primitives: `Pip`
  (ring with a solid centre), `Stick` (a cane cut by two joints) and the 1 Bamboo bird.
- Dots and Bamboo use the traditional arrangements — 3 on a diagonal, 5 as a quincunx, 7 Dots as
  three slanted over a 2×2, 8 Bamboo as two slanted groups, 9 as a 3×3. 5 Bamboo's centre cane and
  7 Bamboo's crown are red, as on a real set.
- Characters became 一…九 over 萬. Winds and the Red/Green Dragons keep their characters — on a real
  set the character *is* the artwork. The White Dragon is now the traditional blue double frame.
- Flowers carry their four plants; each suited tile gets a small corner numeral so nobody has to
  count nine pips.
- **Settings** gained a "Tile pictures" choice: Traditional (default) or Big numbers.

### Two decisions worth noting

**Only Dots and Bamboo could become pictures.** Characters, Winds and Dragons are character tiles by
definition, so "traditional" for them means keeping the Chinese word, not removing it. What changed
there is the Characters suit dropping its Arabic numeral for 五 etc.

**The style toggle uses React context, not a prop.** `Tile` is rendered from six places; threading a
prop through all of them would have touched far more code than the change deserved. The context is
exported from `Tile.jsx`, so `Hand`, `Seat`, `CallBar`, `ScoreSheet` and `ConfirmDialog` were not
modified at all.

### Verification

- `npm test` — 30 pass. The 21 rules tests are untouched and still green; 9 new artwork tests assert
  every one of the 46 distinct faces resolves, each rank draws exactly that many pips, nothing
  overflows the tile or collides with a neighbour, and no two ranks draw identically.
- Rendered a proof sheet of all 46 faces in both themes and inspected them. Three rounds of fixes
  came out of actually looking at it:
  1. The overlap test caught 9 Dots colliding (radius 13 against a 24 gap) and 4 Dots exactly
     touching — radii cut to 11 and 16.
  2. Bamboo canes read as blobs rather than canes at tile size. Redrew the cane as a solid stick cut
     by two thin joints, and gave each rank its own cane size, since one fixed size made the rows of
     8 and 9 run together. Added a test that canes clear each other.
  3. 8 Bamboo's slanted canes crossed into a jumble; the slant eased to ±10° and the spacing widened.
     The autumn leaf rendered as a thin sliver and the bamboo flower as a "T" — both redrawn.
- `npm run build` clean; SSR smoke test confirms the app renders 15 traditional faces on the opening
  table; high-contrast theme verified to flatten every face to black on white with all ranks still
  distinguishable by shape alone.

### Known limitation

The four Season tiles are **stylised, not authentic** — a real set shows figurative scenes
(fisherman, woodcutter, farmer, scholar) that do not survive being drawn at tile size, so they carry
a simple seasonal mark plus their number. The 4 optional animal tiles keep character faces for the
same reason. Both are recorded in `docs/mvp-notes.md`.

---

# Follow-up: in-game help coach

A local coach in the bottom-right corner that explains rules and advises on the live position.
No LLM, no API key, no backend — answers are computed from the actual game state and house rules.

## Todo

- [x] 1. `frontend/src/game/advisor.js` — shanten, best discard, waits, claim advice, hand summary
- [x] 2. `frontend/src/game/coach.js` — rules knowledge base, intent routing, `ask()`
- [x] 3. `frontend/src/game/bots.js` — export `keepValue` so coach and bots share one evaluation
- [x] 4. `frontend/src/hooks/useNarration.js` — export `speak()` for reuse
- [x] 5. `frontend/src/components/Coach.jsx` — floating button and panel
- [x] 6. `frontend/src/styles.css` — coach button and panel styling
- [x] 7. `frontend/src/App.jsx` + `Settings.jsx` — mount coach, proactive-hints toggle
- [x] 8. `frontend/test/coach.test.js` — advisor maths, routing, brevity, scripted position
- [x] 9. Browser check; update `docs/mvp-notes.md`

## Review

### What was added

A help coach in the bottom-right corner. It answers rules questions ("what does pong do?") and
questions about the live position ("what should I discard and why?", "how close am I?"). Additive
only — no existing game behaviour changed, and the 30 earlier tests were untouched and stayed green.

- **`src/game/advisor.js`** (new) — the position maths. `shanten()` measures how many useful tiles
  away a hand is; everything else builds on it: best discard with its reasons, which tiles you are
  waiting on, whether a call is worth taking, and what the hand would score.
- **`src/game/coach.js`** (new) — curated rules answers plus the question router. Advice intents are
  matched before general rules, so "should I pong this?" is answered about the tile on the table
  while "what does pong do?" gets the rule.
- **`src/components/Coach.jsx`** (new) — the panel: six tappable questions first, text box second.
- Settings gained a proactive-hints toggle, off by default.

### Why it is local rather than an LLM

Not a cost decision. The coach reads the actual hand and the table's actual house-rule toggles, so
its advice is correct by construction and can never contradict the group's own settings — which a
general model has no way of seeing. Singapore rules are also the variant such a model knows least
well; the proposal's own problem statement notes most material covers Hong Kong, Riichi or Chinese
Official. The cost is that unusual phrasings miss, which is why tappable questions lead.

### Reuse over reimplementation

The advisor calls the existing `isWinningHand`, `decompose`, `getClaimsFor`, `scoreHand` and
`seatWindOf` rather than restating any rule. The only change to an existing game file was exporting
`keepValue` from `bots.js`, so the coach and the bots share one evaluation instead of drifting
apart. `useNarration.js` gained an exported `speak()` so coach answers and game narration use one
speech path.

Notably, discard advice is **better founded than the bots' own play**: it ranks tiles by how close
the hand would still be after letting each one go, using `keepValue` only as a tie-break.

### One real bug found

`claimAdvice` assumed the claimed tile is first in `claim.tiles`. That holds for pong and kong, but
**not for chow** — `getClaimsFor` returns chow tiles in rank order, so the claimed tile is usually
the middle one. The coach would have modelled the wrong two tiles leaving your hand and given wrong
chow advice. Fixed by passing the claimed tile explicitly and removing it the same way
`applyClaim` does in `engine.js`. The same pass added a guard so a call the hand cannot support is
refused plainly instead of answered with nonsense.

The bug surfaced because a test case of mine was itself invalid — it asked about a pong the hand
could not make. The invalid input is what exposed the missing guard.

### Verification

- `npm test` — 51 pass. The 21 new coach tests cover the shanten maths against hand-built positions
  (complete, ready two different ways, fully disconnected, with exposed melds), discard and call
  advice, routing, and **a mechanical check that every answer stays inside the length budget**,
  since the requirement was that answers be concise and prose has no other way of staying short.
- Soak test: 19,800 questions asked at every human decision point across 120 complete games. Zero
  fallbacks, zero malformed or over-long answers, every question routed to the intended handler.
- Rendered the panel and the full table and inspected both: the panel scales with the size slider,
  works in the high-contrast theme, becomes a bottom sheet on narrow screens, and the Help button
  sits clear of the hand.

### Known limits

1. It understands set phrasings, not free-form English. A language model could interpret the
   question while keeping these locally-computed answers — that is the upgrade path if wanted.
2. Discard advice optimises for speed to a win, not safety; it does not weigh how dangerous a tile
   is to throw, because the bots do not play to win off discards yet.

---

# Follow-up: seated point-of-view table

Make the table look like you are sitting at it, while keeping your own hand flat, front-on and
full size. Presentation only — no game logic changes.

## Todo

- [x] 1. `frontend/src/game/tableLayout.js` — `wallStacks()`, pure and testable
- [x] 2. `frontend/src/components/Table.jsx` — scene: surface, rim, wall, discard pool, seats
- [x] 3. `frontend/src/components/Seat.jsx` — standing racks, labels square to the reader
- [x] 4. `frontend/src/styles.css` — perspective, rim, racks, stacks, pool, hand ledge
- [x] 5. `frontend/src/App.jsx` — render Table, move Hand out flat, pass the view setting
- [x] 6. `frontend/src/components/Settings.jsx` — Table view toggle
- [x] 7. `frontend/test/tableLayout.test.js` — wall stack distribution
- [x] 8. Screenshot both views, themes and widths; update `docs/mvp-notes.md`

## Review

### What changed

The game is now drawn from your seat: a wooden-rimmed table receding away, the undrawn wall stacked
around its edge, the three opponents at their own sides with tiles standing backs-toward-you, and the
discards pooled loose in the middle. Presentation only — no game logic touched, and the 51 earlier
tests stayed green throughout.

- **`src/components/Table.jsx`** (new) — the scene.
- **`src/game/tableLayout.js`** (new) — `wallStacks()` and `spread()`, pure and tested.
- **`Seat.jsx`** — opponents became standing racks with name plates that stay square to the reader.
- **`App.jsx`** — `Hand` moved out of the table into a flat sibling below the scene.
- Settings gained a **Table view: Seated / Flat** choice, defaulting to seated.

### How your hand stayed readable

The requirement was a POV view *without* losing sight of your own tiles, and perspective
foreshortening is exactly what defeats presbyopia and cataracts. Three things hold that line:

1. **Nothing interactive is inside the perspective.** Everything in the scene is display-only, so no
   tap target anywhere in the app is rotated, shrunk or skewed. Your hand sits outside it entirely —
   same size, same orientation, same targets as before.
2. **All text counter-rotates**, so no label is ever read on a receding plane.
3. **The tile just discarded stands up at full size** instead of lying flat, since that is the one
   piece of table information a decision actually depends on.

Two calibrations came out of looking at the result rather than reasoning about it:

- **The size slider is damped on the table.** At full strength the opponents' racks and the pool grew
  until they overflowed the table and pushed name plates off the top. The slider exists to make
  *your* hand readable; the felt now follows a damped `--table-tiles`.
- **The discard pool fills from the bottom**, so a long hand clips the oldest discards rather than
  the newest — the newest being the one you need.

### Three real bugs, all found by looking at renders

1. **`.tile-back` lost its entire rule** when the old layout block was replaced, so every opponent's
   rack rendered as zero-size elements — thirteen invisible tiles per seat.
2. **Z-fighting in the 3D scene.** Inside `preserve-3d`, paint order comes from 3D position, not DOM
   order or `z-index`. In the flat view the felt and the seats both sat at z=0, so the felt painted
   over the seats and sliced their name plates in half. A DOM probe with `elementFromPoint` named the
   culprit — a full-surface transparent `.wall` wrapper winning the sort. Fixed by giving the wall
   `display: contents` so no large plane exists to mis-sort, plus generous depth separation.
3. **The narrow layout collapsed.** Letting the page scroll made the scene's parent indefinite, so
   the surface's `height: 100%` resolved against nothing and the table flattened to a band. Fixed
   with a definite height at that breakpoint.

### Verification

- `npm test` — 56 pass. Five new tests cover the wall ring: every tile accounted for, edges balanced
  within one stack, thinning as the wall is drawn, and no negative or ragged ring on an empty wall.
- Rendered and inspected mid-game positions — real dealt states with discards and exposed melds, not
  empty tables — across seated and flat, both themes, 1280px and 620px wide, and the size slider at
  both ends. Seven rounds of fixes came out of actually looking at them.
- `npm run build` clean; SSR check confirms the scene, wall, pool, hand and coach all mount.

### Known limits

1. In a long hand the pool clips its oldest discards. The newest is always visible, and the count is
   in the log, but there is no way to review the full history.
2. The two side seats read as standing racks facing you rather than turned side-on. A truly
   side-facing rack would put their names on their sides, which is the kind of skewed text this app
   exists to avoid.

---

# Follow-up: fix backend path mismatch, add model-assisted coach fallback

The AWS backend (`backend/`) had never actually built: `bin/app.ts` imported `../lib/kaki-mahjong-stack`
and that stack imported its Lambda handlers from `../lambda/*` and `../lambda/mahjong/*`, but none of
those directories existed — `app.ts`, the handlers, and `kaki-mahjong-stack.ts` itself were sitting in
the wrong places (some at the repo root, not even under `backend/`). Fix that first, then add the
smallest useful step toward the agentic coach: a model classifier in front of the coach's existing
local routing, not a replacement for it.

## Todo

- [x] 1. Move every backend file to the path its own imports already assumed — no import rewrites,
     since the code was written for the right layout, it just wasn't sitting there
- [x] 2. Fix `backend/package.json`'s stale `bin` field (`bin/app.js` → `dist/bin/app.js`, matching
     `tsconfig.json`'s `outDir`)
- [x] 3. Fix `.gitignore`'s bare `lib/` pattern, which silently ignored `backend/lib/` (the exact
     directory the fix moves a real source file into); add the missing `cdk.out/` entry
- [x] 4. `npm install` + `npm run build` (tsc) green in `backend/`
- [x] 5. `npx cdk synth` green in `backend/`
- [x] 6. `backend/lambda/classifyIntent.ts` — new stateless HTTP route, calls Amazon Bedrock
     (Nova Micro by default) to classify a free-text question into one of the coach's own intent ids
- [x] 7. `backend/lib/kaki-mahjong-stack.ts` — `ClassifyIntentFn`, a plain HTTP API (`CoachApi`, CORS
     on) rather than a new WebSocket route, and an IAM policy scoped to the one Bedrock model ARN
- [x] 8. `frontend/src/game/coach.js` — `askWithModel()`, additive only: falls back to the classifier
     only when the existing local patterns in `ask()` find nothing, and only ever uses the model's
     answer to pick which existing local handler to call, never to write the reply itself
- [x] 9. `frontend/src/components/Coach.jsx` — use `askWithModel()`
- [x] 10. `frontend/.env.template` — optional `VITE_CLASSIFY_INTENT_URL`
- [x] 11. `frontend/test/coach.test.js` — cover both `askWithModel()` paths
- [x] 12. Update `backend/README.md` and `docs/mvp-notes.md`

## Review

### What was built

**The backend path mismatch, fixed at the root.** Every file now lives exactly where its own
existing imports already assumed — `backend/bin/app.ts`, `backend/lib/kaki-mahjong-stack.ts`,
`backend/lambda/{connect,disconnect,join,gameAction,advise,util}.ts`, and
`backend/lambda/mahjong/{tiles,shanten,advisor,sanity-test}.ts`. No import needed rewriting: the
code had been written for this layout, it just was never placed in it, so this was a pure move.
`npm run build` and `npx cdk synth` are both green, and the mahjong sanity tests still pass with the
same output as before the move.

Two things a straight move surfaced along the way, both fixed rather than left as follow-ups per
rule 8: `package.json`'s `bin` field pointed at `bin/app.js`, which was never where `tsc` (`outDir:
dist`) would put it — corrected to `dist/bin/app.js`. And `.gitignore` carried a bare `lib/` line
from a Python template, which — unqualified — matches a directory named `lib` at *any* depth,
including the exact `backend/lib/` this fix populates; left alone, a future edit to
`kaki-mahjong-stack.ts` would silently vanish from `git status`. Anchored to `/lib/` (root-only,
matching what it originally meant) rather than removed outright, since nothing else relies on it.
`cdk.out/` was also missing from `.gitignore` and is now there.

**The intent classifier, additive only.** `docs/mvp-notes.md`'s own known-limitation #7 named the
upgrade path: "keep the local answers and use a model only to interpret the question." That's
exactly what `askWithModel()` does. `ask()` itself — every pattern, every computed answer, every
existing test — is untouched. The new function calls `ask()` first; only when that returns
`fallback` does it POST the question to `backend/lambda/classifyIntent.ts`, which asks a Bedrock
model to pick one of the coach's own current intent ids (sent fresh on every request, so the
classifier never goes stale if an intent is added or renamed) or `fallback`. The model's answer is
never shown to the player — it only selects which of the existing local handlers runs, so
`docs/mvp-notes.md`'s accuracy guarantees (rules-correct by construction, aware of this table's own
house-rule toggles) hold exactly as before.

Chose a plain HTTP API over a new WebSocket route because classifying one string needs no room, no
connection, no shared game state — the existing `join`/`action`/`advise` routes all assume a
connected, seated player, which would be pure overhead for "what does this phrase mean."

Every failure mode collapses to the same thing: no `VITE_CLASSIFY_INTENT_URL` configured, a network
error, a timeout (capped at 4s client-side), Bedrock access not granted, or the model returning
something that isn't one of the ids it was given — all of these return the plain local `fallback`
answer, identical to today. The coach cannot be made to work *worse* by this change; it can only
occasionally work better.

### Why not a bot opponent yet

Out of scope for this pass, on purpose. A model-driven bot needs to reason about a full, partially
hidden game state (its own hand, discards, opponents' likely hands, house rules) turn after turn,
and be fast enough not to stall three other players every discard — a much bigger lift than
classifying one short question. `bots.js`'s heuristic is simple, but it is fast, free, and
side-effect-free, and it already produces "a game that feels like a real table," which is the bar
the code comment sets for it. Rule 6 (simplicity, minimal blast radius) argues against replacing a
working, tested piece wholesale before the smaller, higher-leverage change (this one) has even been
tried in practice. Worth revisiting once the classifier is deployed and its cost/latency in real use
is known.

### Verification

- `cd backend && npm install && npm run build` — exit 0, `dist/` mirrors the corrected source tree.
- `cd backend && npx cdk synth` — exit 0; template includes `ClassifyIntentFn`, `CoachApi`, the
  scoped `bedrock:InvokeModel` policy, and the new `ClassifyIntentUrl` output.
- `npx ts-node lambda/mahjong/sanity-test.ts` — all PASS lines unchanged from before the move.
- `cd frontend && npm test` — 58 pass (the prior 56, plus two new `askWithModel` cases).
- `cd frontend && npm run build` — exit 0.

### Known limits

1. **Not deployed.** `cdk synth` proves the template is valid; `cdk deploy` (needs real AWS
   credentials) was not run, so `ClassifyIntentUrl` doesn't exist yet and the coach runs 100% local
   until someone deploys and sets `VITE_CLASSIFY_INTENT_URL`.
2. **Bedrock model access is an AWS-account setting**, not something `cdk deploy` grants by itself —
   Nova Micro (or whichever model id is chosen) needs to be enabled in the Bedrock console for the
   target account/region first, or every classify call will fail closed to the local fallback.
3. **No bot opponent work was done**, deliberately — see above.

---

# Follow-up: fix code-review blockers on classify-intent

A review of the previous change flagged two blockers and a testing gap on `classifyIntent.ts`:
(1) the route calls paid Bedrock, is public, and had no rate limiting at all — unbounded spend
risk; (2) it accepted the entire intent catalogue, including free-form hint text, from the
untrusted client and embedded it straight into the Bedrock prompt — a client-controlled prompt is
unnecessary injection surface; (3) no automated tests existed for the new Lambda at all. Fix all
three, and keep AWS calls to the minimum the whole time — every test below runs against a mocked
Bedrock client and makes zero real calls.

## Todo

- [x] 1. `backend/lib/kaki-mahjong-stack.ts` — explicit throttled `HttpStage` (context-configurable
     `coachApiRateLimit`/`coachApiBurstLimit`, conservative defaults) in place of the implicit
     default stage, plus `reservedConcurrentExecutions` on the Lambda as an independent hard cap
- [x] 2. `backend/shared/intents.json` — new single source of truth for the intent catalogue,
     owned by the backend (bundled into the Lambda at build time), not sent by the client
- [x] 3. `backend/lambda/classifyIntent.ts` — request contract shrinks to `{ question }` only;
     the prompt is now built entirely from the backend's own catalogue
- [x] 4. `backend/tsconfig.json` — `resolveJsonModule` so the catalogue import type-checks
- [x] 5. `backend/scripts/copy-shared-assets.js` + `build` script — copies `shared/` into `dist/`
     so the plain `tsc` output stays self-consistent (esbuild, used for the actual deploy bundle,
     already inlined the JSON automatically and needed no fix)
- [x] 6. `backend/test/classifyIntent.test.ts` — 17 unit tests against the real handler, Bedrock
     mocked via `node:test`'s built-in `mock.method`, zero new dependencies
- [x] 7. `backend/test/integration.coach-classifier.test.mjs` — cross-package smoke test wiring
     the real frontend `askWithModel()` to the real compiled Lambda in-process
- [x] 8. `backend/package.json` — `test` and `test:integration` scripts
- [x] 9. `frontend/src/game/coach.js` — stop sending intents/hints; `askWithModel()` gains an
     optional `classifyUrl` override (test-only dependency injection, default unchanged)
- [x] 10. `frontend/test/coach.test.js` — drift-guard test: `coach.js`'s intent ids vs.
      `backend/shared/intents.json`'s ids must always match exactly
- [x] 11. Update `backend/README.md` and `docs/mvp-notes.md`

## Review

### What was fixed

**Blocker — unbounded Bedrock spend.** `classify-intent` still takes no credentials (see below for
why), so the fix is two independent caps that bound worst-case cost regardless of how many callers
show up: an explicit `HttpStage` with `throttle: { rateLimit: 2, burstLimit: 5 }` (previously the
`HttpApi` used an implicit default stage with no throttle at all), and `reservedConcurrentExecutions:
2` on the Lambda itself — a hard ceiling on concurrent invocations that holds even if the throttle
were ever misconfigured. Both are overridable via CDK context (`coachApiRateLimit`,
`coachApiBurstLimit`, `coachApiConcurrency`) for whenever a real demo needs more headroom. The
`ClassifyIntentUrl` output is unchanged — `$default` is still the stage name, just no longer
implicit — so nothing on the frontend needed to change for this part.

**Blocker — client-controlled prompt.** The route used to accept `{ question, intents }`, where
`intents` was the full catalogue *including a free-text hint per entry*, sent by the frontend so
the Lambda's prompt would always match whatever `coach.js` currently supported. That meant an
untrusted caller could put arbitrary text into the Bedrock prompt via the hint field — the review's
"unnecessary prompt-injection surface." Fixed by moving the catalogue into `backend/shared/intents.json`,
which `classifyIntent.ts` imports at build time (esbuild inlines it for the real deployed bundle;
`resolveJsonModule` makes the same import type-check for plain `tsc`, which needed its own small
fix — see "Two build-only wrinkles" below). The request now carries nothing but the question. A new
test (`ignores any client-supplied intent catalogue...`) sends a deliberately hostile `intents`
field and asserts it never reaches the prompt — this is the regression test for exactly the reported
issue. The "keep it a shared module, not two copies" half of the review's suggestion is what
`frontend/test/coach.test.js`'s new drift-guard test enforces: it fails if `coach.js`'s `INTENTS`
ids and `shared/intents.json`'s ids ever stop matching exactly.

**No automated tests → 17 unit tests + a 2-case integration test.** `backend/test/classifyIntent.test.ts`
runs via `node`'s built-in test runner (`node:test` + `assert/strict`, the same convention the
frontend suite already uses — no new test framework, no new dependency) and mocks
`BedrockRuntimeClient.prototype.send` for every case, so nothing in the suite touches the network
or costs anything. Covers every case the review listed: malformed JSON, a missing/empty/non-string/
oversized question, a valid request, an id the model invents, the model returning `fallback`
verbatim, extra words wrapped around a valid id, mixed case, an empty response, a response with no
content block, a generic Bedrock exception, and a Bedrock permissions failure — the last two both
asserting a plain `200 { intent: "fallback" }`, never a 5xx the coach would have to separately
handle. `backend/test/integration.coach-classifier.test.mjs` answers the review's other point
directly: it imports the *real* compiled Lambda and the *real* frontend `askWithModel()` into one
process and wires the coach's `fetch()` straight into the handler, no HTTP server involved, Bedrock
still mocked. Two cases, matching the review's own two diagrams almost exactly: a mocked
`rules.kong` classification resolving to the actual local kong answer end to end, and a mocked
Bedrock failure resolving to the actual local fallback end to end.

### Two build-only wrinkles the JSON import surfaced

Neither affects `cdk synth`/`cdk deploy` (both run the TypeScript source directly via `ts-node`, or
bundle it via esbuild, which inlines a JSON import automatically) — both would only have bitten
someone running the plain `tsc` output directly, which nothing in this repo currently does, but
they were fixed anyway rather than left as latent traps:

1. `tsc`'s `resolveJsonModule` type-checks a JSON import; it does not copy the JSON file into
   `dist/`. `dist/lambda/classifyIntent.js` would otherwise `require()` a file that doesn't exist
   at that path. `scripts/copy-shared-assets.js` (plain `fs.cpSync`, not a shell `cp` — works the
   same on Windows) now runs as part of `npm run build`.
2. The integration test needs `backend/shared/intents.json` to live inside `backend/`'s `rootDir`
   (it was briefly drafted at the repo root, which is exactly the class of path mismatch the
   previous change fixed — caught before it shipped this time).

### Why an auth layer (e.g. Cognito) wasn't added on top of throttling

The review offered throttling *or* Cognito auth as acceptable fixes for the same blocker; this pass
implements the first. Requiring sign-in for a same-table help coach is a proportionately bigger
change than the coach itself — this project has no sign-in flow anywhere in the frontend yet (see
`docs/mvp-notes.md`'s known simplifications), so wiring one in just to gate this one endpoint would
be a much larger change than the problem calls for right now, and would work against this round's
explicit priority of keeping AWS usage (and effort) to the minimum needed to close the actual risk,
which is unbounded spend — something throttling + concurrency caps close directly. The `UserPool`
this stack already provisions is the natural next step (a JWT authorizer on this route) if the
project ever needs per-player rate limits rather than per-deployment ones; noted in
`backend/README.md` as the explicit next step rather than done speculatively now.

### Verification

- `cd backend && npm run build` — exit 0; confirms `resolveJsonModule` resolves the catalogue and
  `dist/shared/intents.json` is copied.
- `cd backend && npm test` — 17 pass, all against a mocked Bedrock client.
- `cd backend && npm run test:integration` — 2 pass (builds first, then runs the smoke test).
- `cd backend && npx cdk synth` — exit 0; template's `CoachApiDefaultStage` shows
  `ThrottlingRateLimit: 2` / `ThrottlingBurstLimit: 5`, and `ClassifyIntentFn` shows
  `ReservedConcurrentExecutions: 2`.
- `cd frontend && npm test` — 59 pass (the previous 58, plus the new drift-guard test).
- `cd frontend && npm run build` — exit 0.

### Known limits

1. **Throttling bounds request rate, not per-caller identity.** Two legitimate players asking
   unusual questions at the same moment share the same 2 req/s budget as an attacker would. Real
   per-user limits need real accounts (see above).
2. **Not deployed** — same as the previous round; these are template-level and mocked-unit-level
   guarantees, not a live-traffic test against real Bedrock.

# Follow-up: address PR #3 review comments

Five comments on the classify-intent PR, before merge:

1. `backend/README.md` overstates `shared/intents.json` as a "single source of truth" both
   packages read — `coach.js` actually keeps its own separate `INTENTS` array. Correct the docs to
   describe this accurately as a drift-checked contract (already enforced by a test), rather than
   pretend the two are the same file.
2. The API Gateway throttle and reserved concurrency bound the *rate* of Bedrock calls, not total
   dollar spend — a sustained caller at the throttle ceiling, forever, still accumulates unbounded
   cost over time. Fix the comments/docs to say so, and add an AWS Budget cost alert (the actual
   dollar-amount guardrail) since this endpoint is public with no auth.
3. `Coach.jsx`'s `askNow()` has no re-entrancy guard — rapid clicks fire concurrent `askWithModel()`
   calls (and concurrent Bedrock requests once escalated).
4. `classifyIntent.ts` returns HTTP 200 for genuine Bedrock infrastructure failures (throttled,
   unavailable, access denied) — identical to a successful "fallback" classification. Monitoring
   can't tell the two apart. Return 5xx for real failures instead; the frontend already treats any
   non-2xx as "no answer" and falls back locally, so this needs no frontend change.
5. The model-output parser strips arbitrary characters (`replace(/[^a-z0-9.]/g, "")`) before
   checking catalogue membership, instead of exact-matching the trimmed/lowercased string. Tighten
   it to remove the stripping step.

## Todo

- [x] 1. `backend/README.md` — rewrite the "intent catalogue is backend-owned" section to describe
     the ids as a drift-checked contract (test-enforced), not a single shared file
- [x] 2. `backend/lib/kaki-mahjong-stack.ts` — correct the cost-guardrail comments (rate cap, not a
     spend ceiling); add an `aws-budgets` `CfnBudget` scoped to Bedrock cost, gated on a new
     `coachBudgetAlertEmail` context value (skipped with a synth-time warning if unset, since a
     Budget needs a real subscriber); add a CloudWatch alarm on `CoachApi`'s server-error count
     (not the Lambda's own error metric — the handler catches and returns, never throws), so a
     spike in 5xx (see #4) actually pages someone
- [x] 3. `backend/README.md` — document the new `coachBudgetAlertEmail`/`coachBudgetLimitUsd`
     context values alongside the existing throttle ones
- [x] 4. `frontend/src/components/Coach.jsx` — add a `pending` guard so `askNow()` ignores a new
     call while one is already in flight; disable the quick-question buttons and the Ask button
     while pending so the UI shows why
- [x] 5. `backend/lambda/classifyIntent.ts` — return `502` from the Bedrock-call catch block
     instead of a `200` fallback; update its comment to explain why (monitoring visibility) and
     that the frontend needs no change
- [x] 6. `backend/test/classifyIntent.test.ts` — update the two Bedrock-failure tests to expect
     `502`, and reword the section comment
- [x] 7. `backend/lambda/classifyIntent.ts` — replace the character-stripping parse with an exact
     (trim + lowercase) match against the catalogue ids / `"fallback"`
- [x] 8. Run `cd backend && npm test`, `cd backend && npm run test:integration`, and
     `cd frontend && npm test` + `npm run build`; `npx cdk synth` in `backend/` to confirm the new
     Budget/alarm constructs synthesize cleanly both with and without `coachBudgetAlertEmail` set
- [x] 9. Push the updated branch and update PR #3

## Review

### What was fixed

**#1 — drift-contract docs.** `backend/README.md`'s "intent catalogue is backend-owned" section
claimed `shared/intents.json` was "the one file both sides read... a single source of truth," which
was never true — `coach.js` has always kept its own `INTENTS` array (it needs an answer function and
routing patterns per intent, neither of which belongs in the backend's JSON). Reworded to say plainly
that the two are separate, independently-maintained lists whose ids a test
(`frontend/test/coach.test.js`) asserts stay equal — a drift-checked contract, not a shared file.

**#2 — cost is bounded by rate, not a ceiling.** The throttle/concurrency comments in
`kaki-mahjong-stack.ts` and `backend/README.md` now say explicitly that they cap the *rate* of
Bedrock spend, not the total — a caller sitting at the limit forever still runs up unbounded cost
over time, just slowly. Added a `budgets.CfnBudget` scoped to `Service: ["Amazon Bedrock"]`,
alerting by email at 80% of a monthly USD limit. It's gated behind a new `coachBudgetAlertEmail`
context value (AWS Budgets requires a real subscriber address, so there's no safe default), and
`cdk synth`/`deploy` prints a `cdk.Annotations` warning if that context is missing — verified both
ways (`npx cdk synth -c envName=dev` warns; adding `-c coachBudgetAlertEmail=test@example.com`
produces a synthesized `AWS::Budgets::Budget` resource).

**#3 — concurrent askNow().** `Coach.jsx` now guards `askNow()` with a ref (`pendingRef`, checked
and set synchronously — `useState` alone can't prevent a second click in the same tick from also
reading `pending === false` before either re-render lands) so a rapid double-tap or repeated
quick-question click can't fire a second `askWithModel()` while one is in flight. The quick-question
buttons, the text input, and the Ask button are all `disabled` while `pending` is true, so the UI
also visibly shows why a second tap does nothing.

**#4 — 5xx for real Bedrock failures.** `classifyIntent.ts`'s catch block (Bedrock throttled,
unavailable, access denied) now returns `502` instead of folding the failure into the same `200`
a normal "no local match, and the model said fallback" response gets. The frontend needed **no**
change: `classifyIntentRemote()` in `coach.js` already treats any non-2xx response as "no answer"
and returns `null`, so `askWithModel()` falls back to the local answer exactly as before — confirmed
by the (unmodified) integration test, which still passes end-to-end through the real compiled
Lambda. Added `ClassifyIntentServerErrorAlarm`, on `CoachApi`'s `metricServerError()` (the Lambda's
own `metricErrors()` won't fire here — the handler catches the failure and returns a response, it
never throws, so from Lambda's own point of view every invocation "succeeds").

**#5 — exact-match parsing.** Removed the `replace(/[^a-z0-9.]/g, "")` stripping step; the model's
output is now only trimmed and lowercased, then compared for exact equality against the catalogue
ids or the literal `"fallback"` — no reshaping that could let noisy output coincidentally collapse
into a valid id. All existing parser tests (extra words, mixed case, empty response, unrecognised
id) still pass unchanged, since none of them relied on the stripping behavior to reach their
expected result.

### Test plan

- `cd backend && npm test` — 17/17 pass (two tests updated to expect 502 instead of 200; the parser
  and drift behavior needed no test changes).
- `cd backend && npm run test:integration` — 2/2 pass, including the Bedrock-unavailable case,
  confirming the new 502 is still transparent to the frontend's local fallback end-to-end.
- `cd backend && npm run build` — exit 0.
- `cd backend && npx cdk synth -c envName=dev` — synthesizes cleanly; prints the expected budget
  warning.
- `cd backend && npx cdk synth -c envName=dev -c coachBudgetAlertEmail=test@example.com` —
  synthesizes cleanly; `AWS::Budgets::Budget` resource present with the expected properties.
- `cd frontend && npm test` — 59/59 pass, including the drift-guard test (untouched by the
  `Coach.jsx` change) and both `askWithModel` tests.
- `cd frontend && npm run build` — exit 0.

### Known limits

1. **Not manually tested against a live Bedrock endpoint or a live UI.** Every check above is a
   mocked unit/integration test or a template-synthesis check — no `cdk deploy` and no browser
   session exercising `Coach.jsx`'s new disabled-button behavior against a running dev server.
2. **The Budget alert is opt-in.** A deployment that never sets `coachBudgetAlertEmail` still has
   no dollar-amount cost alert — only the pre-existing rate/concurrency caps. The synth-time
   warning is the only nudge toward setting it.

# Planned: structured decision log (step 1 toward a teaching agent)

Goal (from the user): a future agent that teaches the player with reasoning, sets puzzles, and
reviews mistakes after the hand. All three need to know, after the fact, what decision the player
actually faced and what the engine would have done instead — and nothing in `engine.js` records
that today. `state.log` is a narrative string log ("You discarded d5"), not structured data a
review pass could compare against. This step only adds that data; no puzzle generation and no
review UI/agent yet — those are separate follow-ups once this exists to build on.

**Scope decision: only the human's (seat 0) decisions are logged.** The bots use a fixed heuristic
(`bots.js`) that never varies, so there's nothing to "teach" there, and logging every bot discard
would triple the log's size for zero benefit to this feature.

**Scope decision: lives in `engine.js`, not a new module.** `engine.js` already owns every state
mutation and already appends to `state.log` from inside `discardTile`/`resolveClaims`/etc.; adding
a second, structured append in the same places is the smallest change. It's a new import of
`advisor.js` into `engine.js` (currently one-directional the other way: nothing in `advisor.js`
imports `engine.js`, so no cycle), for `shanten`, `bestDiscard`, and `claimAdvice` — the exact
functions the coach already uses to judge a position, so "the engine's recommendation" in the log
is by construction the same recommendation the coach would give live.

## Todo

- [x] 1. `frontend/src/game/engine.js` — add `decisions: []` to the state object built in `newGame`
- [x] 2. `frontend/src/game/engine.js` — import `shanten`, `bestDiscard`, `claimAdvice` from
     `./advisor.js`
- [x] 3. `frontend/src/game/engine.js` — in `discardTile(state, tile)`, before the tile is spliced
     out of `p.hand`: if `p.isHuman`, compute `bestDiscard(p)` and `shanten` on the hand with the
     chosen tile removed, and push a decision entry (shape below) onto `state.decisions`
- [x] 4. `frontend/src/game/engine.js` — in `resolveClaims(state, humanChoice)`, before
     `state.claimOptions` is cleared: if `state.claimOptions.length > 0` (the human had a real
     choice — bots can't claim their own tiles, so a non-empty list always means it was the
     human's opportunity), run `claimAdvice` over each option and push a decision entry
- [x] 5. `frontend/test/engine.test.js` — unit tests (list below)
- [x] 6. `docs/mvp-notes.md` — one paragraph noting the new `state.decisions` log and that it's
     currently unconsumed (no UI or review pass reads it yet — this step is groundwork only)

## Entry shapes

Discard decision:
```js
{
  type: 'discard',
  hand: [...],              // player's hand at the moment of decision (includes the chosen tile)
  melds: [...],              // player's exposed melds at that moment, for context
  chosen: tile,
  recommended: tile,         // bestDiscard(player).tile
  shantenBefore: number,     // shanten(hand, melds) before discarding
  shantenAfterChosen: number,
  shantenAfterRecommended: number,   // === bestDiscard(player).shantenAfter
  reasons: [...],            // bestDiscard(player).reasons — why the recommended tile was picked
  optimal: boolean,          // chosen === recommended, or chosen is one of bestDiscard's `alternatives`
}
```

Claim decision:
```js
{
  type: 'claim',
  pendingTile: tile,          // the discard on offer
  discardedBy: seat,
  options: [{ claim, verdict, lines }, ...],   // claimAdvice(player, claim, pendingTile) per option
  chosen: claim | null,       // what the human actually took, or null if they passed
  recommended: claim | null,  // the first option with verdict 'yes', or null if passing was correct
  optimal: boolean,           // chosen and recommended are both null, or chosen matches recommended
}
```

**Known simplification, noted up front rather than discovered later:** if two different claim
options both have verdict `'yes'` (e.g., both a chow and a pong would advance the hand), only the
first is recorded as `recommended`. `claimAdvice` doesn't rank between two helpful calls today —
teaching "which of two good calls is better" is out of scope for this step.

## Planned unit tests (`frontend/test/engine.test.js`)

- `discardTile` records a decision entry for the human's discard, with `optimal: true`, when the
  human discards the tile `bestDiscard` recommends.
- `discardTile` records `optimal: false` and the correct `shantenAfterChosen` when the human
  discards a tile that leaves them further from winning than the recommended one.
- `discardTile` records `optimal: true` for a tile in `bestDiscard`'s `alternatives` list, not just
  for an exact match on `recommended` — ties should not read as mistakes.
- `discardTile` does **not** push anything onto `state.decisions` for a bot's discard (turn on a
  non-human seat).
- `resolveClaims` records a `'claim'` decision with `chosen: null` and the correct `recommended`
  when the human had a legal, hand-improving call available and passed (`humanChoice` is
  `null`/`undefined`).
- `resolveClaims` records `optimal: true` when the human takes the one call that helps.
- `resolveClaims` records `optimal: false` when the human takes a call `claimAdvice` says doesn't
  help (verdict `'no'`).
- `resolveClaims` pushes **no** decision entry when `state.claimOptions` was empty (nothing for the
  human to decide on that discard).
- A full `newGame()` starts with `state.decisions` as an empty array.

## Review

### What was built

`frontend/src/game/engine.js` now imports `shanten`, `bestDiscard` and `claimAdvice` from
`./advisor.js` (a new, one-directional dependency — `advisor.js` already had none on `engine.js`,
so no cycle) and uses them to append a structured entry to a new `state.decisions` array:

- **`discardTile`** records one whenever the seat about to discard `isHuman`, computed from the
  hand *before* the chosen tile is spliced out, via a new `recordDiscardDecision(player, chosen)`
  helper. `optimal` is true for an exact match on `bestDiscard`'s pick **or** one of its tied
  `alternatives` — a tie is not a mistake.
- **`resolveClaims`** records one whenever `state.claimOptions.length > 0` — the only case where
  the human genuinely had a call to make, since a player can never claim their own discard — via a
  new `recordClaimDecision(state, humanChoice)` helper. It runs `claimAdvice` over every option on
  offer and takes the first `verdict: 'yes'` one as `recommended`; passing (`humanChoice` is
  `null`/`undefined`) is only `optimal` when no option was worth taking either. `chosen` and
  `recommended` are compared by reference, not deep equality — both come from the same
  `state.claimOptions` array elements the UI already passes straight through unmodified
  (confirmed by reading `CallBar.jsx`: it maps over `actions` without cloning), so `===` is exact
  and doesn't need a bespoke claim-comparison function.

Both entry points are the single funnel `App.jsx` already goes through for every human discard and
claim decision (confirmed by reading it before writing any code — `passClaims` is only ever called
internally by `resolveClaims` itself, never directly by the UI), so no other call site needed
touching.

`docs/mvp-notes.md` gets a new known-simplification #9 marking `state.decisions` as groundwork:
nothing reads it yet.

### Test plan

- `cd frontend && npm test` — 68/68 pass (the previous 59, plus 9 new decision-log tests). Two of
  the new claim-decision tests needed a hand redesigned mid-implementation: my first attempt at a
  "this call helps" hand accidentally also satisfied `isWinningHand`, so `getClaimsFor` returned a
  `win` option alongside the `pong` and the assertions on a single clean option failed. Verified the
  final hands against `advisor.js`'s actual `shanten`/`claimAdvice`/`getClaimsFor` output directly
  (via a throwaway `node -e` script) rather than by hand-calculating shanten, after an initial
  by-hand calculation also turned out wrong.
- `cd frontend && npm run build` — exit 0.
- Manual smoke test: added `.claude/launch.json` (frontend dev server, `npm --prefix
  .../frontend run dev`) since none existed, started it, and drove the actual UI in the browser —
  dealt a hand, discarded a tile through the confirm dialog, and let bot turns advance. No console
  errors, wall count and turn order updated correctly. This exercises `discardTile` and the
  claim-window path through the real UI, not just the unit tests.

### Known limits

1. **Nothing reads `state.decisions` yet.** This step is groundwork only — no puzzle generation, no
   post-game review pass or UI, as scoped from the start.
2. **The two-good-calls simplification from the plan stands**: if two different claim options both
   have verdict `'yes'`, only the first is `recommended`. Not exercised by a test since
   `claimAdvice`/`getClaimsFor` don't currently produce that situation in a way this session found
   worth constructing a test hand for; worth a test if a future review pass depends on it.
3. **Not tested against a played-out full hand.** Every test constructs a single decision in
   isolation (a hand assigned directly to `state.players[0].hand`); nothing exercises `decisions`
   accumulating correctly across many discards/claims in one real hand from `newGame()` to
   `finishHand()`.

# PR #5 review fixes, and an assessment of the "Singapore rules" shanten request

Two things came in together: two concrete review comments on PR #5's `optimal` logic (known limit
#2 above, plus a second bug the reviewer caught), and a request to "adapt the shanten calculator
for Singapore rules" against an attached SPGG competition rulebook (`mjrandrjan2024.pdf`). The two
review fixes are small and unambiguous. The rulebook request needs a scope decision first — see
below — so it isn't in the todo list yet.

## Part A — the two review fixes (both confirmed reproducible, fixing now)

**A1. Claim `optimal` only credits the first `'yes'` option.** Reproduced: a hand with three legal
chow configurations on one discard, where the two *outer* ones both improve the hand
(`verdict: 'yes'`) and the middle one doesn't —
```
hand:  b1 b2 b3 c1 c2 c3 d3 d4 d6 d7 we we wn   (seat 0)
discard: d5, from seat 3 (the left-hand neighbour, so chow applies)
claims:  chow d3-d4-d5 (yes) / chow d4-d5-d6 (no) / chow d5-d6-d7 (yes)
```
Today, choosing the `d5-d6-d7` chow is recorded as `optimal: false`, purely because `d3-d4-d5`
happened to come first in `state.claimOptions` — a false-positive "mistake" exactly as described.
Fix, per the reviewer's first suggested option (simpler than ranking the two `'yes'` options
against each other, and `claimAdvice` has no ranking between two helpful calls to draw on anyway):
treat **any** `'yes'`-verdict option as an acceptable outcome. `recommended` stays the first
`'yes'` option (still useful as *a* concrete answer for display), but `optimal` no longer requires
matching it exactly.

**A2. Discard `optimal` uses `bestDiscard()`'s truncated `alternatives` list.** Confirmed:
`bestDiscard()` caps `alternatives` at two tiles (`.slice(0, 2)`) because that list was written for
the coach's UI text ("X is just as good"), never meant as a completeness signal. A hand with four
tiles tied for the best resulting shanten would record the fourth as a mistake even though it
provably isn't one. Fix, exactly as suggested: compare the underlying numbers instead of list
membership — `shantenAfterChosen === rec.shantenAfter` (both already computed in
`recordDiscardDecision`) — which is correct regardless of how many tiles tie.

### Todo

- [x] 1. `frontend/src/game/engine.js` — `recordDiscardDecision`: change `optimal` to
     `shantenAfterChosen === rec.shantenAfter`; drop the now-unused reliance on `rec.alternatives`
     for correctness (the field itself still comes back from `bestDiscard` unchanged and is fine
     to keep recording, just not to gate `optimal` on)
- [x] 2. `frontend/src/game/engine.js` — `recordClaimDecision`: compute the full list of
     `'yes'`-verdict claims; keep `recommended` as the first one, but set
     `optimal: chosen === null ? yesClaims.length === 0 : yesClaims.includes(chosen)`
- [x] 3. `frontend/test/engine.test.js` — new regression test: the three-chow-option hand above,
     asserting taking the *second* `'yes'` option (`d5-d6-d7`) is `optimal: true`, not just the
     first
- [x] 4. `frontend/test/engine.test.js` — new regression test: a discard with (at least) three
     tiles tied for the best resulting shanten, asserting the tile *not* in `alternatives` (because
     of the `.slice(0, 2)` cap) is still recorded `optimal: true`
- [x] 5. Re-run `cd frontend && npm test` and `npm run build`

## Part B — the "Singapore rules" shanten request: assessment before scoping any work

I read `mjrandrjan2024.pdf` (SPGG's competition rulebook) and compared it against
`frontend/src/game/advisor.js`'s `shanten()` and `melds.js`'s `isWinningHand()`/`decompose()`
before touching anything, since the premise ("the shanten calculator isn't adapted for Singapore
rules") is only half right and I don't want to build the wrong fix.

**What the rulebook actually confirms:** every scored hand type it lists except one — toitoi/all-
triplets ("Kam Kam Hu"), all-honours, 1-and-9-only, four kongs, half/full flush — is still
structurally *four sets plus a pair*. `shanten()`'s formula (2 points per complete set, 1 per
partial, budget of 8) already covers all of them; a triplet is as valid a "set" as a run to that
function. **Seven pairs is not in this rulebook at all** — SPGG's "Kam Kam Hu" is all-triplets, a
different hand, still 4-sets-shaped. So the specific claim "the shanten calculator isn't adapted
for Singapore rules" doesn't hold for the standard hand shape; that part of `shanten()` needs no
change.

**What genuinely is missing:** **Thirteen Wonders** (rules 18 and 24j — a hand of all 13 distinct
terminal/honour tiles plus one duplicate). That shape isn't 4-sets-plus-a-pair at all, and
`shanten()`/`isWinningHand()` have no representation of it whatsoever — a player one tile from
Thirteen Wonders gets exactly the same (bad) shanten number as someone with a scattered, useless
hand. This is real and worth fixing.

**Why I'm not just patching `shanten()` and calling it done:** `docs/mvp-notes.md`'s known
simplification #2 currently says plainly "no special hands... not implemented," covering
`isWinningHand()` (can't detect the win), `scoreHand()` (can't score it), and `shanten()`
(can't measure distance to it) together, as one deliberate boundary. Adding Thirteen-Wonders
*shanten* alone, without also teaching `isWinningHand()` to recognise a completed one, means the
coach could tell a player "you're one tile away" and then the engine refuses to let them declare
the win when they draw it — a worse, actively misleading experience than the current honest "not
implemented." Properly closing this gap means three coupled pieces, not one:

1. `melds.js` — an `isThirteenWonders(concealed, melds)` check (melds must be empty; concealed win
   only, per how this hand is always played) alongside `isWinningHand`
2. `advisor.js` — a Thirteen-Wonders distance function, and `shanten()` (or its caller) taking the
   minimum of the standard distance and this one
3. `scoring.js` — at minimum, a fixed limit-hand score for it (rule 24 prices every special hand at
   a flat maximum), so a completed one settles correctly instead of falling through to whatever
   `scoreHand()` currently does with a hand shape it's never seen

None of this is large individually, but it's a real feature addition against a documented,
deliberate MVP boundary — not a bug fix — so I'd rather confirm scope before writing code than
guess. Seven pairs stays out regardless, since it isn't part of this ruleset.

### Decision: hold off

User's call: leave `shanten()`/`isWinningHand()` exactly as they are for now. `docs/mvp-notes.md`
known simplification #2 already documents this honestly; no code changes for Part B in this round.
Revisit if Thirteen Wonders comes up again. Only Part A (the two review-comment fixes) proceeds.

## Review

### What was fixed

Reproduced both review comments against real code before changing anything (via a throwaway
`node -e` script exercising `advisor.js`/`melds.js` directly), to confirm the exact conditions that
trigger each false-positive rather than trusting the description alone.

**A1 (claim `optimal`).** `recordClaimDecision` now filters `options` down to every `'yes'`-verdict
claim (`yesClaims`) instead of just taking the first one. `recommended` is unchanged (still the
first `'yes'` option, kept as a single concrete display answer since `claimAdvice()` has no way to
rank two genuinely good calls against each other). `optimal` is now `yesClaims.includes(chosen)`
when the human took a call, or `yesClaims.length === 0` when they passed — so taking *any*
beneficial option reads as optimal, not just whichever happened to be first in
`state.claimOptions`.

**A2 (discard `optimal`).** `recordDiscardDecision` now compares `shantenAfterChosen ===
rec.shantenAfter` directly — both numbers it was already computing — instead of checking whether
`chosen` appears in `bestDiscard()`'s `alternatives` array. `alternatives` itself is untouched
(still capped at two entries, still fine for the coach's explanatory text); it's just no longer
used as a correctness signal for the decision log.

### Test plan

- `cd frontend && npm test` — 70/70 pass (68 previous + 2 new regression tests).
  - New: `'taking the second of two beneficial claims is not a false-positive mistake'` — a hand
    with three legal chows on one discard (`d3-d4-d5` yes / `d4-d5-d6` no / `d5-d6-d7` yes),
    asserting the *second* `'yes'` option is `optimal: true`. This fails against the old code
    (confirmed by reading the pre-fix logic against this exact hand before writing the fix).
  - New: `'a discard tied for best is not a mistake even when bestDiscard() truncates it out of
    alternatives'` — a hand with five lone-honour tiles all tied for the same resulting shanten,
    discarding one of the two `bestDiscard()` truncates out of its two-entry `alternatives` list.
    Also fails against the old code.
  - All prior tests, including the two this PR previously flagged in `Known limits` as
    unregression-tested, pass unchanged.
- `cd frontend && npm run build` — exit 0.
- No browser smoke test this round: nothing UI-observable changed (`state.decisions` is still
  unconsumed by any component; only its internal `optimal` computation changed), and the
  surrounding game loop was already verified live in the previous round on this same
  `discardTile`/`resolveClaims` code path.

### On the "Singapore rules" shanten request

Assessed against the attached `mjrandrjan2024.pdf` (SPGG competition rulebook) and the actual
`shanten()`/`isWinningHand()` code — see "Part B" above for the full reasoning. Summary: the
standard-hand shanten math is not actually Singapore-specific and needs no change; the one real gap
is Thirteen Wonders, explicitly named in the rulebook (rules 18, 24j) but entirely unrepresented in
the current code. Seven pairs is not part of this ruleset and was correctly not requested for
inclusion. Per the user's decision, no code changes were made for this — `docs/mvp-notes.md` known
simplification #2 continues to document it as a deliberate, honest boundary rather than a defect.

# Puzzle engine (step 2 toward the teaching agent)

Step 2 of the three-part teaching agent the user asked for (the structured decision log was step 1,
since `state.decisions` isn't consumed by anything yet — see "Planned: structured decision log"
earlier in this file). A puzzle presents a single frozen position and checks whether the player finds the
same answer `advisor.js` would give — reusing exactly the same functions the live coach and the
decision log already use, so a puzzle's "correct answer" can never disagree with what the coach
would say about the same hand mid-game.

**Scope decision: discard puzzles only, not claim puzzles, for this increment.** Same reasoning as
scoping the decision log to discard+claim together only because both were needed for that PR —
here, a discard puzzle is the simpler, self-contained case (one hand, no other seats, no discard
history), and a full puzzle UI/flow doesn't exist yet for either kind. Claim puzzles are a natural
next step once this exists to build on, not a blocker to it.

**Scope decision: a new pure module, not an extension of `engine.js`.** A puzzle is a single frozen
hand with no other player, no wall, no turn order — none of `engine.js`'s state shape applies. It
belongs alongside `advisor.js`/`bots.js` as another pure, testable `src/game/` module with no React
import, per this codebase's existing layering (`docs/mvp-notes.md`'s "Game engine... no React
imports anywhere").

**Scope decision: generation draws from a real 136-tile set, filtered for two degenerate cases.**
A puzzle needs a *checkable* answer, so: reject a hand that's already complete (shanten `-1` —
nothing to discard toward) and reject a hand where every distinct tile leaves the same resulting
shanten (no signal — any answer would be "correct", which teaches nothing). Both are checked with
`shanten()` from `advisor.js`, unmodified. No further "how interesting is this" scoring — that's
tuning that's easy to add later against real usage and not worth guessing at now.

**Scope decision: separate the deterministic core from the random draw.** `shuffle()` in
`tiles.js` calls `Math.random()` directly with no seed hook, so a puzzle generated from a truly
random hand can't be asserted against in a test. Splitting `tryDiscardPuzzle(hand)` (pure,
deterministic, exported for tests to hand a fixed hand to) from `generateDiscardPuzzle()` (draws a
real random hand, retries a bounded number of times if `tryDiscardPuzzle` rejects it) means the
interesting logic is fully unit-testable without needing to fake randomness, and the outer
function stays a thin wrapper.

## Todo

- [x] 1. `frontend/src/game/puzzles.js` — new module:
     - `tryDiscardPuzzle(hand)` — pure. Returns `null` for the two degenerate cases above, else
       `{ hand, shantenBefore, bestTile, shantenAfterBest, reasons }` (`bestTile`/`shantenAfterBest`/
       `reasons` straight from `bestDiscard()`, `shantenBefore` from `shanten()`)
     - `generateDiscardPuzzle()` — draws a random 14-tile hand from a full standard 136-tile set
       (no bonus tiles — a puzzle is a frozen hand, not a live deal with a wall to set them aside
       into), retries up to 20 times against `tryDiscardPuzzle`, returns `null` on the
       (astronomically unlikely) case all 20 are degenerate
     - `checkDiscardAnswer(puzzle, chosenTile)` — `{ correct, shantenAfterChosen }`, `correct`
       computed the same way `engine.js`'s `recordDiscardDecision` now does:
       `shantenAfterChosen === puzzle.shantenAfterBest`
- [x] 2. `frontend/test/puzzles.test.js` — new test file (unit tests below)
- [x] 3. `frontend/src/components/Puzzle.jsx` — minimal UI (added after the user asked for one,
     see "Scope change" below): a modal, styled like `Settings.jsx`'s `.backdrop`/`.dialog`, showing
     a generated puzzle's hand as tappable `Tile`s; tapping one shows "Correct!"/"Not quite" plus
     the best tile and its first reason when wrong; "New puzzle" draws another, "Back to the game"
     closes without affecting the live game underneath
- [x] 4. `frontend/src/App.jsx` — a "Puzzle" header button opening `Puzzle.jsx`; the bot/turn timer
     effect and `Coach`/`ScoreSheet` visibility gated on `showPuzzle` exactly the way they already
     were on `showSettings`, so a puzzle can't run concurrently with a live turn
- [x] 5. `docs/mvp-notes.md` — one line under the existing `state.decisions` note (known
     simplification #9) marking the puzzle engine as built, now including a minimal UI

## Planned unit tests (`frontend/test/puzzles.test.js`)

- `tryDiscardPuzzle` returns `null` for an already-complete (winning) hand.
- `tryDiscardPuzzle` returns `null` for a hand where every discard leaves the same shanten (a hand
  of, e.g., all distinct isolated honours with no structure to protect).
- `tryDiscardPuzzle` returns a well-formed puzzle for an ordinary hand with a genuine best
  discard, matching `bestDiscard()`'s own answer for that hand directly.
- `checkDiscardAnswer` returns `correct: true` for the puzzle's own `bestTile`.
- `checkDiscardAnswer` returns `correct: true` for a tile tied with `bestTile` (reusing the same
  five-lone-honours tied hand from the decision-log tests, confirming this doesn't repeat the
  `alternatives`-truncation bug just fixed there).
- `checkDiscardAnswer` returns `correct: false` for a tile that leaves a worse shanten.
- `generateDiscardPuzzle()` (real randomness, no injected hand): called a few dozen times, always
  returns either `null` or a puzzle whose `hand` has exactly 14 tiles, none of them bonus tiles,
  and whose `bestTile` is actually in `hand`.

## Scope change: minimal UI added

Asked before starting whether to keep this engine-only (like the decision log) or add a minimal UI
this round. User's call: add the UI, with unit tests for the engine it's built on. `puzzles.js`
itself has no React dependency either way — the UI is a thin `Puzzle.jsx` consumer of it, so this
didn't change any of the scope decisions above.

## Review

### What was built

`frontend/src/game/puzzles.js`, exactly as scoped: `tryDiscardPuzzle(hand)` (pure), wrapped by
`generateDiscardPuzzle()` (real randomness with bounded retries), and `checkDiscardAnswer()`
(correctness by direct shanten comparison, not list membership — the same fix just made to
`engine.js`'s decision log, applied here too since it's the same underlying question). 7 new unit
tests in `frontend/test/puzzles.test.js`, all against hands reused or adapted from existing
`advisor.test`/`engine.test` cases where possible rather than inventing new ones.

`frontend/src/components/Puzzle.jsx` is a new modal, wired into `App.jsx` behind a "Puzzle" header
button. It follows `Settings.jsx`'s existing modal conventions exactly (`.backdrop`/`.dialog`,
`role="dialog"`) rather than introducing a new pattern, and reuses the existing `Tile` component
for the hand display — no new CSS classes were needed. The bot-turn timer effect and the
`Coach`/`ScoreSheet` visibility conditions in `App.jsx` now also check `showPuzzle`, matching how
they already handled `showSettings`, so opening a puzzle mid-turn can't race with a bot move.

### Test plan

- `cd frontend && npm test` — 77/77 pass (70 previous + 7 new puzzle tests).
- `cd frontend && npm run build` — exit 0.
- Manual browser smoke test of the actual UI (not just the engine): opened the puzzle panel,
  answered correctly (dimmed tiles, "Correct!"), generated a new puzzle, answered incorrectly
  ("Not quite" plus the best tile and its reason), used "New puzzle" to confirm the answer state
  resets, and "Back to the game" to confirm it closes without disturbing the live hand underneath.
  No console errors. (Two earlier click attempts missed their target after a stray browser-side
  zoom the tool itself introduced mid-session — resolved by reloading the page; not an app bug,
  and not worth a line in Known limits below since it was a test-tooling artifact, not a code path.)
- No new automated UI test framework was introduced. This repo's whole test suite is `node:test`
  over pure `src/game/*.js` logic — no `.jsx` component has a dedicated test file today (`Coach.jsx`,
  `Settings.jsx`, etc. are all verified by hand in a browser only). Adding React component-testing
  infrastructure for one small modal would be a disproportionately large, precedent-setting
  addition for this task; the manual smoke test above follows the existing convention instead.

### Known limits

1. **Discard puzzles only.** Claim puzzles (multiple legal calls on a discard, checked against
   `claimAdvice()`) are a natural next increment, not attempted here.
2. **No difficulty tuning.** The only filters are "not already complete" and "not every tile ties" —
   a generated puzzle could still be trivially easy (an obviously dead honour tile) as often as a
   genuinely hard read. Tuning "interesting" is real design work better done against actual usage
   than guessed at now.
3. **No connection to the decision log or puzzle history.** Puzzles are stateless and ephemeral —
   nothing records which ones a player got right or wrong, so there's no "puzzles from your own
   mistakes" yet, even though that was the original motivation named for step 1's `state.decisions`.
   That link is still future work, not built in this round.
4. **`docs/mvp-notes.md`'s "Testing" section test count is already stale** (says "59 cases," but the
   frontend suite is at 77 after this and the two prior PRs) — pre-existing drift from before this
   round, not something introduced here. Left alone rather than recounting the whole paragraph as a
   side effect of an unrelated task; worth a dedicated pass if it keeps drifting.

# Difficulty-ranked, progressive discard puzzles (closes Known limit #2 above)

Full design plan (with the empirical validation behind the difficulty metric) is at
`C:\Users\kenna\.claude\plans\open-rank-the-puzzles-drifting-lerdorf.md`. Summary here for the
project record.

The user asked to rank generated puzzles by "closeness of the tile's ranking in the shanten
calculator," group them, and let a player progress from easy to hard. Before writing any code, I
validated the obvious metric — the shanten gap between the best discard and the closest wrong one —
against the real calculator across 20,000 randomly generated hands, and found it has **zero
variance**: that gap is exactly 1 every single time, a structural property of shanten under
single-tile removal. Switched (confirmed with the user) to **how many distinct tiles are exactly
tied for the single best resulting shanten** — fewer ties means the right answer is sharply
distinguished (hard), more ties means several discards are equally correct (easy) — which does
produce a real, data-backed spread.

## Todo

- [x] 1. `frontend/src/game/puzzles.js` — `tryDiscardPuzzle` computes `tieCount` (replacing the old
     separate `allTie` check with the same loop) and derives `difficulty` (`'hard'` ≤4, `'medium'`
     ≤7, else `'easy'` — thresholds from real percentile cuts, not guessed)
- [x] 2. `frontend/src/game/puzzles.js` — `generateDiscardPuzzle(difficulty)` retries (60x for a
     specific tier vs. 20x unfiltered) until it finds one of the requested difficulty, falling back
     to any valid puzzle rather than `null` if the tier truly never comes up
- [x] 3. `frontend/test/puzzles.test.js` — new difficulty tests, using concrete hands with a
     verified `tieCount` (a ready hand with one dead tile → hard; a scattered, far-from-ready hand
     → easy) rather than a hardcoded difficulty label alone
- [x] 4. `frontend/src/App.jsx` — `puzzleProgress` (`{ tier, correctInTier }`) lifted into App
     state (not `Puzzle.jsx`'s own, since that component unmounts every time the panel closes) and
     passed down
- [x] 5. `frontend/src/components/Puzzle.jsx` — generates with the current tier, shows
     "Easy · 1 / 3 solved"-style progress, advances `easy → medium → hard` (capped at `hard`) after
     3 correct answers at a tier; a wrong answer doesn't move the counter

## Review

### What was built

Exactly per the approved plan. The difficulty metric lives entirely inside `puzzles.js`; `App.jsx`
and `Puzzle.jsx` only needed to thread a `difficulty` string through to `generateDiscardPuzzle()`
and track/display progress — no changes to `advisor.js` (the coach's `bestDiscard()` is untouched,
so the live coach and decision log are unaffected).

### Test plan

- `cd frontend && npm test` — 80/80 pass (77 previous + 3 new: two difficulty-assignment tests, one
  difficulty-filtered-generation test; the two existing degenerate-rejection tests re-verified
  since their logic was consolidated with the new `tieCount` computation, not just added alongside).
- `cd frontend && npm run build` — exit 0.
- Manual browser smoke test of the full progression, matching the plan's verification section
  exactly: opened the panel (confirmed "Easy · 0 / 3 solved"), answered 3 puzzles correctly across
  fresh "New puzzle" draws (confirmed the counter incrementing 0→1→2, then the tier flipping to
  "Medium · 0 / 3 solved" on the 3rd), answered one incorrectly at Medium (confirmed "Not quite" —
  the best tile named — and the counter *not* moving), closed and reopened the panel (confirmed the
  tier/count survived, still "Medium · 1 / 3 solved"), and reloaded the page (confirmed it reset to
  "Easy · 0 / 3 solved"). No console errors at any point.

### Known limits

1. **Tier thresholds are a first cut from simulation data, not from real play.** `tieCount <= 4` /
   `<= 7` splits ~20,000 sampled hands into roughly 17% / 48% / 35% hard/medium/easy — reasonable
   and non-degenerate, but not tuned against how a puzzle actually *feels* to solve.
2. **No completion state once `hard` is reached.** Further correct answers at `hard` just keep
   resetting the counter toward another `hard` puzzle — there's no "you've mastered this" moment,
   by design for this round (kept simple; flagged in the plan, not discovered after the fact).
3. **Progress is a single global track, not per-puzzle-type.** Only discard puzzles exist today, so
   this doesn't matter yet, but a future claim-puzzle mode would need its own decision about whether
   it shares this progress track or gets its own.

# PR #6 review fixes (round 2)

Three comments on the difficulty/progression work:

1. `checkDiscardAnswer()` used `indexOf()` without checking for `-1` — a tile not in the puzzle's
   hand would `splice(-1, 1)` and silently grade the *last* tile in the hand instead of rejecting
   the input. Not reachable through today's UI (it only ever passes a tile from `puzzle.hand`), but
   it's an exported game-layer function, so the invariant needed to be explicit.
2. `generateDiscardPuzzle(difficulty)`'s fallback (return any valid puzzle if the requested tier
   never turns up) meant a returned puzzle's `difficulty` wasn't actually guaranteed to match what
   was asked for — and `Puzzle.jsx` labels the puzzle using the *requested* tier, not the puzzle's
   own, so a fallback could show "Hard" while serving an Easy puzzle. Now user-facing progression
   state, so a silent mismatch is worse than it looked when this was still an internal-only detail.
3. Learner-facing wording ("best discard") overstated what's actually checked — equal shanten
   doesn't guarantee equal hand quality (ties can differ in how many tiles would complete the hand
   from there, i.e. ukeire, which nothing here accounts for).

## Todo

- [x] 1. `frontend/src/game/puzzles.js` — `checkDiscardAnswer` returns
     `{ correct: false, shantenAfterChosen: null }` for a tile not in `puzzle.hand`, instead of
     evaluating whatever `splice(-1, 1)` happens to remove
- [x] 2. `frontend/src/game/puzzles.js` — `generateDiscardPuzzle(difficulty)` drops the fallback
     entirely: returns `null` if the requested tier isn't found within the retry budget, so a
     non-null result's `difficulty` always matches what was asked for
- [x] 3. `frontend/src/components/Puzzle.jsx` — reworded the doc comment and the wrong-answer
     message from "best discard" to "keeps you closest to winning" (matching `adviceDiscard`'s own
     existing phrasing in `coach.js`, not new jargon), plus a code comment on `checkDiscardAnswer`
     noting the shanten-optimal-not-holistic-optimal caveat directly
- [x] 4. `frontend/test/puzzles.test.js` — regression test for an out-of-hand tile

## Review

### What was fixed

**#1 and #2** were both small, mechanical fixes with an obvious correct answer, so implemented as
described without further design discussion. For #2, removing the fallback was the reviewer's own
preferred option (over having the UI treat a fallback as an explicitly different tier) since it's
*less* code than what was there — the existing `!puzzle` UI branch ("Could not put together a
puzzle just now") already handles a `null` result, so no new UI path was needed either.

**#3**: reworded `Puzzle.jsx`'s doc comment and its wrong-answer text to "keeps you closest to
winning" rather than "best discard" — deliberately reusing language `advisor.js`'s own
`bestDiscard()` comment already uses ("the tile whose loss keeps you closest to winning"), rather
than inventing new phrasing or introducing raw "shanten" jargon into learner-facing text (this
app's existing coach UI never surfaces the word "shanten" to a player either — `describeDistance()`
in `advisor.js` always renders it as "N tiles from winning"). Did **not** rename `advisor.js`'s
exported `bestDiscard()` function or touch any of the live coach's own wording (`Coach.jsx`,
`coach.js`) — the reviewer's comment was specifically about the new learner-facing puzzle text, and
renaming the coach's established terminology across the rest of the app would be a much larger,
unrelated change nobody asked for.

### Test plan

- `cd frontend && npm test` — 81/81 pass (80 previous + 1 new: the out-of-hand-tile regression).
- `cd frontend && npm run build` — exit 0.
- Manual browser check of the reworded wrong-answer text specifically (not just a re-run of the
  earlier progression smoke test): triggered a wrong answer and confirmed the dialog reads
  "East Wind keeps you closest to winning. It is a lone wind or dragon..." — the reasons text
  itself was untouched, only the discard-naming sentence in front of it changed. No console errors.

### Known limits

1. **`generateDiscardPuzzle(difficulty)` returning `null` is still not covered by a dedicated
   test** — doing so deterministically would need injecting the hand generator for testability,
   which felt like more machinery than a <0.001%-probability edge case warrants right now. The
   existing property-based test (calls it 20× per tier) covers the happy path; the code change
   itself (removing the silent fallback) is what actually closes the reviewer's concern, independent
   of what the test can prove.
2. **Ukeire (improving-tile count) is still not used to break same-shanten ties**, as the reviewer
   noted — `checkDiscardAnswer()`'s "correct" remains shanten-optimal, not holistic-play-optimal.
   Now documented in code and in the UI's own wording rather than implied by stronger language than
   the check actually performs; using ukeire as a tiebreak is real follow-up work, not attempted
   here.

# Home page, curated puzzle library, and tile images in coach advice

Full design plan is at `C:\Users\kenna\.claude\plans\open-rank-the-puzzles-drifting-lerdorf.md`.
Summary here for the project record. Five asks in one message, scoped and confirmed with the user
before writing any code (see the plan file for the exact questions asked): a home page so the site
doesn't drop straight into a live hand; the puzzle feature reworked from PR #6's random generator
into a curated library (3 puzzles per tier, chess.com-style, shown as a full table with opponents
and a discard pile); tile images alongside the coach's discard/claim advice; and — raised mid-plan
by the user — render-verifying component tests, which this repo had never had before.

## Todo

- [x] 1. Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as frontend
     devDependencies; `frontend/vitest.config.js` (`environment: 'jsdom'`,
     `include: ['test/**/*.test.jsx']` — never overlaps `npm test`'s `test/*.test.js` glob); new
     `test:components` script. `npm test` (node:test, game logic) untouched.
- [x] 2. `frontend/src/game/puzzleLibrary.js` — 9 curated puzzles (3 per tier), each hand pulled
     from `tryDiscardPuzzle()`'s own output rather than invented; `bestTile`/`shantenAfterBest`/
     `reasons`/`difficulty` derived at import time, not typed by hand, and the module throws if an
     entry is degenerate or filed under the wrong tier
- [x] 3. Removed from `frontend/src/game/puzzles.js`: `generateDiscardPuzzle()`, `randomHand()`,
     `RETRIES`/`RETRIES_FOR_DIFFICULTY` — dead now that the library replaces random generation.
     `tryDiscardPuzzle`/`checkDiscardAnswer`/`difficultyOf` stay; the library is built on them.
- [x] 4. `frontend/src/components/Puzzle.jsx` reworked: a tier-tabs + numbered-puzzle picker, then
     a solving view showing the puzzle as a full table (reusing `Table`/`Seat` with a small
     synthesized state — opponents are placeholder face-down racks, `Table`/`Seat` never read an
     opponent's actual tiles) plus the existing tap-to-answer row
- [x] 5. `frontend/src/components/Home.jsx` (new) and `frontend/src/components/Rules.jsx` (new,
     embeds `frontend/public/rules.pdf` — copied from the SPGG rulebook already used earlier this
     session — in a plain `<iframe>`, no viewer library needed)
- [x] 6. `frontend/src/App.jsx` — top-level `screen` state (`'home' | 'play' | 'puzzle' | 'rules'`);
     Home renders without the app's topbar (it supplies its own title); Play/Puzzle/Rules share one
     topbar with a Home button; the bot-turn effect now also checks `screen === 'play'` so a bot
     can't keep moving while the player is off in Puzzle or Rules
- [x] 7. `frontend/src/game/coach.js` — `adviceDiscard()`/`adviceClaim()` each gain a `tile` field
     (additive; `ask()`/`askWithModel()` already spread the whole answer object through, so no
     other change was needed for it to reach the UI); `frontend/src/components/Coach.jsx` renders a
     `<Tile>` next to the title when `answer.tile` is present
- [x] 8. New CSS: `.home-screen`, `.puzzle-screen`, `.rules-screen`, `.tier-tabs`/`.puzzle-grid`,
     a base (non-`.dialog`-scoped) `.row`, `.coach-a-tile` — small, targeted additions in
     `frontend/src/styles.css`, no new visual language
- [x] 9. Component tests: `App.test.jsx`, `Home.test.jsx`, `Rules.test.jsx`, `Puzzle.test.jsx`,
     `Coach.test.jsx` (render/interaction tests against real components, not snapshots); replaced
     `puzzles.test.js`'s two removed-function tests with `puzzleLibrary.test.js` covering the new
     module
- [x] 10. `frontend/test/setup.js` + `setupFiles` in `vitest.config.js` — see "what went wrong"
     below; needed for basic test isolation, not in the original plan

## Review

### What was built

Exactly per the plan, with one implementation-time simplification: the plan assumed
`Rules.jsx`/`Puzzle.jsx` would each carry their own "Home" button, but once `App.jsx` had a shared
topbar for every non-Home screen, duplicating a Home button into each component would have been
pure repetition — the topbar's single Home button covers all of them. `Puzzle`/`Rules` take no
navigation props at all as a result; simpler than planned, not a deviation in substance.

Each of the 9 curated puzzles' `hand` was pulled directly from real `tryDiscardPuzzle()` output
(generated via a throwaway script while `generateDiscardPuzzle()` still existed, the same technique
used to validate PR #6's difficulty metric), then hand-picked and frozen — not invented tile lists.
`discards`/`wallCount` per puzzle are presentation only, authored for a plausible mid-hand look.

### What went wrong (and the fix)

The first component-test run failed 7 of 13 tests, all with the same shape: "found multiple
elements" or "unable to find" errors that only made sense if DOM from a *previous* test in the same
file was still mounted. Root cause: Testing Library's automatic per-test cleanup depends on
detecting a global test framework, and this config runs with `globals: false` (matching this repo's
existing explicit-import style everywhere else) — so cleanup was never registered, and every test
after the first in a file ran against an accumulating DOM. Fixed with `frontend/test/setup.js`
(explicit `afterEach(() => cleanup())`) wired in via `vitest.config.js`'s `setupFiles`, not by
switching to `globals: true` — keeps the explicit-import convention intact everywhere else. Caught
immediately by the tests themselves failing, not discovered later.

### Test plan

- `cd frontend && npm test` — 83/83 pass (the 81 from the last round + `puzzleLibrary.test.js`'s
  4 new tests − 2 removed `generateDiscardPuzzle` tests from `puzzles.test.js`).
- `cd frontend && npm run test:components` — 13/13 pass across the 5 new component test files.
- `cd frontend && npm run build` — clean; confirms the PDF asset path and every new component
  bundle correctly.
- Manual browser walkthrough of the full plan's verification list: fresh load lands on Home, not a
  live hand; Play works exactly as before (topbar, table, coach, settings); Puzzle's picker shows
  3 numbered puzzles per tier and opening one renders the full table (opponent seats, the curated
  discard pile) with a working tap-to-answer row, both a correct and an incorrect answer graded
  correctly; "Choose another puzzle" and Home both navigate correctly; Rules shows the embedded PDF
  rendered natively and scrollable; the coach's "what should I discard?" answer now shows the
  recommended tile's image inline. No console errors beyond a Vite HMR websocket warning that's a
  proxy artifact of the preview tooling, not an application issue. Confirmed by reading
  `Coach.jsx`'s `speak()` call that voice narration only ever reads `title`/`lines` — the new `tile`
  field was never wired into it, so narration needed no change and got none.

### Known limits

1. **No solved/unsolved tracking across the 9 puzzles.** Reworking `Puzzle.jsx` away from PR #6's
   `progress`/`setProgress` (auto-advancing random tiers) means there's currently no memory of
   which curated puzzles a player has already solved — picking "Puzzle 1" again after solving it
   just re-serves the same puzzle. Not requested this round; noted rather than half-built.
2. **Puzzle library is fixed at 3 per tier with no path to add more without a code change** — there
   is no authoring tool, just the `RAW` object in `puzzleLibrary.js`. Fine for "3 puzzles each for
   now" as asked; a larger library would want a less manual process for picking/verifying hands.
3. **This is the repo's first component-testing setup**, added specifically because this round
   asked for it — every earlier UI change in this project was verified by hand in a browser only.
   `npm test` (game logic) and `npm run test:components` (UI) are two separate commands/runners by
   design (see Todo #1); worth folding into one CI step if this project ever adds CI.

# PR #7 review: coach robustness (error handling, stale state, response validation)

A review comment flagged three things in `Coach.jsx`/`askWithModel()` — code this PR touched
(added the `tile` field / its rendering) but didn't originally write. Investigated each against the
actual code before deciding what to do, rather than patching all three the same way by default.

1. **No error handling** — if `askWithModel()` failed, the loading state (`pending`) would clear
   (the `finally` already handled that) but no answer would ever appear — a silent no-op, not a
   crash. `askWithModel()`/`ask()` are documented and, by inspection, actually never throw today,
   but that's an internal contract a future change could break without anyone noticing at the call
   site. Fixed with a `catch` that shows a plain "try again" answer instead of nothing.
2. **Potentially stale game state** — real, and worth tracing precisely: `askWithModel()` only
   reaches the network when the local patterns find no match, and while that classify request is in
   flight (up to `CLASSIFY_TIMEOUT_MS`, 4s), the game keeps advancing on its own bot timer. The
   final answer was computed from the `state` closed over at the moment the question was asked, not
   the state when the model actually responded — so e.g. `adviceDiscard`'s own "not your turn yet"
   guard couldn't catch a turn that changed *during* the wait, only one that had already changed
   *before* asking. Decided (per the reviewer's own framing of the choice) that the answer should
   reflect the position when the model responds, not when asked — a coach answering off a
   several-seconds-stale hand is worse than a slightly slower one. Fixed.
3. **No validation of the AI response** — traced the actual data flow before agreeing this was a
   bug: the model's raw text never becomes UI content directly. It only selects an intent id (via
   `INTENTS.find`, checked against a known list), and that intent's hardcoded local answer function
   is what actually gets rendered — the same functions `ask()` already uses everywhere. Every one of
   those returns a proper `{ title, lines }` shape by construction, so "a malformed response
   crashing the UI" isn't reachable via the model today. Still added a cheap shape check at the
   point `Coach.jsx` consumes the answer (the actual trust boundary here — an async result this
   component didn't fully control the shape of), covering both this and #1 with one mechanism.

## Todo

- [x] 1. `frontend/src/game/coach.js` — `askWithModel(question, getState, opts)` takes a getter,
     not a value; calls it once before the classify round trip and again after, so the final
     `intent.answer(...)` uses the position at resolution time
- [x] 2. `frontend/src/components/Coach.jsx` — `stateRef` kept current via a `useEffect`, passed to
     `askWithModel` as `() => stateRef.current`; `askNow` wrapped in try/catch; a small
     `isWellFormedAnswer()` check plus a shared `ASK_FAILED_ANSWER` fallback cover both the catch
     path and a malformed-answer path with one mechanism
- [x] 3. Updated every other `askWithModel(...)` call site to the new getter-based signature:
     `frontend/test/coach.test.js` (2 existing tests) and
     `backend/test/integration.coach-classifier.test.mjs` (2 tests) — each now calls it once to get
     a concrete state object, then passes a getter closing over *that* object, not a fresh
     `newGame()` per call (which would have silently changed the semantics being tested)
- [x] 4. `frontend/test/coach.test.js` — new regression test: a fake `fetch` that mutates which
     state `getState()` would return partway through the "network" call, asserting the final answer
     reflects the *post*-response state (here, a turn that changed mid-flight correctly produces
     "not your turn yet") rather than the pre-response one

## Review

### Test plan

- `cd frontend && npm test` — 84/84 pass (83 previous + 1 new stale-state regression).
- `cd frontend && npm run test:components` — 13/13 pass, unaffected (Coach.test.jsx's two tests
  don't touch the classify/network path at all, so the getter-signature change didn't need any
  changes there).
- `cd backend && npm test` — 17/17 pass, unaffected (this suite is the Lambda side, not the
  frontend's `askWithModel`).
- `cd backend && npm run test:integration` — 2/2 pass — the one suite that actually exercises
  `askWithModel()` against the real compiled Lambda, confirming the getter-signature change didn't
  break the cross-package contract.
- `cd frontend && npm run build` — clean.
- Manual browser check: asked "What should I discard?" through the live coach after the change —
  still resolves instantly (local match, no network), still shows the tile image added earlier this
  round, answer text unchanged. No console errors beyond the same pre-existing Vite HMR proxy
  artifact noted in the PR description.

### Known limits

1. **The stale-state fix only matters when a classifier backend is actually deployed.** With no
   `VITE_CLASSIFY_INTENT_URL` configured (true for every environment this session has touched), the
   network path is never taken at all, so this bug was previously untriggerable in practice —
   still correct to fix given the code path exists, is exported, and is tested.
2. **Point 3's shape check is defensive, not exercised by a failing-in-practice test** — by
   inspection, nothing in the current codebase can actually produce a malformed answer, so there is
   no realistic scenario to regression-test against. The check stays as insurance against a future
   change breaking that invariant silently.

# A native, value-aware `bestDiscard()`

`shanten()`/`bestDiscard()` in `advisor.js` only ever optimised for speed to a win — zero awareness
of what the resulting hand is actually worth. That's why every one of the 9 curated puzzles
recommended "discard the lone dragon/honour": with no value signal at all, an isolated honour is
almost always the uniquely-fastest tile to shed, so the whole library taught one lesson.

Researched open-source engines that already do "shanten → win probability × expected score" before
designing anything: `nekobean/mahjong-cpp`'s `ExpectedScoreCalculator` is the real prior art, but
it's GPL-3.0 and shaped as a native C++ service, not a fit for this shipped frontend either way — so
this is a native, original implementation, informed by its approach rather than its code (algorithms
aren't copyrightable, only their specific source is).

**Evaluated against a competing PR before designing further, not just in the abstract.** PR #8
proposed a similar-sounding rewrite (`advisor_1.js`). Downloaded it and actually ran it against this
repo's real dependencies rather than reviewing it by reading alone: it doesn't import as submitted
(missing a `scoring.js` export it depends on), its `visibleTileCounts()` assumes a discard-history
shape that doesn't match this engine's real one (verified: 3 real discarded copies of a tile counted
as 0 visible), it recommended **the exact same tile as the pre-existing code on all 9 of this repo's
real curated puzzles** (its value signal never reaches far enough ahead to matter for a typical
3-6-shanten position), and it ran 15-60x slower per call. Rejected in favour of the plan below.

## Todo

- [x] 1. `advisor.js` — new `estimateValue(player, ctx)`: exact expected value at tenpai
     (`scoreHand()` over `waits()`, weighted by remaining unseen copies of each winning tile) and a
     hand-authored heuristic before tenpai (`honourAndFlushPotential`: credit for a dragon,
     seat-wind or prevailing-wind pair/lone-tile — only for patterns the table's own house rules
     actually reward — plus a flush lean)
- [x] 2. `advisor.js` — new `contextFor(state, player)`: builds `ctx = { rules, seatWind,
     prevailingWind, visibleTiles }` from every seat's hand/melds/bonus plus all discards, never
     from `state.wall`'s actual contents — the wall and opponents' concealed hands stay an
     undifferentiated unknown pool, the way any honest efficiency tool treats them
- [x] 3. `advisor.js` — new `evaluateDiscard(player, tile, ctx)` and a rewritten `bestDiscard(player,
     ctx)`: ranks every candidate within one shanten of the fastest by `blended = -shantenAfter *
     VALUE_PER_SHANTEN + value`, falling back to the existing `keepValue` tie-break beneath that
- [x] 4. Rippled the new `ctx` argument through every call site: `advisor.js` (`situationHint`),
     `coach.js` (`adviceDiscard`, `adviceProgress`), `engine.js` (`recordDiscardDecision`, now
     `(state, player, chosen)` so it can build a real `contextFor`), `puzzles.js`
     (`tryDiscardPuzzle`/`checkDiscardAnswer`, via a fixed `puzzleContext()` — a puzzle has no live
     4-player state to derive a real context from)
- [x] 5. New `frontend/test/advisor.test.js` — this module had never had a dedicated file before
     (only exercised indirectly via `coach.test.js`/`engine.test.js`): `estimateValue()` at tenpai
     against a real, checkable score; the heuristic path respecting a rule being on vs. off; the
     concrete regression this feature exists for (a hand where the fastest tile and the
     highest-value tile differ, asserting `bestDiscard()` picks the value one); `contextFor()`
     reading every seat's hand/melds/bonus/discards as visible without ever touching `state.wall`
- [x] 6. Re-verified every existing fixture that touches `bestDiscard()`'s exact tile choice against
     the new value-aware function rather than assuming it still held — see "What changed
     underneath" below

## Review

### What was built

Exactly per the plan. `bestDiscard()`'s ranking is now `(blended speed+value score, keepValue)`
instead of `(shanten alone, keepValue)`, within a bounded one-shanten-of-fastest window so it can
never recommend sacrificing several turns of speed for value. The live coach, the decision log and
discard puzzles all still consume this one function, so none of them can disagree with each other —
same guarantee this project has held since the decision log first shipped.

**The honest finding, not overclaimed:** the plan's "core problem" framing was that value needs to
occasionally *outrank* a marginally faster tile, not just referee ties. That override mechanism is
real and present in the code (the one-shanten eligible window), but a ~75-second-bounded, ~20,000
random-hand simulation run directly against this implementation found **zero** cases of it actually
firing with the current `VALUE_PER_SHANTEN = 2` and the current heuristic weights. The actual,
measured improvement is entirely from richer **value-based tie-breaking** among tiles that already
tie on speed — previously all such ties fell through to `keepValue`, a pure structural heuristic
blind to scoring potential, which is exactly why "discard the lone honour" won almost every tie.
This is a real, demonstrated improvement (5 of the 9 curated puzzles changed which tile they
recommend, 3 of them switching from a lone honour to a suited tile) but a different mechanism than
the one most emphasized going in — documented here and in `docs/mvp-notes.md` rather than claimed as
the override working as originally envisioned.

### What changed underneath (re-verification, not re-derivation)

Making `bestDiscard()` value-aware changes which tile is "correct" for any hand where an honour or
flush-relevant tile used to look like a free discard. Re-ran every existing fixture through the new
engine via throwaway verification scripts rather than hand-deriving expected values (this session's
own track record of arithmetic mistakes reasoning about shanten by hand made that the only
trustworthy method):

- **3 of the 9 curated puzzles drifted out of their assigned difficulty tier** once a lone
  scoring-relevant honour started carrying real credit (`easy-1` → medium, `medium-1`/`medium-2` →
  hard). Replaced with 3 freshly-found hands, re-verified against the recalibrated thresholds below,
  picked for diverse `bestTile`s rather than three near-identical answers.
- **Difficulty-tier thresholds recalibrated a second time** (tie-count based, same methodology as
  the original calibration from an earlier PR): the old cutoffs (`≤4 hard, ≤7 medium`) were tuned
  for the pre-value-aware tie distribution; a fresh ~20,000-hand simulation against the new engine
  gave `≤4 hard, ≤6 medium, else easy`.
- **3 existing unit-test fixtures needed real replacement**, not just updated assertions, because
  the hands they relied on to be "degenerate" or "fully tied" no longer were once a lone dragon or
  seat/prevailing wind stopped being value-neutral: `puzzles.test.js`'s degenerate-hand test and its
  tie-count assertion (11 → 8, same tier), and `engine.test.js`'s alternatives-truncation regression
  test (its old 5-lone-honours hand was no longer a 5-way tie).
- **Two pre-existing `engine.test.js`/`advisor.test.js` fixtures turned out to be flaky**, not
  broken by the feature but exposed by it: both build a live `state` via `newGame()` (a real random
  deal) and only pin the human player's hand, which was safe when `bestDiscard()` only looked at
  that one hand. Now that `recordDiscardDecision`/`contextFor` read *every* seat's hand, melds and
  bonus tiles to build `visibleTiles`, an unpinned random tile dealt to another seat (an extra
  `we`/`ws` copy in one case, a randomly-dealt flower tile landing in another seat's `.bonus` in the
  other — `newGame()`'s own post-deal bonus-replacement pass runs before a test gets to override
  anything) could silently tip an EV-weighted tie or inflate a visible-count assertion. Fixed by
  pinning every seat's hand (and clearing every seat's `.bonus`) in both tests rather than just the
  human's — caught by running the full suite 20+ times in a loop, not by a single green run, after
  the first flake surfaced on an unrelated later pass.

### Test plan

- `cd frontend && npm test` — 91/91 pass (84 previous + 7 new in `advisor.test.js`), confirmed
  stable across 15 consecutive full-suite runs after fixing the two flaky fixtures above (a single
  green run was not enough evidence, given both flakes only appeared intermittently).
- `cd frontend && npm run test:components` — 13/13 pass, unaffected.
- `cd frontend && npm run build` — clean.
- Manual browser check: opened the Easy tier's first puzzle and confirmed it now recommends
  discarding a suited dots tile rather than the lone dragon that used to be correct there; opened
  Medium puzzle 1 and confirmed its recommended `9 Bamboo` is graded "Correct!"; started a live game
  and asked the coach "what should I discard?" on a dealt hand holding a Green Dragon pair plus a
  lone South Wind — it correctly recommended discarding the lone wind, with the explanation "It is a
  lone wind or dragon, so it needs three of a kind to be worth anything," explicitly in value terms
  rather than only citing shanten.

### Known limits

1. **The "sacrifice speed for value" override is real code but not yet a real behaviour** — see
   the honest finding above. `VALUE_PER_SHANTEN` and the heuristic's per-pattern weights are all
   named, tunable constants rather than derived numbers; raising `VALUE_PER_SHANTEN` or the flush/
   honour weights would make the override fire more often, but that tuning wasn't in scope this
   round and wasn't done blind — it would need its own simulation-driven pass to avoid recommending
   a play that's obviously too greedy.
2. **`estimateValue()` past tenpai is still a hand-authored heuristic, not a probability model** —
   deliberately, per the "lightweight single-step estimate" fidelity decision made before
   implementation. It only ever reasons about the player's own hand and the table's house rules; it
   never looks at what an opponent might already be collecting.
3. **Still no defensive awareness**, unchanged from before this round — discard advice still doesn't
   weigh how dangerous a tile is to throw, because the bots do not play to win off discards yet.

# PR #9 review response

`joshu4-j-j0hn` left 6 comments on PR #9 (code snippets plus a closing list of blocker/important/
follow-up items and an architecture sketch for a future LangGraph-based coach). Investigated each
against the actual code and, where a change was proposed, benchmarked or simulated it before
deciding — the same standard this PR held PR #8 to — rather than accepting or rejecting anything on
description alone.

## Todo

- [x] 1. **Fix `contextFor()`'s concealed-hand leak (flagged "potential blocker").** Confirmed real:
     the function's own doc comment says opponents' concealed hands are unknown, but the loop summed
     every seat's `p.hand`, not just the deciding player's. Fixed in `advisor.js` to only add the
     deciding player's own hand, keeping every seat's exposed melds/bonus and all discards as
     before. `puzzles.js` is unaffected (it builds its own fixed, single-hand `puzzleContext()`,
     never a live one) — confirmed by grepping every `contextFor(state, ...)` call site first.
- [x] 2. **Add a regression test for #1** in `advisor.test.js`: another seat holds a tile
     (`ww`) only in their concealed hand, never melded/bonused/discarded, and the test now asserts
     it does *not* appear in `visibleTiles` — the previous version of this test never happened to
     put an overlapping tile in another seat's hand, so it passed both before and after the bug
     existed without catching it.
- [x] 3. **Replace exact `blended === blended` comparisons with a tolerance (flagged "important").**
     Real, if subtler, risk: `estimateValue()`'s tenpai branch divides a weighted sum by a
     remaining-tile count, so two candidates that are conceptually tied could differ by a float
     epsilon depending on summation order. Added `blendedTie()` (a named `1e-9` tolerance, far below
     the smallest real difference this scale can produce) to `advisor.js` and switched every
     tie-detecting comparison to it: `bestDiscard()`'s `alternatives` filter, `engine.js`'s
     `optimal` check, and `puzzles.js`'s `tieCount` count and `checkDiscardAnswer()`.
- [x] 4. **Simplify the two flakiness fixes from the original PR now that #1 removed their root
     cause.** The `engine.test.js` "tied with the recommended tile" test no longer needs pinned
     hands for players 1-3 — `contextFor()` never reads another seat's concealed hand any more, so
     an extra random `we`/`ws` copy dealt elsewhere can no longer tip the tie regardless. Verified
     with a 30-run loop before simplifying, so this is a confirmed cleanup, not a guess.
- [x] 5. **Benchmark the proposed live-ukeire addition (flagged "important") before deciding.**
     Prototyped the suggested `improvingTiles()` (calling `shanten()` for every standard tile per
     candidate discard) and timed it against 200 real dealt hands: **1.95ms → 44.3ms per
     `bestDiscard()` call, a ~22x regression** — the same class of slowdown that disqualified PR #8
     in the first place, and a direct conflict with the "lightweight single-step estimate" fidelity
     decision made explicitly for this feature. **Declined**, with the benchmark kept as the record
     of why, in `docs/mvp-notes.md`.
- [x] 6. **Replace the hard `dominant >= 10` flush cliff with a graduated concentration credit
     (flagged "follow-up").** Cheap (pure arithmetic, no extra `shanten()` calls) and a genuine
     realism improvement — the old cliff gave a 9-same-suit-tile hand zero credit and a 10-tile hand
     full credit for one tile's difference. Adopted the reviewer's concentration idea
     (`dominant / suitedTotal`) but added a guard the original snippet didn't have: credit only
     applies once at least 7 tiles are suited at all, so a hand with 3 suited tiles of one kind and
     11 honours can't hit "100% concentration" and get flush credit by sheer small-sample luck.
     Confirmed via script that none of the 9 curated puzzles or existing test fixtures reach even a
     6-tile dominant suit, so this landed with zero re-verification burden.
- [x] 7. **Considered and declined two further items, documented rather than silently skipped.**
     "Add a one-step exact value search at shanten === 1" would meaningfully increase both
     complexity and cost, and directly contradicts the "Lightweight single-step estimate" fidelity
     level the user explicitly chose for this feature during planning — a scope decision, not a bug,
     so not overridden on a reviewer's say-so alone. "Expose `{shanten, ukeire, expectedTai}` from
     `bestDiscard()` for a future LangGraph coach" describes an architecture (a LangGraph agent) that
     doesn't exist anywhere in this codebase — nothing to wire up yet; `bestDiscard()`'s return shape
     can be revisited if and when that agent is actually built.

## Review

### What was built

Two real fixes (the concealed-hand leak and the float-tolerance comparisons), one adopted
improvement with an added safeguard (graduated flush concentration), one benchmarked-and-declined
proposal (live ukeire) with the numbers to back the decision, and two scope items declined with
reasoning rather than ignored. The concealed-hand fix is the one with real behavioural weight —
every "before" number the coach and decision log ever produced at tenpai was computed with more
information than a real player has; after this PR, `docs/mvp-notes.md`'s own stated honesty
principle actually matches what the code does.

### Test plan

- `cd frontend && npm test` — 91/91 pass, confirmed stable across 20 consecutive full-suite runs
  after the `contextFor()` fix (the same "don't trust one green run" standard applied to the
  flakiness fixes earlier in this PR).
- `cd frontend && npm run test:components` — 13/13 pass.
- `cd frontend && npm run build` — clean.
- Re-ran the ~20,000-hand difficulty-tier simulation fresh against the patched engine: split moved
  from ~36/35/28% (hard/medium/easy) to ~31/34/35%, still a workable three-way balance — no further
  threshold recalibration needed. Confirmed via the puzzle library's own self-validation (throws on
  a mistiered entry) that none of the 9 curated puzzles drifted.
- Manual browser check: asked the live coach "what should I discard?" on a freshly dealt hand after
  the `contextFor()` fix — advice still names a real tile in hand with a sensible value-based reason,
  confirming the fix didn't regress the ordinary case, just the information it's computed from.

### Known limits (unchanged from the original PR, restated for completeness)

The `VALUE_PER_SHANTEN`/flush/honour weights are still named guesses, not derived numbers;
`estimateValue()` past tenpai still never models what an opponent might be collecting; discard
advice still doesn't weigh danger. See the original PR's "Known limits" above — nothing in this
review round touched those boundaries, only the correctness and robustness of what already existed.

# Adding real ukeire after all

The previous round benchmarked the reviewer's ukeire proposal (~22x slower per `bestDiscard()`
call) and declined it, on the grounds that it conflicted with this feature's "lightweight
single-step estimate" scope decision. Explicitly asked to implement it anyway and accept the
speed cost for a more robust ranking — a scope decision only the user could make, so this isn't
reopening a settled question, it's a new instruction overriding the old one.

## Todo

- [x] 1. `advisor.js` — new `improvingTiles(player, ctx, current)` (private): the real ukeire —
     total remaining copies (across every standard tile kind) of a tile that would move the hand
     one step closer to winning. Takes the already-computed `current` shanten as a parameter rather
     than recomputing it, since this function is already the expensive part of a `bestDiscard()`
     call and there's no reason to pay for `shanten()` twice.
- [x] 2. `advisor.js` — new `UKEIRE_WEIGHT = 0.5` constant (same "named, tunable guess" footing as
     `VALUE_PER_SHANTEN`), and `evaluateDiscard()` now folds `UKEIRE_WEIGHT * Math.log1p(ukeire)`
     into the one shared `blended` score, alongside the existing shanten and value terms — kept as
     one number every consumer already reads, rather than adding ukeire as a separate ranking stage
     coach/decision-log/puzzles would each need to know about. Log-scaled deliberately: the
     difference between 2 outs and 6 outs is real, the difference between 40 and 44 barely matters.
     `bestDiscard()`'s return also now exposes `ukeire` for the chosen tile.
- [x] 3. Benchmarked the real implementation (not just the earlier prototype) against 200 dealt
     hands: **~51ms per `bestDiscard()` call**, up from ~2ms — the accepted cost.
- [x] 4. Recalibrated the puzzle difficulty thresholds a third time. Real ukeire differentiates
     almost every non-symmetric candidate, so exact ties collapsed hard: a fresh ~2,000-hand
     simulation (each sample now costs enough that 20,000 wasn't practical, but the histogram's
     shape was unambiguous well before 2,000) found 53% of hands now have a *uniquely* best tile,
     30% exactly two, only 17% three or more. `difficultyOf()` in `puzzles.js` is now `tieCount <= 1`
     → hard, `=== 2` → medium, else easy.
- [x] 5. Re-verified all 9 curated puzzles against the new engine: 8 of 9 drifted out of their tier
     (only `medium-2` happened to still land correctly) and were replaced with freshly-found hands,
     re-verified *with* their discard-history dressing included (which also feeds `visibleTiles`,
     so it can shift a tie count too) — not just the bare hand.
- [x] 6. Re-verified every existing test fixture touching `bestDiscard()`'s exact tie behaviour,
     replacing three that no longer held:
     - `engine.test.js`'s alternatives-truncation test needed a genuinely new fixture — its old
       5-way tie broke asymmetrically under ukeire (discarding an isolated *honour* now correctly
       beats discarding an isolated *suited* terminal, since a suited tile can still accept a
       neighbour draw into a partial and an honour can only ever pair with itself — a real
       precision gain, not a bug). Found a genuine 4-way tie by search instead.
     - `puzzles.test.js`'s "every discard ties" degenerate-hand test needed a new fixture built a
       different way: a uniformly random 14-tile hand essentially never produces a full tie any
       more (a 100-second/1,000-sample search for one came back empty), so this one was found by
       biasing generation toward *few, heavily-repeated* tile kinds instead — 3 complete triplets
       plus a spare-tile quad, plain suited tiles only, tie exactly on shanten, value, *and* ukeire.
     - `puzzles.test.js`'s "scattered, far-from-ready easy puzzle" test's old hand had drifted to a
       2-way ("medium") tie; replaced with a freshly-found 4-way tie of similar shape.

## Review

### What was built

Real ukeire, folded into the same single `blended` score the coach, decision log, and puzzles have
shared since the value-aware rewrite — so this stays a ranking upgrade, not a second, separate
opinion that could disagree with the first. The quality improvement is real and demonstrable: the
alternatives-truncation fixture replacement above is a concrete example of `bestDiscard()` now
correctly preferring an isolated honour over an isolated suited terminal specifically because of
their different real acceptance profiles — a distinction the pre-ukeire engine had no way to draw.

### Test plan

- `cd frontend && npm test` — 91/91 pass, confirmed stable across 8 consecutive full-suite runs (a
  smaller stress-test count than earlier rounds, since the suite now takes ~4.6s instead of ~0.5s —
  ukeire's cost is real and shows up in the test run too, not just in production).
- `cd frontend && npm run test:components` — 13/13 pass.
- `cd frontend && npm run build` — clean.
- Manual browser check: the live coach's "what should I discard?" still felt instant despite the
  ~51ms cost (imperceptible for a single click), and correctly kept a seat-wind/dragon/pair-heavy
  hand's value intact by discarding a genuinely isolated tile; the recalibrated Easy puzzle 1 (a
  fresh hand, not the one from the last round) graded "Correct!" on its new recommended tile.

### Known limits

Same as the prior round's, unaffected by this change: the weights here (`VALUE_PER_SHANTEN`,
`UKEIRE_WEIGHT`, the flush/honour credits) are still named guesses, not derived numbers;
`estimateValue()` past tenpai still never models what an opponent might be collecting; discard
advice still doesn't weigh danger. The one new limit worth naming: `bestDiscard()` is now
meaningfully slower (~51ms), which is fine for a single synchronous coach call but would need a
second look if it were ever called in a hot loop (e.g. bot decision-making at scale, or a future
batch-analysis feature) rather than once per human click.

# PR #9 second review round: a real bug, a verified-not-a-bug, and a docs precision ask

Three more comments landed after the ukeire commit: one "Request changes" (a real bug), one asking
me to verify a specific correctness concern about the new ukeire code rather than asserting it was
broken, and one suggesting more precise objective-function documentation. Verified each against the
actual code with a script before deciding, rather than assuming either the bug report or my own
prior implementation was correct.

## Todo

- [x] 1. **Fix `evaluateDiscard()`'s invalid-tile failure mode (confirmed real via script).** Same
     class of bug already found and fixed once in `puzzles.js`'s `checkDiscardAnswer`:
     `rest.indexOf(tile)` returns `-1` for a tile not in the hand, and `splice(-1, 1)` silently
     removes the *last* tile instead and returns a fabricated evaluation for a completely different
     discard. Confirmed via script: `evaluateDiscard(player, 'dg', ctx)` on a hand without `'dg'`
     returned a plausible-looking result instead of failing. Now throws
     `evaluateDiscard: "<tile>" is not in hand`. Checked every call site first — `bestDiscard()`/
     `tryDiscardPuzzle()` only ever pass a tile drawn from the hand itself, and
     `discardTile()`/`checkDiscardAnswer()` already validate membership before calling this — so no
     production path was ever exposed to the bug, and none breaks from the fix.
- [x] 2. **Verify (not just fix) the "does ukeire double-count or miss the player's own held
     copies" concern.** Wrote two scripts before touching any code: one confirming
     `ctx.visibleTiles` already includes the deciding player's own hand (from the earlier
     concealed-hand fix), so `4 - visibleTiles[tile]` already correctly subtracts self-held copies
     (holding a pair of a tile → `visibleTiles = 2`; holding all 4 → `visibleTiles = 4`, both
     correct); the other confirming self-held and externally-exposed copies of the same tile
     combine into one correct total (1 held + an opponent's exposed pong of 3 → `visibleTiles = 4`,
     leaving 0 remaining, a genuinely dead wait). **Conclusion: not a bug** — but the invariant
     wasn't documented anywhere and had no dedicated regression test, both of which the reviewer
     explicitly asked for, so added both rather than just replying "already correct."
- [x] 3. **Two new regression tests in `advisor.test.js`**, using the two scripts above as their
     basis (both hand-checkable, not guessed): a hand where discarding one tile leaves a tenpai
     tanki wait on a lone `dr`, asserting `ukeire === 3` (4 total copies minus the 1 already held);
     and the same wait with an opponent's exposed pong of `dr` added, asserting `ukeire === 0`
     (all 4 real copies now accounted for). Plus a third test locking in `evaluateDiscard()`'s new
     throw for a tile not in hand.
- [x] 4. **Softened the "quickest win" framing in `bestDiscard()`/`improvingTiles()`'s doc comments**
     per the reviewer's documentation-precision suggestion: both now explicitly describe this as
     *immediate*, one-draw ukeire and a one-step value estimate — an approximation of the
     fastest/highest-value path, not a stronger expected-draws-to-win guarantee. No code changed
     for this item, only what the code claims about itself.

## Review

### What was built

One real, fixed bug (confirmed via script, not assumed from the report); one concern investigated
and found to already be handled correctly, with the verification turned into a permanent regression
test and an explicit doc comment rather than a private "checked, it's fine" left unrecorded; and a
documentation precision fix with zero behavioural change. This round didn't need a puzzle-library or
test-fixture recalibration — nothing here changes what any `bestDiscard()` call actually returns for
a valid input, only what happens on an invalid one and what the code says about itself.

### Test plan

- `cd frontend && npm test` — 94/94 pass (91 previous + 3 new), stable across 6 consecutive runs.
- `cd frontend && npm run test:components` — 13/13 pass.
- `cd frontend && npm run build` — clean.
- No manual browser re-check needed this round — nothing here is reachable through the UI in a way
  that differs from what was already verified (the invalid-tile throw has no caller that could ever
  trigger it from the app; the ukeire arithmetic was already correct, not changed).

# Architectural note: puzzle difficulty is coupled to the evaluator, not to human difficulty

Raised after the ukeire round, once the pattern became undeniable rather than a one-off: this is the
*third* time `puzzles.js`'s `tieCount`-based difficulty thresholds have needed recalibrating, and
each time was purely because `bestDiscard()` itself got better at distinguishing candidates (first
value-awareness, now real ukeire) — not because the underlying positions changed. The ukeire round's
own numbers make the case concretely: 53% of random hands went from "several plausible discards" to
"a uniquely correct one" purely from a better evaluator, and 8 of the 9 curated puzzles' difficulty
labels flipped as a side effect. `tieCount` measures the evaluator's current blind spots, not a
stable property of the position — a form of the "leaky abstraction" problem: difficulty should be a
property of the *puzzle*, but the current metric is really a property of whatever `bestDiscard()`
happens to be able to tell apart *this week*.

This is a documentation-only entry — **no code changed**, and none was asked for. Captured now so
the next evaluator improvement (a smarter `estimateValue()`, a deeper ukeire lookahead, anything
else that sharpens `bestDiscard()`) doesn't quietly repeat the same "recalibrate again" cycle without
anyone having named why it keeps happening.

## What was written up

- [x] `docs/mvp-notes.md` — new "Known simplifications" item 10, laying out: the diagnosis (tieCount
     conflates evaluator power with human difficulty), the concrete evidence (three recalibrations,
     the 53%/8-of-9 numbers from this session), two candidate directions for a more stable signal —
     **score margin / candidate ambiguity** (buildable today, no new infrastructure, but still scaled
     by the same tunable weights so not a full decoupling) and **real player success data** (the
     actual ground truth, but needs accounts/persistence/telemetry this app doesn't have — Phase 3+)
     — and the deliberate current stance: keep puzzle *correctness* tied to the live evaluator
     (a puzzle's answer must always match what the coach would actually recommend), but treat the
     *difficulty label* as a separate, intentionally-unsolved concern rather than patching
     thresholds again next time.
- [x] `tasks/todo.md` — this entry, for the same reason every other design decision in this file
     gets one: so the reasoning behind a choice survives past the conversation that produced it.

## Review

Purely a documentation change — `git diff` touches only `docs/mvp-notes.md` and `tasks/todo.md`, no
source or test files. No verification steps apply (nothing runnable changed); `npm test`/
`npm run build` were not re-run since nothing in `frontend/` was touched.

Not decided yet, and deliberately left open: whether to actually build the score-margin metric, and
on what timeline. That's a separate, larger piece of work (defining what "margin" means as a
difficulty score, calibrating it via the same simulation methodology already established in this
project, re-verifying the puzzle library and test fixtures against it) — this entry exists so that
work has a clear rationale to start from whenever it's picked up, not so it happens automatically.

---

# AI agent framework + post-hand review agent

The empty `agents/` placeholder plus a proposed LangGraph.js + Bedrock + DynamoDB sketch. Goal: a
right-sized framework that fits what the repo already is, plus one working agent proving it, on the
cheapest Bedrock model until testing justifies more. Plan approved at
`.claude/plans/open-can-you-propose-shiny-curry.md`.

## Decisions (confirmed with user)

1. No LangGraph yet — the three sketched "graphs" are linear pipelines; start with a plain
   context-builder -> one Bedrock Converse call -> strict validator, mirroring `classifyIntent.ts`.
   Keep the directory shape so a graph can drop in later.
2. Build the post-hand **Review** agent first — its input (`state.decisions`) already exists, it's
   not latency-sensitive, and the model only phrases facts the engine already graded.
3. Model: keep `amazon.nova-micro-v1:0` (repo default, cheapest). One env var `AGENT_MODEL_ID`.
4. Share the engine via a `package.json`+`index.js` barrel added to `frontend/src/game/` — no file
   moves.
5. "Tools" are deterministic context providers that run before the model, not LLM-callable tools.
6. "Memory" is an interface with a no-op impl (DynamoDB needs accounts — Phase 3+).

## Todo

- [x] `frontend/src/game/package.json` + `index.js` — `@kaki/game` barrel (no file moves; frontend
     keeps its relative imports)
- [x] `agents/` package — `package.json` (`file:` dep on `@kaki/game`), `types/index.d.ts` for the
     TS backend
- [x] `agents/src/model.js` — the ONLY model call: Bedrock Converse, `AGENT_MODEL_ID`, low temp,
     tight maxTokens, `parseJsonObject` helper
- [x] `agents/src/schema.js` — `ReviewResult` shape + strict `isReviewResult` validator +
     `normalizeReviewResult`
- [x] `agents/src/context/decisionContext.js`, `rulesContext.js` — pure ground-truth builders over
     `state.decisions` / `state.rules`
- [x] `agents/src/review/{prompt,deterministic,reviewHand}.js` — the pipeline; any failure ->
     `deterministicReview`
- [x] `agents/src/memory/memory.js` — `createMemory()` no-op interface
- [x] `agents/src/index.js` barrel + `agents/README.md` (framework doc, why-not-LangGraph, how to
     add the next agent)
- [x] `agents/test/reviewHand.test.js` — 7 cases, Bedrock mocked (empty log, useModel:false, clean
     hand, valid reply, malformed reply, schema-violating reply, Bedrock throwing)
- [x] `backend/lambda/reviewHand.ts` — thin handler, `{ decisions, rules }` -> `runReview` -> JSON,
     502 only on genuinely unexpected error
- [x] `backend/lib/kaki-mahjong-stack.ts` — `ReviewHandFn` + `/review-hand` route on the existing
     `CoachApi`, reusing the throttle/reserved-concurrency, scoped Bedrock IAM (agent model ARN),
     the Budget scope; renamed the 5xx alarm to `CoachApiServerErrorAlarm` (now covers both
     routes — API GW v2 has no per-route 5xx metric); `ReviewHandUrl` output
- [x] `backend/package.json` — `file:` deps on `@kaki/agents` + `@kaki/game` so esbuild bundles them
- [x] `frontend/src/game/review.js` — `localReview()` (offline summary, shape-compatible with the
     backend `deterministicReview`) + `postHandReview()` network wrapper (falls back to local on
     no-URL / non-2xx / timeout / malformed)
- [x] `frontend/src/components/HandReview.jsx` + `ScoreSheet.jsx` (accepts `children`) + `App.jsx`
     (renders it at `phase === 'over'`) + `styles.css` (`.hand-review`)
- [x] `frontend/.env.template` — optional `VITE_REVIEW_URL`
- [x] `docs/mvp-notes.md` — rewrote known-limitation #9 (`state.decisions` now has its first
     consumer)

## Review

### What was built

A small, deliberately un-clever agent framework in `agents/` (`@kaki/agents`), and the first agent
on it: a **post-hand review** shown in the end-of-hand ScoreSheet.

**Framework shape** (one pipeline, no LangGraph): deterministic context builders restate the facts
the engine already graded -> one Bedrock Converse call phrases them warmly -> the output is
strictly validated against `schema.js` -> anything that doesn't fit (bad shape, model error, no
model configured) falls back to a model-free `deterministicReview`. This is the same
"the model never writes the authoritative content" guarantee `backend/lambda/classifyIntent.ts`
already established. `src/model.js` is the only place a model is called; the model is one env var
(`AGENT_MODEL_ID`, default `amazon.nova-micro-v1:0`).

**Engine sharing, no refactor**: `frontend/src/game/` gained a `package.json`+`index.js` barrel so
it resolves as `@kaki/game`. The frontend app is untouched (it still uses relative imports).
`agents/` and `backend/` depend on it via `file:` links; esbuild bundles it into the Lambda at
synth (`cdk synth` proves this).

**Review agent**: `runReview({ decisions, rules })` -> `{ headline, goodMoves[], improvements[],
oneThingToTry, modelAssisted }`. Deployed as `backend/lambda/reviewHand.ts` on the existing
`CoachApi` HTTP API — same throttle, reserved concurrency, scoped Bedrock IAM, Budget, and (now
API-wide) 5xx alarm as classify-intent. The frontend calls it only when `VITE_REVIEW_URL` is set;
unset, `frontend/src/game/review.js`'s `localReview()` assembles the same shape offline with no
network call. `HandReview.jsx` renders it inside the ScoreSheet (which gained a `children` prop).

**Not built** (out of scope, in the plan): LangGraph adoption, coach-answer generation, the
strategy bot opponent, DynamoDB player memory (needs accounts), and de-duplicating
`backend/lambda/mahjong/` against `@kaki/game` (tile-label encodings differ — `"5-dot"` vs `"d5"`).

### Verification

- `cd agents && npm install && npm test` — 7/7 pass, Bedrock mocked.
- `cd frontend && npm test` — 102/102 (was 59; +8 review + others), `npm run test:components` 13/13,
  `npm run build` clean. The nested `src/game/package.json` does not break Vite or vitest.
- `cd backend && npm install && npm run build && npx cdk synth -c envName=dev` — clean; template has
  `ReviewHandFn` (ReservedConcurrentExecutions 2, `AGENT_MODEL_ID`), the scoped
  `bedrock:InvokeModel` policy, `POST /review-hand` on `CoachApi`, `CoachApiServerErrorAlarm`,
  `ReviewHandUrl`. `cd backend && npm test` still 17/17.
- End-to-end smoke: a throwaway script played a full hand via `engine.js`, then ran both
  `localReview()` and `runReview()` (AGENT_MODEL_ID unset) over the real `state.decisions` — both
  produced well-formed, shape-compatible reviews.
- Browser: dev server boots with no console errors; auto-drove a hand to completion and confirmed
  the review panel renders in the ScoreSheet ("How that hand went" + headline + "NEXT TIME" bullets
  + "One thing to try"), styled and scaling with the size slider, on the offline `localReview` path.

### Known limits

- Not deployed (`cdk synth` only) and never run against real Bedrock — Nova Micro's prose quality
  for review write-ups is untested; `AGENT_MODEL_ID` is the single knob to try `amazon.nova-lite-v1:0`
  or a Claude Haiku model on Bedrock if it's too stiff.
- `localReview` (frontend) and `deterministicReview` (agents) are kept shape-compatible by hand, not
  by a shared module (the agents path can't be imported into the browser bundle — it pulls the AWS
  SDK). A drift-guard test like `coach.js` <-> `intents.json` could pin them if this matters later.

## PR #11 review — changes made

Collaborator review raised 5 points. Addressed:

- [x] **Drift guard (request-changes).** `localReview()` and `deterministicReview()` no longer
     have two implementations. The model-free assembly moved to `frontend/src/game/reviewCore.js`
     (`decisionFacts` + `assembleReview`); `frontend/src/game/review.js` is now just the network
     layer, and `agents/src/review/deterministic.js` + `agents/src/context/decisionContext.js`
     re-export from `@kaki/game`. `agents/test/contract.test.js` feeds 6 decision-log fixtures
     through both entry points and asserts `deepEqual`.
- [x] **Grounding, partial (architecture suggestion).** `runReview()` now rejects a schema-valid
     model reply that lists more `improvements` than there were sub-optimal moves, or more
     `goodMoves` than optimal ones — it isn't grounded in the decision log. Two tests added. The
     full version (per-item `decisionId` referencing a graded decision) is noted as a follow-up in
     `agents/README.md`.
- [ ] **`advisorVersion` on decision records (future-proofing).** Agreed, but it's an `engine.js`
     schema change and only matters once decisions persist (Phase 3+) — out of scope for this
     consumer PR. Noted as a follow-up in `agents/README.md`.
- [x] **Defer LangGraph (+1).** No change — reviewer agreed with the approach.
- [x] **Test coverage.** Added: the contract/golden test above, two grounding-guard tests, a
     fenced-```json``` reply test, and malformed-array-entries coverage in the contract fixtures.
     Zero-decisions / all-optimal / transport-failure cases were already covered.

---

# advisorVersion on decision records

Next piece after the agent framework (PR #11), from the same review's follow-up list.

Once `state.decisions` becomes a persistent, replayed data source, a consumer needs to know which
evaluator produced each `optimal` / `recommended` value — `advisor.js` has already been through
three grading epochs (shanten-only → value-aware → real ukeire) and will change again.

## Todo

- [x] `frontend/src/game/advisor.js` — `export const ADVISOR_VERSION = 'v3-ukeire'`, with a
     comment on when to bump it (a change that would flip what counts as the best move)
- [x] `frontend/src/game/engine.js` — import it; add `advisorVersion: ADVISOR_VERSION` to the
     objects `recordDiscardDecision` and `recordClaimDecision` return
- [x] `frontend/test/engine.test.js` — one test asserting both a `discard` and a `claim` entry
     carry `advisorVersion === ADVISOR_VERSION`
- [x] `docs/mvp-notes.md` #9 + `agents/README.md` follow-ups — note it's stamped, not yet consumed

## Review

Three-line change plus a test. `advisor.js` gains `ADVISOR_VERSION` next to its other exported
tuning constants; `engine.js` (which already imports from `advisor.js`) stamps it onto both
decision-entry shapes. No behaviour change — the review pipeline (`reviewCore.js` / `@kaki/agents`)
doesn't read the field, and won't until decisions persist across sessions, at which point a review
of old history should flag a grade from a superseded evaluator. `agents/README.md`'s follow-up
list updated from "not recorded" to "stamped, not consumed".

Tests: frontend 103/103 node + 13/13 component + build; agents 17/17; backend tsc clean.

---

# Bedrock: US inference profile + us-east-1

The hackathon sandbox's org SCP denies `bedrock:InvokeModel` outside `ap-southeast-1`, and Nova
Micro has no bare on-demand id in `ap-southeast-1` — only the `apac.` cross-region inference
profile, which needs the very regions the SCP blocks. `us.amazon.nova-micro-v1:0` in `us-east-1`
works (verified with `aws bedrock-runtime converse`), which the hackathon instructions point at.

## Todo

- [x] `backend/bin/app.ts` — region default `ap-southeast-1` → `us-east-1` (still `CDK_DEFAULT_REGION`-overridable)
- [x] `backend/lib/kaki-mahjong-stack.ts` — `bedrockModelId` / `agentModelId` default →
     `us.amazon.nova-micro-v1:0`; new `bedrockInvokeResources()` helper that returns the
     profile ARN + region-wildcarded base-model ARN for a profile id, or the single
     foundation-model ARN for a bare id; both Lambdas' `bedrock:InvokeModel` policies use it
- [x] `backend/lambda/classifyIntent.ts`, `agents/src/model.js` — local-run fallback strings →
     `us.amazon.nova-micro-v1:0` (dead in the deployed Lambda, which always gets the env var)
- [x] `backend/README.md`, `agents/README.md` — region + model + IAM notes

## Review

CDK-only functional change. `bedrockInvokeResources()` detects an inference-profile id by its
`us.` / `eu.` / `apac.` / `us-gov.` prefix and grants both the account-scoped
`inference-profile/<id>` ARN (in the deploy region) and `bedrock:*::foundation-model/<baseId>`
(region-wildcarded, still one model id) — that second ARN is what a cross-region profile actually
needs, since it fans out to regional copies of the base model. A bare model id still gets just the
one `<region>::foundation-model/<id>` ARN, unchanged. No Lambda code change: `ConverseCommand`
takes a profile id as `modelId` directly.

`cdk synth` verified: both `ClassifyIntentFn` and `ReviewHandFn` get
`BEDROCK_MODEL_ID` / `AGENT_MODEL_ID = us.amazon.nova-micro-v1:0`, the two-ARN policy, region
resolved to `us-east-1`. Tests unchanged (none assert a model id): backend 17/17, agents 17/17,
frontend 103/103.

Next: `cdk bootstrap` + `cdk deploy` in the sandbox, set `VITE_REVIEW_URL`, play a hand, confirm
`modelAssisted: true` and that Nova Micro's prose is acceptable (or bump `-c agentModelId=`).

## PR #14 review — changes made

- [x] **Synth-time region/profile validation (request-changes).** `lib/bedrockResources.ts` now
     also exports `assertModelRegionMatch(region, id, contextKey)`: if `id` is a `us.` / `eu.` /
     `apac.` / `us-gov.` cross-region inference profile whose geo doesn't match the deploy region,
     it throws with a fix hint (`-c bedrockModelId=<geo>.<model-id>` or deploy elsewhere). Called
     for both `bedrockModelId` and `agentModelId` before the Lambdas are built. Verified:
     `cdk synth -c bedrockModelId=eu.amazon.nova-micro-v1:0` (region us-east-1) fails; the default
     synth passes.
- [x] **Helper extracted + scoped (non-blocking note).** `bedrockInvokeResources` moved from an
     inline arrow in the stack to `lib/bedrockResources.ts`, pure (takes partition/region/account/
     id, no `this`), with a header comment stating it handles plain foundation-model ids and the
     current system-defined cross-region inference-profile ids only — not application inference
     profiles or other forms.
- [x] **Direct tests (test suggestion).** `backend/test/bedrockResources.test.ts` (8 cases): bare
     id → one foundation-model ARN; profile → profile ARN + region-wildcarded base-model ARN;
     base-model dots preserved; `us.` vs `us-gov.` disambiguation; matching pair passes; bare id
     never throws; mismatch throws naming region/prefix/key; error suggests the right prefix. The
     stack calls the one helper for both Lambdas, so covering it covers both routes' policy shape
     — chose this over a `Template.fromStack` synth test since that triggers `NodejsFunction`
     esbuild bundling and `npm test` is deliberately build-dependency-free (that's what
     `test:integration` is for).

backend 25/25 (17 + 8 new), agents 17/17, frontend 102/102. `cdk synth` clean.
