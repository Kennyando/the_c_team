import { useEffect, useMemo, useState } from 'react';

import Table from './Table.jsx';
import Tile from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { decisionFacts } from '../game/reviewCore.js';

/**
 * Step through the hand you just played, one decision at a time, with the board put back to how it
 * looked at that moment (from `decision.snapshot`, recorded by the engine). Every discard and call
 * is listed; the misplays are flagged, and "Show the coach's move" reveals what it would have done
 * — hidden by default so you can re-read the position first. Read-only: the Puzzle screen is where
 * you re-pick and get graded.
 *
 * Reuses the live `Table` for the frozen position, the same way `Puzzle.jsx` does.
 */

/** A decision's board snapshot -> the shape `Table` needs (mirrors Puzzle's `toTableState`). */
function toTableState(snap) {
  return {
    wall: Array(snap.wallCount),
    discards: snap.discards,
    dealer: snap.dealer,
    turn: snap.turn,
    players: snap.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      points: p.points,
      // Opponents are stored as a count; `Array.from` (not `Array(n)`) so `Seat` renders the rack.
      hand: Array.isArray(p.hand) ? p.hand : Array.from({ length: p.hand }),
      melds: p.melds,
      bonus: p.bonus,
    })),
  };
}

function moveLabel(decision) {
  if (decision.type === 'discard') return `Discarded ${tileName(decision.chosen)}`;
  if (decision.chosen) return `Called ${decision.chosen.type} on ${tileName(decision.pendingTile)}`;
  return `Passed on ${tileName(decision.pendingTile)}`;
}

/** The caption shown for a miss before you reveal the coach's move — no spoiler of which tile. */
function beforeRevealText(decision) {
  if (decision.type === 'discard') {
    return `You discarded ${tileName(decision.chosen)}. There was a stronger discard — reveal to see which.`;
  }
  const did = decision.chosen ? `called ${decision.chosen.type}` : 'passed';
  return `You ${did} on ${tileName(decision.pendingTile)}. The coach would have played it differently — reveal to see.`;
}

export default function GameReview({ decisions, onExit, onNewHand }) {
  const { facts } = useMemo(() => decisionFacts(decisions), [decisions]);

  const firstMiss = facts.findIndex((f) => !f.wasOptimal);
  const [i, setI] = useState(firstMiss === -1 ? 0 : firstMiss);
  const [reveal, setReveal] = useState(false);
  useEffect(() => setReveal(false), [i]); // each position starts with just your move

  if (facts.length === 0) {
    return (
      <div className="game-review">
        <p>There were no decisions to review this hand.</p>
        <div className="row">
          <button type="button" onClick={onExit}>Back to results</button>
          <button type="button" className="primary" onClick={onNewHand}>Deal a new hand</button>
        </div>
      </div>
    );
  }

  const step = facts[i];
  const decision = decisions[step.index];
  const snap = decision.snapshot;
  const hand = snap?.players?.[0]?.hand ?? [];

  const nextMiss = facts.findIndex((f, idx) => idx > i && !f.wasOptimal);

  const yourIdx = decision.type === 'discard' ? hand.indexOf(decision.chosen) : -1;
  const coachIdx =
    decision.type === 'discard' && decision.recommended !== decision.chosen
      ? hand.indexOf(decision.recommended)
      : -1;

  return (
    <div className="game-review">
      <div className="row">
        <h2>Step through the hand</h2>
        <span className="spacer" />
        <button type="button" onClick={onExit}>Back to results</button>
      </div>

      {snap ? (
        <div className="table view-flat review-board">
          <Table state={toTableState(snap)} />
        </div>
      ) : (
        <p className="hint">The board for this move wasn&apos;t captured.</p>
      )}

      <section className="hand-area" aria-label="Your hand at this point">
        <p className="prompt">
          Move {i + 1} of {facts.length}: {moveLabel(decision)}
          {step.wasOptimal ? ' — matched the coach' : ' — a miss'}
        </p>

        {decision.type === 'discard' && snap && (
          <div className="hand-tiles">
            {hand.map((tile, idx) => {
              const mark = idx === yourIdx ? 'you' : reveal && idx === coachIdx ? 'coach' : null;
              return (
                <span key={idx} className={`review-tile${mark ? ` review-mark ${mark}` : ''}`}>
                  <Tile tile={tile} />
                  {mark && <span className="review-mark-tag">{mark === 'you' ? 'You' : 'Coach'}</span>}
                </span>
              );
            })}
          </div>
        )}

        {decision.type === 'claim' && (
          <div className="hand-tiles">
            <span className="review-tile review-mark you">
              <Tile tile={decision.pendingTile} />
              <span className="review-mark-tag">
                {decision.chosen ? `You called ${decision.chosen.type}` : 'You passed'}
              </span>
            </span>
            {snap &&
              hand.map((tile, idx) => (
                <span key={idx} className="review-tile">
                  <Tile tile={tile} small />
                </span>
              ))}
          </div>
        )}

        <div className="review-caption" aria-live="polite">
          {/* `step.text` names the better move, so on a miss it stays hidden until you ask. */}
          {step.wasOptimal || reveal ? <p>{step.text}</p> : <p>{beforeRevealText(decision)}</p>}
        </div>

        {!reveal && !step.wasOptimal && (
          <button type="button" onClick={() => setReveal(true)}>Show the coach&apos;s move</button>
        )}
      </section>

      <ol className="review-move-list" aria-label="Every decision this hand">
        {facts.map((f, idx) => (
          <li key={f.id}>
            <button
              type="button"
              className={`review-move ${f.wasOptimal ? 'ok' : 'miss'}${idx === i ? ' current' : ''}`}
              aria-current={idx === i ? 'true' : undefined}
              onClick={() => setI(idx)}
            >
              {idx + 1}. {moveLabel(decisions[f.index])} {f.wasOptimal ? '✓' : '✕'}
            </button>
          </li>
        ))}
      </ol>

      <div className="row">
        <button type="button" onClick={() => setI(i - 1)} disabled={i === 0}>Prev</button>
        <button type="button" onClick={() => setI(i + 1)} disabled={i === facts.length - 1}>Next</button>
        <button type="button" onClick={() => setI(nextMiss)} disabled={nextMiss === -1}>
          Next mistake
        </button>
        <span className="spacer" />
        <button type="button" className="primary" onClick={onNewHand}>Deal a new hand</button>
      </div>
    </div>
  );
}
