import Tile from './Tile.jsx';

/**
 * Every discard so far, one row per player in turn order (you first), tiles flat and full-size in
 * the order they were thrown. The felt shows the same tiles in place, but foreshortened and split
 * four ways; this is the plain readable version for "wait, who threw the third bamboo?".
 */
export default function DiscardLog({ discards, players, onClose }) {
  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="All discarded tiles">
      <div className="dialog">
        <h2>Discarded tiles</h2>

        {players.map((p) => {
          const theirs = discards.filter((d) => d.by === p.seat);
          return (
            <div className="discard-log-row" key={p.seat}>
              <span className="discard-log-name">
                {p.name}
                <span className="discard-log-count"> · {theirs.length}</span>
              </span>
              <div className="discard-log-tiles">
                {theirs.length === 0
                  ? <span className="hint">Nothing yet</span>
                  : theirs.map((d, i) => <Tile key={i} tile={d.tile} small />)}
              </div>
            </div>
          );
        })}

        <div className="row">
          <button type="button" className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
