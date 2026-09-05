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
