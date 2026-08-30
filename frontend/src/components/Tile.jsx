import { createContext, useContext } from 'react';
import { tileFace, tileName } from '../game/tiles.js';
import TileFace from './TileFace.jsx';

/**
 * Which tile artwork to draw: 'traditional' (drawn pips, as on a real set) or 'numerals' (one large
 * number per tile, which some players with heavy vision loss find easier).
 *
 * Carried by context rather than a prop because Tile is rendered from six different places — this
 * way the setting reaches all of them without threading an argument through every component.
 */
export const TileStyleContext = createContext('traditional');
export const TileStyleProvider = TileStyleContext.Provider;

/**
 * One tile. Rendered as a button when it can be tapped, so it is keyboard-reachable and announces
 * itself to a screen reader by its spoken name ("5 Dots") rather than its internal id.
 */
export default function Tile({ tile, onClick, small = false, justDrawn = false, dimmed = false }) {
  const style = useContext(TileStyleContext);
  const { main, sub, kind } = tileFace(tile);

  const className = [
    'tile',
    `k-${kind}`,
    small ? 'small' : '',
    onClick ? 'selectable' : '',
    justDrawn ? 'just-drawn' : '',
    dimmed ? 'dimmed' : '',
  ].filter(Boolean).join(' ');

  const content = style === 'traditional' ? <TileFace tile={tile} /> : (
    <>
      <span className="main" aria-hidden="true">{main}</span>
      <span className="sub" aria-hidden="true">{sub}</span>
    </>
  );

  if (!onClick) {
    return <span className={className} role="img" aria-label={tileName(tile)}>{content}</span>;
  }
  return (
    <button type="button" className={className} onClick={() => onClick(tile)} aria-label={tileName(tile)}>
      {content}
    </button>
  );
}

/** A face-down tile in an opponent's hand. */
export function TileBack() {
  return <span className="tile-back" aria-hidden="true" />;
}
