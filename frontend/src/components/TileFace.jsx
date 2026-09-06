import { faceSpec, VIEWBOX } from './tileArt.js';

// Traditional tile faces, drawn as inline SVG.
//
// Every colour goes through a CSS custom property so the high-contrast theme can flatten the whole
// set to black on white in one place (see styles.css). Shape and pip count always carry the
// meaning; colour is decoration only, which keeps the faces colour-blind-safe.

const INK = 'var(--pip-ink)';
const BLUE = 'var(--pip-blue)';
const RED = 'var(--pip-red)';
const GREEN = 'var(--pip-green)';

/** Dots cycle through the three traditional pip colours by position. */
const dotColour = (i) => [BLUE, RED, GREEN][i % 3];

/** One dot pip: a ring with a solid centre, the way a real tile is painted. */
function Pip({ x, y, r, colour }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--tile-face)" stroke={colour} strokeWidth={r * 0.34} />
      <circle cx={x} cy={y} r={r * 0.32} fill={colour} />
    </g>
  );
}

/** The single large 1 Dot, which on a real set is an ornate concentric medallion. */
function BigPip({ x, y, r }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--tile-face)" stroke={BLUE} strokeWidth={r * 0.16} />
      <circle cx={x} cy={y} r={r * 0.74} fill="var(--tile-face)" stroke={RED} strokeWidth={r * 0.2} />
      <circle cx={x} cy={y} r={r * 0.44} fill={RED} />
      <circle cx={x} cy={y} r={r * 0.16} fill="var(--tile-face)" />
    </g>
  );
}

/**
 * One bamboo cane: a solid stick cut by two thin joints, which is what makes it read as bamboo
 * rather than as a lozenge. The joints are drawn in the tile colour so they work on any background.
 */
function Stick({ x, y, angle = 0, colour = GREEN, h = 40, w = 12 }) {
  const half = h / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x={-w / 2} y={-half} width={w} height={h} rx={w * 0.42} fill={colour} />
      <rect x={-w / 2} y={-half + h * 0.29} width={w} height={Math.max(2, h * 0.07)} fill="var(--tile-face)" />
      <rect x={-w / 2} y={-half + h * 0.64} width={w} height={Math.max(2, h * 0.07)} fill="var(--tile-face)" />
    </g>
  );
}

/** 1 Bamboo is traditionally a bird rather than a cane. */
function Bird() {
  return (
    <g>
      <ellipse cx="50" cy="80" rx="21" ry="27" fill={GREEN} />
      <path d="M50 53 Q40 34 30 22 Q46 30 54 46 Z" fill={GREEN} />
      <circle cx="50" cy="46" r="13" fill={GREEN} />
      <path d="M62 44 L76 40 L62 51 Z" fill={RED} />
      <circle cx="53" cy="43" r="3.4" fill="var(--tile-face)" />
      <circle cx="54" cy="43" r="1.7" fill={INK} />
      <path d="M40 72 Q34 88 44 100 Q50 86 48 74 Z" fill="var(--tile-face)" opacity="0.5" />
      <path d="M50 104 Q44 122 36 130 Q54 124 60 108 Z" fill={RED} />
      <path d="M56 104 Q60 120 68 128 Q60 110 62 102 Z" fill={GREEN} />
    </g>
  );
}

const CENTRE_TEXT = {
  textAnchor: 'middle',
  fontFamily: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Songti SC', serif",
  fontWeight: 700,
};

/** Small top-left index, so nobody has to count nine pips to read a tile. */
function CornerIndex({ text }) {
  return (
    <text x="9" y="21" fontSize="20" fontWeight="800" fill={INK} opacity="0.75"
      fontFamily="Helvetica Neue, Arial, sans-serif">
      {text}
    </text>
  );
}

