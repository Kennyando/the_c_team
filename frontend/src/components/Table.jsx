import Tile from './Tile.jsx';
import Seat from './Seat.jsx';
import { wallStacks, spread } from '../game/tableLayout.js';

/**
 * The table, seen from your seat.
 *
 * Everything in here is display-only — no tile in the scene is clickable — which is what makes it
 * safe to tilt. Your own hand is deliberately NOT part of this: it renders flat and full size
 * outside the perspective, so nothing you actually tap is ever foreshortened.
 */
export default function Table({ state }) {
  const ring = wallStacks(state.wall.length);
  const lastIndex = state.discards.length - 1;

  return (
    <div className="scene">
      <div className="surface">
        <div className="felt" aria-hidden="true" />

        {/* The undrawn wall, lying flat so it recedes with the table. */}
        <div className="wall" aria-hidden="true">
          {ring.map(({ edge, stacks }) =>
            spread(stacks).map((position, i) => (
              <span key={`${edge}-${i}`} className={`stack stack-${edge}`} style={{ '--at': `${position}%` }} />
            )),
          )}
        </div>

        <Seat className="seat-far" player={state.players[2]} dealer={state.dealer} active={state.turn === 2} />
        <Seat className="seat-left" player={state.players[1]} dealer={state.dealer} active={state.turn === 1} />
        <Seat className="seat-right" player={state.players[3]} dealer={state.dealer} active={state.turn === 3} />

        {/* Discards pool loose in the middle, as they do on a real table. */}
        <section className="pool" aria-label="Discarded tiles">
          {state.discards.length === 0 && <p className="pool-empty">No tiles discarded yet</p>}
          {state.discards.map((discard, i) => (
            <span key={i} className={i === lastIndex ? 'pool-tile pool-latest' : 'pool-tile'}>
              <Tile tile={discard.tile} small={i !== lastIndex} justDrawn={i === lastIndex} />
            </span>
          ))}
        </section>
      </div>
    </div>
  );
}
