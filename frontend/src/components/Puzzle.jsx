import { useState } from 'react';

import Tile from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { generateDiscardPuzzle, checkDiscardAnswer } from '../game/puzzles.js';

const TIERS = ['easy', 'medium', 'hard'];
const TIER_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const ANSWERS_TO_ADVANCE = 3;

/**
 * Discard puzzles: a frozen hand with a genuine best discard, checked against the same
 * bestDiscard()/shanten() logic the live coach and the decision log use — so a puzzle's answer
 * can never disagree with what the coach would say about the same hand mid-game.
 *
 * `progress`/`setProgress` are lifted into App.jsx rather than kept here, since this component
 * unmounts every time the panel closes — progress should only reset on a full page reload, not on
 * every close/reopen.
 */
export default function Puzzle({ progress, setProgress, onClose }) {
  const [puzzle, setPuzzle] = useState(() => generateDiscardPuzzle(progress.tier));
  const [answer, setAnswer] = useState(null);

  const next = () => {
    setPuzzle(generateDiscardPuzzle(progress.tier));
    setAnswer(null);
  };

  const onSelect = (tile) => {
    if (answer) return; // one answer per puzzle — tapping again does nothing until "New puzzle"
    const result = checkDiscardAnswer(puzzle, tile);
    setAnswer(result);
    if (!result.correct) return;

    // A wrong answer never resets or demotes progress — it just doesn't count toward advancing.
    setProgress((p) => {
      const correctInTier = p.correctInTier + 1;
      if (correctInTier < ANSWERS_TO_ADVANCE) return { ...p, correctInTier };
      const nextTier = TIERS[Math.min(TIERS.indexOf(p.tier) + 1, TIERS.length - 1)];
      return { tier: nextTier, correctInTier: 0 };
    });
  };

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="Discard puzzle">
      <div className="dialog">
        <h2>Discard puzzle</h2>
        <p className="hint">
          {TIER_LABELS[progress.tier]} · {progress.correctInTier} / {ANSWERS_TO_ADVANCE} solved
        </p>

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