/** One uniform flower for every bonus tile — red petals for Flowers, blue for Seasons. */
function Flower({ petal }) {
  const colour = petal === 'blue' ? BLUE : RED;
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} r="16"
          cx={50 + 19 * Math.sin((a * Math.PI) / 180)}
          cy={66 - 19 * Math.cos((a * Math.PI) / 180)}
          fill={colour} opacity="0.9" />
      ))}
      <circle cx="50" cy="66" r="7.5" fill="var(--tile-face)" />
      <path d="M50 86 L50 112" stroke={GREEN} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M50 100 Q34 96 30 84 Q46 86 50 98 Z" fill={GREEN} />
      <path d="M50 100 Q66 96 70 84 Q54 86 50 98 Z" fill={GREEN} />
    </g>
  );
}

const CENTIPEDE_SEGMENTS = [
  [36, 34], [46, 42], [54, 52], [58, 64], [58, 78], [54, 90], [48, 101], [40, 110],
];

/** Little figures for the four animal tiles: cat, mouse, rooster, centipede. */
function Animal({ id }) {
  switch (id) {
    case 'a1': // cat, sitting and facing you
      return (
        <g>
          <g fill={INK}>
            <path d="M50 120 Q22 120 22 84 Q22 56 34 46 L66 46 Q78 56 78 84 Q78 120 50 120 Z" />
            <circle cx="50" cy="48" r="22" />
            <path d="M30 36 L24 12 L44 30 Z" />
            <path d="M70 36 L76 12 L56 30 Z" />
            <path d="M76 110 Q98 102 88 70 Q84 92 70 100 Z" />
          </g>
          <g fill="var(--tile-face)">
            <circle cx="42" cy="48" r="4.2" /><circle cx="58" cy="48" r="4.2" />
          </g>
          <g fill={INK}>
            <circle cx="42" cy="48" r="1.9" /><circle cx="58" cy="48" r="1.9" />
            <path d="M50 55 l-4 4 h8 Z" />
          </g>
          <g stroke={INK} strokeWidth="2" strokeLinecap="round">
            <path d="M30 52 L12 48" /><path d="M30 56 L12 58" />
            <path d="M70 52 L88 48" /><path d="M70 56 L88 58" />
          </g>
        </g>
      );
    case 'a2': // mouse, in profile facing right
      return (
        <g>
          <path d="M22 96 Q4 100 6 122 Q14 108 26 104 Z" fill={INK} opacity="0.6" />
          <g fill={INK} opacity="0.68">
            <ellipse cx="42" cy="86" rx="24" ry="18" />
            <path d="M58 86 Q64 62 82 60 Q96 62 98 74 Q96 88 82 92 Q68 96 58 92 Z" />
            <circle cx="66" cy="58" r="13" />
          </g>
          <circle cx="66" cy="58" r="6" fill="var(--tile-face)" opacity="0.5" />
          <circle cx="80" cy="72" r="3" fill="var(--tile-face)" />
          <circle cx="80" cy="72" r="1.6" fill={INK} />
          <circle cx="97" cy="72" r="2.6" fill={RED} />
          <g stroke={INK} strokeWidth="4" strokeLinecap="round" opacity="0.68">
            <path d="M36 104 L34 116" /><path d="M52 104 L54 116" />
          </g>
        </g>
      );
    case 'a3': // rooster, in profile
      return (
        <g>
          <g fill={GREEN}>
            <path d="M32 86 Q8 76 4 46 Q22 62 34 68 Q16 48 20 22 Q36 50 44 66 Z" />
          </g>
          <g fill={RED}>
            <path d="M40 118 Q22 102 30 76 Q38 56 58 54 Q76 58 78 80 Q78 104 64 118 Z" />
            <circle cx="60" cy="46" r="14" />
            <path d="M52 30 q4 -11 9 -5 q3 -11 9 -3 q5 -9 10 1 q-11 5 -20 7 q-5 1 -8 2 Z" />
            <path d="M73 42 L89 40 L74 50 Z" />
            <path d="M65 56 Q70 68 63 72 Q59 62 61 55 Z" />
          </g>
          <circle cx="62" cy="45" r="2.6" fill="var(--tile-face)" />
          <g stroke={RED} strokeWidth="4" strokeLinecap="round">
            <path d="M46 118 L42 132" /><path d="M58 118 L62 132" />
          </g>
        </g>
      );
    default: // a4 — centipede, curving down the tile
      return (
        <g>
          <g stroke={GREEN} strokeWidth="3" strokeLinecap="round">
            {CENTIPEDE_SEGMENTS.map(([x, y], i) => (
              <line key={i} x1={x - 13} y1={y} x2={x + 13} y2={y} />
            ))}
          </g>
          <g fill={GREEN}>
            {CENTIPEDE_SEGMENTS.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i === 0 ? 11 : 8.5} />
            ))}
          </g>
          <g stroke={GREEN} strokeWidth="2.5" strokeLinecap="round">
            <path d="M28 24 L16 12" /><path d="M34 22 L33 8" />
          </g>
          <circle cx="33" cy="31" r="2" fill="var(--tile-face)" />
        </g>
      );
  }
}

