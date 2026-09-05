// Discard puzzles: a frozen hand with a genuine, checkable right answer.
//
// Reuses advisor.js's own bestDiscard()/evaluateDiscard()/shanten() rather than any separate
// judging logic, so a puzzle's answer can never disagree with what the live coach would say about
// the same hand. Pure, like the rest of src/game/ — no React import, testable in plain Node.

import { DEFAULT_RULES } from './scoring.js';
import { shanten, bestDiscard, evaluateDiscard } from './advisor.js';

/**
 * A fixed context for a frozen puzzle hand: default house rules, always seated East. There's no
 * live 4-player state behind a puzzle to derive this from the way `advisor.js`'s `contextFor()`
 * does for a real game, so visibility is built from just the hand and its curated discard history.
 */
function puzzleContext(hand, discards) {
  const visibleTiles = {};
  const add = (tile) => { visibleTiles[tile] = (visibleTiles[tile] || 0) + 1; };
  for (const t of hand) add(t);
  for (const d of discards) add(d.tile);
  return { rules: DEFAULT_RULES, seatWind: 'we', prevailingWind: 'we', visibleTiles };
}

/**
 * How hard a puzzle is: the number of distinct tiles that tie for the single best blended
 * (speed + value) score. Fewer ties means the right answer stands out sharply from everything
 * else (hard); more ties means several discards are all correct (easy, forgiving).
 *
 * This is *not* the shanten gap to the closest wrong tile — that gap turns out to always be
 * exactly 1 (checked against 20,000 randomly generated hands), a structural property of shanten
 * under single-tile removal, so it carries no difficulty signal at all. Tie count does vary
 * meaningfully across real hands.
 *
 * Thresholds were recalibrated (again checked against ~20,000 hands, this time through the
 * value-aware `bestDiscard()`) when `estimateValue()` gained a small credit for a single
 * scoring-relevant honour, not just a formed pair — that alone differentiates enough tiles that
 * ties got noticeably rarer, so the old cutoffs (from before value-awareness existed) would have
 * called almost everything 'hard'.
 */
function difficultyOf(tieCount) {
  if (tieCount <= 4) return 'hard';
  if (tieCount <= 6) return 'medium';
  return 'easy';
}

/**
 * Turn a hand into a puzzle, or reject it. Pure and deterministic — used both by unit tests
 * against a fixed hand, and by `puzzleLibrary.js` to derive each curated puzzle's answer and
 * difficulty from the hand (and curated discard history) it's built around.
 *
 * Rejects (returns `null`) two degenerate cases: a hand that's already complete (nothing to
 * discard toward) and a hand where every distinct tile ties for the same best blended score (any
 * answer would be "correct", which teaches nothing) — the latter is exactly `tieCount` covering
 * every distinct tile in the hand.
 */
export function tryDiscardPuzzle(hand, discards = []) {
  const before = shanten(hand, []);
  if (before < 0) return null;

  const ctx = puzzleContext(hand, discards);
  const player = { hand, melds: [], bonus: [] };
  const rec = bestDiscard(player, ctx);
  const distinctTiles = [...new Set(hand)];
  const tieCount = distinctTiles.filter(
    (tile) => evaluateDiscard(player, tile, ctx).blended === rec.blended,
  ).length;
  if (tieCount === distinctTiles.length) return null;

  return {
    hand,
    shantenBefore: before,
    bestTile: rec.tile,
    shantenAfterBest: rec.shantenAfter,
    value: rec.value,
    blended: rec.blended,
    reasons: rec.reasons,
    tieCount,
    difficulty: difficultyOf(tieCount),
  };
}

/**
 * Check an answer against a puzzle. Mirrors engine.js's own `recordDiscardDecision`: comparing
 * the blended (speed + value) score directly, not membership in `bestDiscard()`'s (UI-oriented,
 * truncated) `alternatives` list, so a multi-way tie is never misjudged as a mistake, and not
 * resulting shanten alone, since `bestDiscard()` can now prefer a marginally slower tile for its
 * value — a tile that only matches speed, or only matches value, isn't actually a match.
 *
 * "Correct" means matching the same blended score `bestDiscard()` recommends, not necessarily the
 * single best mahjong play in some deeper sense: `estimateValue()` past tenpai is a hand-authored
 * heuristic, not a full expected-value simulation — matching the same limit `bestDiscard()` in
 * advisor.js already has.
 */
export function checkDiscardAnswer(puzzle, chosenTile) {
  const rest = [...puzzle.hand];
  const index = rest.indexOf(chosenTile);
  // A tile that isn't actually in the hand isn't a wrong answer to grade — it's not an answer at
  // all. The current UI only ever passes a tile from puzzle.hand, but this is an exported function
  // and indexOf()'s -1 would otherwise silently splice the *last* tile and grade that instead.
  if (index === -1) return { correct: false, shantenAfterChosen: null };

  const ctx = puzzleContext(puzzle.hand, puzzle.discards || []);
  const evaluation = evaluateDiscard({ hand: puzzle.hand, melds: [], bonus: [] }, chosenTile, ctx);
  return { correct: evaluation.blended === puzzle.blended, shantenAfterChosen: evaluation.after };
}
