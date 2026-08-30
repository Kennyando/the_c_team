import Tile from './Tile.jsx';

/**
 * "Are you sure?" gate before anything irreversible — discarding a tile, or making a call
 * (proposal Section 4, motor control, and Section 6, one-tap call assist).
 */
export default function ConfirmDialog({ title, tile, confirmLabel = 'Yes', onConfirm, onCancel }) {
  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog">
        <h2>{title}</h2>
        {tile && <div className="confirm-tile"><Tile tile={tile} /></div>}
        <div className="row">
          <button type="button" className="primary" onClick={onConfirm} autoFocus>{confirmLabel}</button>
          <button type="button" onClick={onCancel}>No, go back</button>
        </div>
      </div>
    </div>
  );
}
