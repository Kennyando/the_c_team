import Tile from './Tile.jsx';
import Seat from './Seat.jsx';
import { wallStacks } from '../game/tableLayout.js';

/**
 * The table, seen from your seat.
 *
 * Everything in here is display-only — no tile in the scene is clickable — which is what makes it
 * safe to tilt. Your own hand is deliberately NOT part of this: it renders flat and full size
 * outside the perspective, so nothing you actually tap is ever foreshortened.
 */
// Which seat's discards pile up on which edge, just inside that seat's own wall.
const DISCARD_SEATS = { far: 2, right: 3, near: 0, left: 1 };

export default function Table({ state }) {
  const ring = wallStacks(state.wall.length);
  const lastIndex = state.discards.length - 1;

  return (
    <div className="scene">
      <div className="surface">
        <div className="felt" aria-hidden="true" />

        {/* The undrawn wall, lying flat so it recedes with the table. */}
        <div className="wall" aria-hidden="true">
          {ring.map(({ edge, stacks }) => (
            <div key={edge} className={`wall-edge wall-edge-${edge}`}>
              {Array.from({ length: stacks }, (_, i) => (
                <span key={i} className="stack" />
              ))}
            </div>
          ))}
        </div>

        <Seat className="seat-far" player={state.players[2]} dealer={state.dealer} active={state.turn === 2} />
        <Seat className="seat-left" player={state.players[1]} dealer={state.dealer} active={state.turn === 1} />
        <Seat className="seat-right" player={state.players[3]} dealer={state.dealer} active={state.turn === 3} />

        {/* Each seat discards into its own tidy grid, just inside its own wall. */}
        <div className="discard-piles" aria-label="Discarded tiles">
          {state.discards.length === 0 && <p className="discards-empty">No tiles discarded yet</p>}
          {Object.entries(DISCARD_SEATS).map(([edge, seat]) => (
            <div key={edge} className={`discard-pile discard-pile-${edge}`}>
              {state.discards
                .map((d, i) => ({ ...d, i }))
                .filter((d) => d.by === seat)
                .map((d) => (
                  <span key={d.i} className={d.i === lastIndex ? 'discard-tile discard-latest' : 'discard-tile'}>
                    <Tile tile={d.tile} small justDrawn={d.i === lastIndex} />
                  </span>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
