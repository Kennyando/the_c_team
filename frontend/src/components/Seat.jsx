import Tile from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { seatWindOf } from '../game/scoring.js';

const WIND_LABEL = { we: 'East', ws: 'South', ww: 'West', wn: 'North' };
const WIND_DISPLAY_NUMBER = { we: 1, ws: 2, ww: 3, wn: 4 };

/**
 * One opponent, as a single unit that owns everything belonging to that seat: the name plate,
 * the wall of concealed tiles they are holding, and any exposed sets and flowers. Laid out
 * together and positioned once per edge (see `.seat-far` / `.seat-left` / `.seat-right`), so the
 * three never drift apart or overlap the way three separately-placed pieces used to.
 *
 * The plate is counter-rotated out of the table tilt so its text always faces the reader.
 */
export default function Seat({ player, dealer, active, className }) {
  const windId = seatWindOf(player.seat, dealer);
  const wind = WIND_LABEL[windId];
  const hasOpen = player.melds.length > 0 || player.bonus.length > 0;

  return (
    <section
      className={`seat ${className} ${active ? 'active' : ''}`}
      aria-label={`${player.name}, ${wind} seat`}
    >
      <div className="seat-plate">
        <span className="seat-name">
          {player.name}
          {active && <span className="seat-turn" aria-label="playing now"> ●</span>}
        </span>
        <span className="seat-meta">
          {wind} ({WIND_DISPLAY_NUMBER[windId]}) · {player.points >= 0 ? '+' : ''}{player.points}
        </span>
      </div>

      {/* One back per tile still in hand — 13 normally, 14 mid-turn, fewer once melds are out. */}
      <div className="seat-wall" aria-hidden="true">
        {Array.from({ length: player.hand.length }, (_, i) => (
          <span key={i} className="wall-tile" />
        ))}
      </div>

      {hasOpen && (
        <div className="seat-open">
          {player.melds.map((meld, m) => (
            <span className="seat-meld" key={m} aria-label={`${player.name}'s exposed ${meld.type}`}>
              {meld.tiles.map((t, i) => <Tile key={i} tile={t} small />)}
            </span>
          ))}
          {player.bonus.length > 0 && (
            <span
              className="seat-meld"
              aria-label={`${player.name}'s flowers: ${player.bonus.map(tileName).join(', ')}`}
            >
              {player.bonus.map((t, i) => <Tile key={i} tile={t} small />)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
