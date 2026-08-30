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
