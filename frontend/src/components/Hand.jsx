import Tile from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { seatWindOf } from '../game/scoring.js';

const WIND_LABEL = { we: 'East', ws: 'South', ww: 'West', wn: 'North' };

/**
 * The human player's own area: prompt, exposed melds, flowers, and the concealed hand.
 * Tiles are only tappable when it is actually your turn to discard, so there is nothing to get
 * wrong at any other moment.
 */
export default function Hand({ player, dealer, canDiscard, lastDrawn, onSelect, prompt, children }) {
  const wind = WIND_LABEL[seatWindOf(player.seat, dealer)];
  // The hand is sorted, so the tile just drawn can sit anywhere; highlight only its first copy.
  const drawnIndex = canDiscard && lastDrawn ? player.hand.indexOf(lastDrawn) : -1;

  return (
    <section className="hand-area" aria-label="Your hand">
      <div className="hand-header">
        <span className="you">Your hand</span>
        <span className="seat-meta" style={{ color: 'var(--muted)' }}>
          {wind} seat · {player.points >= 0 ? '+' : ''}{player.points} pts
        </span>

        {player.melds.length > 0 && (
          <span className="hand-tiles" aria-label="Your exposed sets">
            {player.melds.map((meld, m) => (
              <span className="meld-group" key={m}>
                {meld.tiles.map((t, i) => <Tile key={i} tile={t} small />)}
              </span>
            ))}
          </span>
        )}

        {player.bonus.length > 0 && (
          <span className="hand-tiles" aria-label={`Your flowers: ${player.bonus.map(tileName).join(', ')}`}>
            {player.bonus.map((t, i) => <Tile key={i} tile={t} small />)}
          </span>
        )}
      </div>

      {children}

      <p className="prompt">{prompt}</p>

      <div className="hand-tiles">
        {player.hand.map((tile, i) => (
          <Tile
            key={`${tile}-${i}`}
            tile={tile}
            onClick={canDiscard ? onSelect : undefined}
            justDrawn={i === drawnIndex}
            dimmed={!canDiscard}
          />
        ))}
      </div>
    </section>
  );
}
