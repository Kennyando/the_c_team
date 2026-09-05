import Tile from './Tile.jsx';
import { tileName } from '../game/tiles.js';
import { SEAT_NAMES } from '../game/engine.js';

/**
 * End-of-hand result: the tai breakdown, the limit if it applied, and who paid what.
 * `children` (the post-hand review) render just above the "Deal a new hand" button.
 */
export default function ScoreSheet({ result, players, onNewHand, children }) {
  if (result.drawn) {
    return (
      <div className="backdrop" role="dialog" aria-modal="true" aria-label="Hand drawn">
        <div className="dialog">
          <h2>Wall finished — draw</h2>
          <p>Nobody won this hand and nobody pays. Shall we deal again?</p>
          {children}
          <div className="row">
            <button type="button" className="primary" onClick={onNewHand}>Deal a new hand</button>
          </div>
        </div>
      </div>
    );
  }

  const won = result.winnerSeat === 0;
  const how = result.selfDraw
    ? 'self-drawn from the wall'
    : `on ${SEAT_NAMES[result.fromSeat]}'s discard`;

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="Hand result">
      <div className="dialog">
        <h2>{won ? 'You won! 恭喜' : `${result.winnerName} won`}</h2>
        <p>
          Won with <strong>{tileName(result.winningTile)}</strong>, {how}.
        </p>
        <div className="confirm-tile"><Tile tile={result.winningTile} /></div>

        <table className="score-table">
          <tbody>
            {result.items.length === 0 && (
              <tr><td>Chicken hand (no scoring pattern)</td><td className="tai">0 tai</td></tr>
            )}
            {result.items.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td className="tai">{item.tai} tai</td>
              </tr>
            ))}
          </tbody>
        </table>

        {result.limited && (
          <p className="limit-note">
            Limit hand — {result.rawTai} tai capped at {result.tai}.
          </p>
        )}

        <div className="score-total">
          <span>{result.tai} tai</span>
          <span>{result.points} points each</span>
        </div>

        <table className="score-table">
          <tbody>
            {players.map((p) => (
              <tr key={p.seat}>
                <td>{p.name}</td>
                <td className="tai">
                  {result.payments[p.seat] > 0 ? '+' : ''}{result.payments[p.seat]}
                  <span style={{ fontWeight: 400, color: 'var(--muted)' }}> (total {p.points})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {children}

        <div className="row">
          <button type="button" className="primary" onClick={onNewHand}>Deal a new hand</button>
        </div>
      </div>
    </div>
  );
}
