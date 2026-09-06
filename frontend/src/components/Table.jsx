import Tile from './Tile.jsx';
import Seat from './Seat.jsx';
import { handRows, EDGE_SEATS } from '../game/tableLayout.js';

/**
 * The table, seen from your seat.
 *
 * Everything in here is display-only — no tile in the scene is clickable — which is what makes it
 * safe to tilt. Your own hand is deliberately NOT part of this: it renders flat and full size
 * outside the perspective, so nothing you actually tap is ever foreshortened.
 */
export default function Table({ state }) {
  const rows = handRows(state.players);
  const lastIndex = state.discards.length - 1;

  return (
    <div className="scene">
      <div className="surface">
        <div className="felt" aria-hidden="true" />

        {/* Each player's concealed hand, backs up and lying flat so it recedes with the table.
            One back per tile they hold, so a row's length is that player's hand size. */}
        <div className="rack" aria-hidden="true">
          {rows.map(({ edge, tiles }) => (
            <div key={edge} className={`rack-edge rack-edge-${edge}`}>
              {Array.from({ length: tiles }, (_, i) => (
                <span key={i} className="rack-tile" />
              ))}
            </div>
          ))}
        </div>

        <Seat className="seat-far" player={state.players[2]} dealer={state.dealer} active={state.turn === 2} />
        <Seat className="seat-right" player={state.players[1]} dealer={state.dealer} active={state.turn === 1} />
        <Seat className="seat-left" player={state.players[3]} dealer={state.dealer} active={state.turn === 3} />

        {/* Each seat discards into its own tidy grid, just inside its own row of backs. */}
        <div className="discard-piles" aria-label="Discarded tiles">
          {state.discards.length === 0 && <p className="discards-empty">No tiles discarded yet</p>}
          {Object.entries(EDGE_SEATS).map(([edge, seat]) => (
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
