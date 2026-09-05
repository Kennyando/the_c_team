import { useState } from 'react';

import Tile from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { generateDiscardPuzzle, checkDiscardAnswer } from '../game/puzzles.js';

/**
 * Discard puzzles: a frozen hand with a genuine best discard, checked against the same
 * bestDiscard()/shanten() logic the live coach and the decision log use — so a puzzle's answer
 * can never disagree with what the coach would say about the same hand mid-game.
 */
export default function Puzzle({ onClose }) {
  const [puzzle, setPuzzle] = useState(() => generateDiscardPuzzle());
  const [answer, setAnswer] = useState(null);

  const next = () => {
    setPuzzle(generateDiscardPuzzle());
    setAnswer(null);
  };

  const onSelect = (tile) => {
    if (answer) return; // one answer per puzzle — tapping again does nothing until "New puzzle"
    setAnswer(checkDiscardAnswer(puzzle, tile));
  };

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="Discard puzzle">
      <div className="dialog">
        <h2>Discard puzzle</h2>

        {!puzzle && (
          <p className="hint">Could not put together a puzzle just now — try New puzzle again.</p>
        )}

        {puzzle && (
          <>
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
                    {tileName(puzzle.bestTile)} was the best discard.{puzzle.reasons[0] ? ` ${puzzle.reasons[0]}` : ''}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="row">
          <button type="button" className="primary" onClick={onClose}>Back to the game</button>
          <button type="button" onClick={next}>New puzzle</button>
        </div>
      </div>
    </div>
  );
}
