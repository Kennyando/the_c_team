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

function Motif({ motif }) {
  switch (motif) {
    case 'blossom': // plum — five round petals
      return (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} r="15"
              cx={50 + 19 * Math.sin((a * Math.PI) / 180)}
              cy={72 - 19 * Math.cos((a * Math.PI) / 180)}
              fill={RED} opacity="0.85" />
          ))}
          <circle cx="50" cy="72" r="7" fill="var(--tile-face)" />
        </g>
      );
    case 'orchid': // long arching grass-like leaves with a small bloom
      return (
        <g>
          <g fill="none" stroke={GREEN} strokeWidth="5" strokeLinecap="round">
            <path d="M50 124 Q18 96 16 38" />
            <path d="M50 124 Q82 98 86 46" />
            <path d="M50 124 Q42 86 30 60" />
            <path d="M50 124 Q60 88 72 66" />
          </g>
          <g fill={RED}>
            <ellipse cx="50" cy="36" rx="7" ry="12" />
            <ellipse cx="40" cy="44" rx="9" ry="5" transform="rotate(-30 40 44)" />
            <ellipse cx="60" cy="44" rx="9" ry="5" transform="rotate(30 60 44)" />
          </g>
        </g>
      );
    case 'chrys': // many narrow petals radiating from a centre
      return (
        <g>
          {Array.from({ length: 12 }, (_, i) => i * 30).map((a) => (
            <ellipse key={a} cx="50" cy="72" rx="6" ry="26" fill={RED} opacity="0.8"
              transform={`rotate(${a} 50 72)`} />
          ))}
          <circle cx="50" cy="72" r="9" fill={GREEN} />
        </g>
      );
    case 'bamboo': // a cane with leaves sprouting from the top
      return (
        <g>
          <Stick x={50} y={92} h={58} w={16} />
          <path d="M46 58 Q22 46 12 54 Q28 68 46 64 Z" fill={GREEN} />
          <path d="M54 58 Q78 46 88 54 Q72 68 54 64 Z" fill={GREEN} />
          <path d="M50 48 Q42 28 50 14 Q60 28 52 48 Z" fill={GREEN} />
        </g>
      );
    case 'sprout': // spring
      return (
        <g>
          <path d="M50 116 L50 60" stroke={GREEN} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M50 76 Q26 70 22 48 Q46 52 50 74 Z" fill={GREEN} />
          <path d="M50 64 Q74 58 78 36 Q54 40 50 62 Z" fill={GREEN} />
        </g>
      );
    case 'sun': // summer
      return (
        <g>
          {Array.from({ length: 8 }, (_, i) => i * 45).map((a) => (
            <rect key={a} x="47" y="16" width="6" height="18" rx="3" fill={RED}
              transform={`rotate(${a} 50 72)`} />
          ))}
          <circle cx="50" cy="72" r="26" fill={RED} />
        </g>
      );
    case 'leaf': // autumn
      return (
        <g>
          <path d="M50 124 Q22 100 24 62 Q36 36 50 22 Q64 36 76 62 Q78 100 50 124 Z" fill={RED} />
          <path d="M50 124 L50 40" stroke="var(--tile-face)" strokeWidth="4" strokeLinecap="round" />
          <g stroke="var(--tile-face)" strokeWidth="3" strokeLinecap="round">
            <path d="M50 62 L32 52" /><path d="M50 62 L68 52" />
            <path d="M50 88 L30 80" /><path d="M50 88 L70 80" />
          </g>
        </g>
      );
    case 'snow': // winter
      return (
        <g stroke={BLUE} strokeWidth="6" strokeLinecap="round">
          {[0, 60, 120].map((a) => (
            <line key={a} x1="24" y1="72" x2="76" y2="72" transform={`rotate(${a} 50 72)`} />
          ))}
          {[0, 60, 120].map((a) => (
            <g key={`t${a}`} transform={`rotate(${a} 50 72)`} strokeWidth="4">
              <line x1="30" y1="72" x2="38" y2="63" />
              <line x1="30" y1="72" x2="38" y2="81" />
              <line x1="70" y1="72" x2="62" y2="63" />
              <line x1="70" y1="72" x2="62" y2="81" />
            </g>
          ))}
        </g>
      );
    default:
      return null;
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
        <text {...CENTRE_TEXT} x="50" y="94" fontSize="76" fill={INK}>{spec.glyph}</text>
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
          <Motif motif={spec.motif} />
          <CornerIndex text={spec.index} />
          <text x="50" y="134" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}
            opacity="0.7" fontFamily="Helvetica Neue, Arial, sans-serif">{spec.label}</text>
        </>
      )}

      {spec.kind === 'animal' && (
        <>
          <text {...CENTRE_TEXT} x="50" y="90" fontSize="60" fill={GREEN}>{spec.glyph}</text>
          <CornerIndex text={spec.index} />
        </>
      )}
    </svg>
  );
}
