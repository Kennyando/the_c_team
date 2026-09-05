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
// `easy-1`/`medium-1`/`medium-2` were replaced once already: `bestDiscard()` became value-aware
// (weighing a hand's realistic scoring potential alongside raw speed, not speed alone), which
// changed which tile — and therefore which difficulty tier — some of these hands land in. Three
// of the original nine drifted out of their tier under the new calculator; those three were
// swapped for freshly-found hands re-verified against the updated tier thresholds, everything
// else here still holds under the same calculator that changed.
//
// `discards`/`wallCount` are presentation only — a plausible-looking table, not a replayed game —
// so a puzzle looks like a real mid-hand snapshot instead of an isolated list of 14 tiles.

import { tryDiscardPuzzle } from './puzzles.js';

const RAW = {
  easy: [
    {
      id: 'easy-1',
      hand: ['d2', 'd5', 'd6', 'd9', 'b1', 'b3', 'b3', 'b9', 'c1', 'c2', 'c2', 'c7', 'c9', 'dr'],
      discards: [{ tile: 'wn', by: 1 }, { tile: 'dw', by: 2 }, { tile: 'c1', by: 3 }],
      wallCount: 70,
    },
    {
      id: 'easy-2',
      hand: ['d1', 'd8', 'b1', 'b3', 'b5', 'b8', 'c4', 'c7', 'c8', 'c9', 'we', 'wn', 'dg', 'dw'],
      discards: [{ tile: 'ws', by: 1 }, { tile: 'd9', by: 2 }, { tile: 'b1', by: 3 }, { tile: 'dr', by: 1 }],
      wallCount: 68,
    },
    {
      id: 'easy-3',
      hand: ['d1', 'd5', 'd5', 'd6', 'd8', 'd9', 'b1', 'b4', 'b7', 'b9', 'c2', 'wn', 'wn', 'dg'],
      discards: [{ tile: 'ww', by: 1 }, { tile: 'c1', by: 2 }, { tile: 'd1', by: 3 }],
      wallCount: 66,
    },
  ],
  medium: [
    {
      id: 'medium-1',
      hand: ['d2', 'd7', 'd7', 'd8', 'd9', 'b1', 'b1', 'b5', 'b9', 'c3', 'c4', 'c5', 'c9', 'dg'],
      discards: [
        { tile: 'wn', by: 1 }, { tile: 'd1', by: 2 }, { tile: 'c1', by: 3 },
        { tile: 'ws', by: 1 }, { tile: 'b1', by: 2 },
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
      hand: ['d1', 'd1', 'd4', 'd4', 'd7', 'b2', 'b5', 'c1', 'c3', 'c7', 'we', 'we', 'ww', 'dg'],
      discards: [
        { tile: 'ws', by: 1 }, { tile: 'c9', by: 2 }, { tile: 'd9', by: 3 },
        { tile: 'b1', by: 1 }, { tile: 'wn', by: 2 },
      ],
      wallCount: 50,
    },
  ],
  hard: [
    {
      id: 'hard-1',
      hand: ['d1', 'd2', 'd4', 'd5', 'd8', 'd8', 'b7', 'b8', 'b9', 'c8', 'wn', 'dg', 'dg', 'dw'],
      discards: [
        { tile: 'ws', by: 1 }, { tile: 'c1', by: 2 }, { tile: 'd9', by: 3 },
        { tile: 'b1', by: 1 }, { tile: 'wn', by: 2 }, { tile: 'c9', by: 3 },
      ],
      wallCount: 38,
    },
    {
      id: 'hard-2',
      hand: ['d4', 'd5', 'b2', 'b9', 'c2', 'c2', 'c6', 'c8', 'we', 'we', 'ww', 'wn', 'wn', 'dr'],
      discards: [
        { tile: 'd1', by: 1 }, { tile: 'c1', by: 2 }, { tile: 'ws', by: 3 },
        { tile: 'b9', by: 1 }, { tile: 'wn', by: 2 }, { tile: 'd9', by: 3 },
      ],
      wallCount: 36,
    },
    {
      id: 'hard-3',
      hand: ['d5', 'd6', 'b5', 'b5', 'b5', 'b9', 'c1', 'c2', 'c5', 'c8', 'c9', 'ww', 'dw', 'dw'],
      discards: [
        { tile: 'ws', by: 1 }, { tile: 'wn', by: 2 }, { tile: 'b1', by: 3 },
        { tile: 'd9', by: 1 }, { tile: 'c1', by: 2 }, { tile: 'we', by: 3 },
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
