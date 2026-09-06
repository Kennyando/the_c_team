import Tile from './Tile.jsx';
import Seat from './Seat.jsx';
import { EDGE_SEATS, discardPosition } from '../game/tableLayout.js';

/**
 * The table, seen from your seat.
 *
 * Display-only — nothing in the scene is clickable — which is what makes it safe to tilt. Your
 * own hand is NOT part of this; it renders flat and full size, resting on the near edge.
 */
export default function Table({ state }) {
  const lastIndex = state.discards.length - 1;

  return (
    <div className="scene">
      <div className="surface">
        <div className="felt" aria-hidden="true" />

        <Seat className="seat-far" player={state.players[2]} dealer={state.dealer} active={state.turn === 2} />
        <Seat className="seat-right" player={state.players[1]} dealer={state.dealer} active={state.turn === 1} />
        <Seat className="seat-left" player={state.players[3]} dealer={state.dealer} active={state.turn === 3} />

        {/* Each seat's river: a six-wide grid just inside that seat's own edge. */}
        <div className="discard-piles" aria-label="Discarded tiles">
          {Object.entries(EDGE_SEATS).map(([edge, seat]) => {
            const river = state.discards
              .map((d, i) => ({ ...d, i }))
              .filter((d) => d.by === seat);
            return (
              <div key={edge} className={`discard-river discard-river-${edge}`}>
                {river.map((d, n) => {
                  const { row, column } = discardPosition(n);
                  return (
                    <span
                      key={d.i}
                      className={d.i === lastIndex ? 'discard-tile discard-latest' : 'discard-tile'}
                      style={{ gridColumn: column + 1, gridRow: row + 1 }}
                    >
                      <Tile tile={d.tile} small justDrawn={d.i === lastIndex} />
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
