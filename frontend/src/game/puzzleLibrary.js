// Curated discard puzzles: 3 hand-picked positions per difficulty tier, replacing the
// endless-random-hand mode this repo shipped in PR #6 with a fixed, browsable library — pick a
// tier, pick a numbered puzzle, solve it, like a chess puzzle set.
//
// Each entry below only carries `hand`/`discards`/`wallCount` (the frozen position and its table
// dressing). `bestTile`/`shantenAfterBest`/`reasons`/`difficulty` are derived by
// `tryDiscardPuzzle()` at load time below, not typed by hand — there is exactly one source of
// truth for what counts as correct and how hard a puzzle is, the same calculator the live coach
// and the decision log already use. Every hand here was pulled from that calculator's own output
// (via a throwaway random-hand search script) rather than invented, then hand-picked for this
// library and frozen.
//
// `easy-1`/`medium-1`/`medium-2` were replaced once already when `bestDiscard()` became
// value-aware, and 8 of these 9 were replaced again when it gained real ukeire on top of that:
// weighing genuine tile-acceptance counts differentiates almost every non-symmetric discard, so
// exact ties (this library's whole difficulty metric) collapsed hard, and the tier thresholds in
// `puzzles.js` were recalibrated a third time to match. Only `medium-2` happened to still land in
// its original tier under the new calculator and was kept unchanged; the other 8 were swapped for
// freshly-found hands re-verified against the current thresholds.
//
// `discards`/`wallCount` are presentation only — a plausible-looking table, not a replayed game —
// so a puzzle looks like a real mid-hand snapshot instead of an isolated list of 14 tiles.

import { tryDiscardPuzzle } from './puzzles.js';

const RAW = {
  easy: [
    {
      id: 'easy-1',
      hand: ['d5', 'd9', 'b2', 'b3', 'b4', 'c2', 'c3', 'c4', 'c4', 'c6', 'wn', 'dg', 'dg', 'dg'],
      discards: [{ tile: 'ws', by: 1 }, { tile: 'dw', by: 2 }, { tile: 'd1', by: 3 }],
      wallCount: 70,
    },
    {
      id: 'easy-2',
      hand: ['d4', 'd9', 'd9', 'd9', 'b6', 'b8', 'b8', 'c4', 'c7', 'c8', 'ws', 'ww', 'wn', 'dw'],
      discards: [{ tile: 'we', by: 1 }, { tile: 'c1', by: 2 }, { tile: 'b1', by: 3 }, { tile: 'dr', by: 1 }],
      wallCount: 68,
    },
    {
      id: 'easy-3',
      hand: ['d1', 'd2', 'd4', 'd7', 'b4', 'b5', 'b7', 'b9', 'c1', 'c2', 'c5', 'c7', 'c8', 'dg'],
      discards: [{ tile: 'ww', by: 1 }, { tile: 'wn', by: 2 }, { tile: 'd9', by: 3 }],
      wallCount: 66,
    },
  ],
  medium: [
    {
      id: 'medium-1',
      hand: ['d3', 'd5', 'd7', 'd8', 'b1', 'b2', 'b7', 'b7', 'c2', 'c8', 'c9', 'we', 'wn', 'dr'],
      discards: [
        { tile: 'ws', by: 1 }, { tile: 'd1', by: 2 }, { tile: 'c1', by: 3 },
        { tile: 'b9', by: 1 }, { tile: 'd9', by: 2 },
      ],
      wallCount: 54,
    },
    {
      id: 'medium-2',
      hand: ['d5', 'd6', 'd6', 'b3', 'b4', 'b8', 'c1', 'c1', 'c6', 'c6', 'c7', 'c8', 'ww', 'wn'],
      discards: [{ tile: 'ww', by: 1 }, { tile: 'd9', by: 2 }, { tile: 'c1', by: 3 }, { tile: 'wn', by: 1 }],
      wallCount: 52,
    },
    {
      id: 'medium-3',
      hand: ['d1', 'd3', 'd5', 'd7', 'd9', 'd9', 'b2', 'b4', 'b7', 'b8', 'c2', 'c5', 'c7', 'c8'],
      discards: [
        { tile: 'we', by: 1 }, { tile: 'c9', by: 2 }, { tile: 'ws', by: 3 },
        { tile: 'b1', by: 1 }, { tile: 'wn', by: 2 },
      ],
      wallCount: 50,
    },
  ],
  hard: [
    {
      id: 'hard-1',
      hand: ['d2', 'd3', 'd3', 'd7', 'b2', 'b3', 'b5', 'c2', 'c4', 'c6', 'c8', 'c9', 'ww', 'dr'],
      discards: [
        { tile: 'ws', by: 1 }, { tile: 'c1', by: 2 }, { tile: 'd9', by: 3 },
        { tile: 'b1', by: 1 }, { tile: 'wn', by: 2 }, { tile: 'c7', by: 3 },
      ],
      wallCount: 38,
    },
    {
      id: 'hard-2',
      hand: ['d5', 'd9', 'd9', 'b5', 'b8', 'b8', 'c1', 'c5', 'c6', 'c9', 'ws', 'ww', 'ww', 'dg'],
      discards: [
        { tile: 'd1', by: 1 }, { tile: 'c2', by: 2 }, { tile: 'we', by: 3 },
        { tile: 'b1', by: 1 }, { tile: 'wn', by: 2 }, { tile: 'd8', by: 3 },
      ],
      wallCount: 36,
    },
    {
      id: 'hard-3',
      hand: ['d3', 'd4', 'd7', 'd9', 'b2', 'b3', 'b3', 'c1', 'c2', 'c5', 'c8', 'c9', 'ws', 'ws'],
      discards: [
        { tile: 'we', by: 1 }, { tile: 'wn', by: 2 }, { tile: 'b1', by: 3 },
        { tile: 'd1', by: 1 }, { tile: 'c4', by: 2 }, { tile: 'ww', by: 3 },
      ],
      wallCount: 34,
    },
  ],
};

/**
 * { easy: [...], medium: [...], hard: [...] }, each entry the raw fields above plus
 * bestTile/shantenBefore/shantenAfterBest/reasons/difficulty from tryDiscardPuzzle().
 *
 * Throws at import time (not silently, not at click time) if an entry turns out to be a
 * degenerate hand or filed under the wrong tier — an authoring mistake here should fail loudly
 * long before a player ever sees it.
 */
export const PUZZLE_LIBRARY = Object.fromEntries(
  Object.entries(RAW).map(([tier, entries]) => [
    tier,
    entries.map((entry) => {
      const derived = tryDiscardPuzzle(entry.hand, entry.discards);
      if (!derived) {
        throw new Error(`puzzleLibrary: "${entry.id}" is a degenerate hand (already complete, or every discard ties)`);
      }
      if (derived.difficulty !== tier) {
        throw new Error(`puzzleLibrary: "${entry.id}" is actually '${derived.difficulty}', but is filed under '${tier}'`);
      }
      return { ...entry, ...derived };
    }),
  ]),
);
