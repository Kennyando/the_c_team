import { tileName } from '../game/tiles.js';

const LABELS = {
  win: 'WIN 胡',
  kong: 'KONG 槓',
  pong: 'PONG 碰',
  chow: 'CHOW 吃',
  concealedKong: 'KONG 槓',
  addedKong: 'KONG 槓',
};

/**
 * Automatic legal-move highlighting (proposal Section 6): every call the player is entitled to
 * make gets its own large, unmissable button, so nobody has to spot the opportunity themselves.
 */
export default function CallBar({ actions, tile, onChoose, onPass }) {
  if (actions.length === 0) return null;

  const describe = (action) => {
    if (action.type === 'chow') return `Chow with ${action.tiles.map(tileName).join(', ')}`;
    if (action.tile) return `Kong of ${tileName(action.tile)}`;
    return `${LABELS[action.type]} ${tile ? `on ${tileName(tile)}` : ''}`.trim();
  };

  return (
    <div className="callbar" role="group" aria-label="Moves you can make now">
      <span className="label">
        {tile ? `${tileName(tile)} — you can:` : 'You can:'}
      </span>

      {actions.map((action, i) => (
        <button
          key={i}
          type="button"
          className="primary"
          onClick={() => onChoose(action)}
          aria-label={describe(action)}
        >
          {LABELS[action.type]}
          {action.type === 'chow' && (
            <span style={{ fontWeight: 400 }}> {action.tiles.map((t) => t.replace(/^([dbc])(\d)$/, '$2')).join('-')}</span>
          )}
        </button>
      ))}

      {onPass && <button type="button" onClick={onPass}>Pass</button>}
    </div>
  );
}
