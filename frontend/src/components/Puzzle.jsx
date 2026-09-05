import { useState } from 'react';

import Table from './Table.jsx';
import Tile from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { SEAT_NAMES } from '../game/engine.js';
import { checkDiscardAnswer } from '../game/puzzles.js';
import { PUZZLE_LIBRARY } from '../game/puzzleLibrary.js';

const TIERS = ['easy', 'medium', 'hard'];
const TIER_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * Build a Table-shaped snapshot from a curated puzzle: the human's real hand, the puzzle's curated
 * discards, and 3 face-down opponent racks — a mid-game look, not a bare list of 14 tiles.
 * Opponents' hand sizes are a plausible placeholder; `Table`/`Seat` only ever read an opponent's
 * `hand.length` (the rack is always drawn face down, never the actual tiles), so this needs no
 * real deal behind it.
 */
function toTableState(puzzle) {
  const opponent = (seat) => ({ seat, name: SEAT_NAMES[seat], points: 0, hand: Array(13), melds: [], bonus: [] });
  return {
    wall: Array(puzzle.wallCount),
    discards: puzzle.discards,
    dealer: 0,
    turn: 0,
    players: [
      { seat: 0, name: SEAT_NAMES[0], points: 0, hand: puzzle.hand, melds: [], bonus: [] },
      opponent(1),
      opponent(2),
      opponent(3),
    ],
  };
}

/**
 * A curated library of discard puzzles: pick a tier, pick a numbered puzzle, solve it — a fixed
 * set (chess.com-style), not an endless random generator. Each puzzle is shown as a full table
 * (opponents, a discard pool) via the same `Table` component the live game uses, so it reads as a
 * real mid-hand snapshot rather than an isolated hand. Checked against the same
 * `bestDiscard()`/`shanten()` logic the live coach and the decision log use, so a puzzle's answer
 * can never disagree with what the coach would say about the same hand mid-game.
 */
export default function Puzzle() {
  const [tier, setTier] = useState('easy');
  const [puzzle, setPuzzle] = useState(null);
  const [answer, setAnswer] = useState(null);

  const open = (p) => {
    setPuzzle(p);
    setAnswer(null);
  };

  const backToPicker = () => {
    setPuzzle(null);
    setAnswer(null);
  };

  const onSelect = (tile) => {
    if (answer) return; // one answer per puzzle
    setAnswer(checkDiscardAnswer(puzzle, tile));
  };

  if (!puzzle) {
    return (
      <div className="puzzle-screen">
        <h2>Discard puzzles</h2>
        <p className="hint">Pick a difficulty, then a puzzle.</p>

        <div className="tier-tabs" role="tablist" aria-label="Difficulty">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === tier}
              className={t === tier ? 'primary' : ''}
              onClick={() => setTier(t)}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="puzzle-grid">
          {PUZZLE_LIBRARY[tier].map((p, i) => (
            <button key={p.id} type="button" onClick={() => open(p)}>
              Puzzle {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="puzzle-screen">
      <div className="row">
        <h2>{TIER_LABELS[tier]} puzzle</h2>
        <span className="spacer" />
        <button type="button" onClick={backToPicker}>Choose another puzzle</button>
      </div>

      <div className="table view-seated">
        <Table state={toTableState(puzzle)} />
      </div>

      <section className="hand-area" aria-label="Your hand">
        <p className="prompt">Which tile would you discard?</p>
        <div className="hand-tiles">
          {puzzle.hand.map((tile, i) => (
            <Tile
              key={`${tile}-${i}`}
              tile={tile}
              onClick={answer ? undefined : onSelect}
              dimmed={!!answer}
            />
          ))}
        </div>

        {answer && (
          <div className="setting" aria-live="polite">
            <p><strong>{answer.correct ? 'Correct!' : 'Not quite.'}</strong></p>
            {!answer.correct && (
              <p className="hint">
                {tileName(puzzle.bestTile)} keeps you closest to winning.{puzzle.reasons[0] ? ` ${puzzle.reasons[0]}` : ''}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