/**
 * A tile face. Decorative by design: the surrounding button in Tile.jsx already carries the tile's
 * spoken name, so this is hidden from screen readers.
 */
export default function TileFace({ tile }) {
  const spec = faceSpec(tile);

  return (
    <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} className="tile-face" aria-hidden="true"
      preserveAspectRatio="xMidYMid meet">
      {spec.kind === 'dots' && (
        <>
          {spec.rank === 1
            ? <BigPip x={50} y={70} r={spec.radius} />
            : spec.pips.map(([x, y], i) => (
                <Pip key={i} x={x} y={y} r={spec.radius} colour={dotColour(i)} />
              ))}
          <CornerIndex text={spec.rank} />
        </>
      )}

      {spec.kind === 'bamboo' && (
        <>
          {spec.bird
            ? <Bird />
            : spec.pips.map(([x, y, angle], i) => (
                // The middle cane of 5 and the crown of 7 are painted red on a traditional set.
                <Stick key={i} x={x} y={y} angle={angle} h={spec.caneH} w={spec.caneW}
                  colour={(spec.rank === 5 && i === 2) || (spec.rank === 7 && i === 0) ? RED : GREEN} />
              ))}
          <CornerIndex text={spec.rank} />
        </>
      )}

      {spec.kind === 'characters' && (
        <>
          <text {...CENTRE_TEXT} x="50" y="58" fontSize="48" fill={BLUE}>{spec.numeral}</text>
          <text {...CENTRE_TEXT} x="50" y="118" fontSize="50" fill={RED}>萬</text>
          <CornerIndex text={spec.rank} />
        </>
      )}

      {spec.kind === 'wind' && (
        <text {...CENTRE_TEXT} x="50" y="94" fontSize="76" fill={BLUE}>{spec.glyph}</text>
      )}

      {spec.kind === 'dragon' && (
        <text {...CENTRE_TEXT} x="50" y="94" fontSize="76"
          fill={spec.colour === 'red' ? RED : GREEN}>{spec.glyph}</text>
      )}

      {spec.kind === 'whiteDragon' && (
        <>
          <rect x="16" y="24" width="68" height="92" rx="5" fill="none" stroke={BLUE} strokeWidth="6" />
          <rect x="26" y="34" width="48" height="72" rx="3" fill="none" stroke={BLUE} strokeWidth="3" />
        </>
      )}

      {spec.kind === 'bonus' && (
        <>
          <Flower petal={spec.petal} />
          <CornerIndex text={spec.index} />
          <text x="50" y="134" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}
            opacity="0.7" fontFamily="Helvetica Neue, Arial, sans-serif">{spec.label}</text>
        </>
      )}

      {spec.kind === 'animal' && (
        <>
          <Animal id={spec.animal} />
          <CornerIndex text={spec.index} />
        </>
      )}
    </svg>
  );
}
