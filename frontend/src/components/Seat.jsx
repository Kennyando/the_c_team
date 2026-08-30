import Tile, { TileBack } from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { seatWindOf } from '../game/scoring.js';

const WIND_LABEL = { we: 'East', ws: 'South', ww: 'West', wn: 'North' };

/**
 * An opponent at their side of the table: a standing rack of face-down tiles, with their exposed
 * sets and flowers laid in front of it.
 *
 * The rack is counter-rotated out of the table's tilt so it stands upright, and the name plate is
 * kept square to the reader — a label lying on the receding surface would be exactly the kind of
 * skewed text this app exists to avoid.
 */
export default function Seat({ player, dealer, active, className }) {
  const wind = WIND_LABEL[seatWindOf(player.seat, dealer)];

  return (
    <section className={`seat ${className} ${active ? 'active' : ''}`} aria-label={`${player.name}, ${wind} seat`}>
      <div className="seat-plate">
        <span className="seat-name">
          {player.name}
          {active && <span className="seat-turn" aria-label="playing now"> ●</span>}
        </span>
        <span className="seat-meta">
          {wind} · {player.points >= 0 ? '+' : ''}{player.points}
        </span>
      </div>

      {/* The concealed hand, standing with its backs to you. */}
      <div className="rack" aria-label={`${player.name} holds ${player.hand.length} tiles`}>
        {player.hand.map((_, i) => <TileBack key={i} />)}
      </div>

      {(player.melds.length > 0 || player.bonus.length > 0) && (
        <div className="seat-open">
          {player.melds.map((meld, m) => (
            <span className="seat-meld" key={m} aria-label={`${player.name}'s exposed ${meld.type}`}>
              {meld.tiles.map((t, i) => <Tile key={i} tile={t} small />)}
            </span>
          ))}
          {player.bonus.length > 0 && (
            <span className="seat-meld" aria-label={`${player.name}'s flowers: ${player.bonus.map(tileName).join(', ')}`}>
              {player.bonus.map((t, i) => <Tile key={i} tile={t} small />)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
