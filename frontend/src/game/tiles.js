// Tile model for Singapore Mahjong.
//
// Tile ids are short strings so game state stays readable in logs and tests:
//   d1..d9  Dots / Circles (筒)
//   b1..b9  Bamboo (索)
//   c1..c9  Characters (萬)
//   we ws ww wn   Winds  (East, South, West, North)
//   dr dg dw      Dragons (Red 中, Green 發, White 白)
//   f1..f4  Flowers (梅蘭菊竹)
//   s1..s4  Seasons (春夏秋冬)
//   a1..a4  Animals (optional Singapore house rule: cat, mouse, rooster, centipede)

export const SUITS = ['d', 'b', 'c'];
export const WINDS = ['we', 'ws', 'ww', 'wn'];
export const DRAGONS = ['dr', 'dg', 'dw'];
export const FLOWERS = ['f1', 'f2', 'f3', 'f4'];
export const SEASONS = ['s1', 's2', 's3', 's4'];
export const ANIMALS = ['a1', 'a2', 'a3', 'a4'];

// The 34 tiles that appear four times each: 108 suited + 16 wind + 12 dragon = 136.
export const STANDARD_TILES = [
  ...SUITS.flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => s + n)),
  ...WINDS,
  ...DRAGONS,
];

// The rank check matters: dragons (dr/dg/dw) also start with 'd', so a prefix test alone would
// misread them as Dots.
export const isSuited = (t) => SUITS.includes(t[0]) && t.length === 2 && t[1] >= '1' && t[1] <= '9';
export const isWind = (t) => WINDS.includes(t);
export const isDragon = (t) => DRAGONS.includes(t);
export const isHonour = (t) => isWind(t) || isDragon(t);
export const isBonus = (t) => t[0] === 'f' || t[0] === 's' || t[0] === 'a';
export const suitOf = (t) => t[0];
export const rankOf = (t) => Number(t[1]);

/**
 * Build a shuffled wall.
 *
 * 136 standard tiles + 4 Flowers + 4 Seasons = 144. The proposal's Section 5 calls this a
 * "136-tile set ... and 8 bonus tiles", but 136 is already the count without bonus tiles, so the
 * true total is 144. Some Singapore tables add 4 animal tiles for 148 — that is a house rule.
 */
export function buildWall(includeAnimals = false) {
  const wall = [];
  for (const t of STANDARD_TILES) for (let i = 0; i < 4; i++) wall.push(t);
  wall.push(...FLOWERS, ...SEASONS);
  if (includeAnimals) wall.push(...ANIMALS);
  return shuffle(wall);
}

export function shuffle(tiles) {
  const a = [...tiles];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sort order used for the player's hand: suits by rank, then winds, then dragons, then bonus.
const SORT_ORDER = [...STANDARD_TILES, ...FLOWERS, ...SEASONS, ...ANIMALS];
export function sortTiles(tiles) {
  return [...tiles].sort((a, b) => SORT_ORDER.indexOf(a) - SORT_ORDER.indexOf(b));
}

const SUIT_WORDS = { d: 'Dots', b: 'Bamboo', c: 'Characters' };
const NAMES = {
  we: 'East Wind', ws: 'South Wind', ww: 'West Wind', wn: 'North Wind',
  dr: 'Red Dragon', dg: 'Green Dragon', dw: 'White Dragon',
  f1: 'Plum', f2: 'Orchid', f3: 'Chrysanthemum', f4: 'Bamboo Flower',
  s1: 'Spring', s2: 'Summer', s3: 'Autumn', s4: 'Winter',
  a1: 'Cat', a2: 'Mouse', a3: 'Rooster', a4: 'Centipede',
};

/** Spoken / screen-reader name, e.g. "5 Dots" or "Red Dragon". */
export function tileName(t) {
  if (!t) return '';
  if (isSuited(t)) return `${rankOf(t)} ${SUIT_WORDS[suitOf(t)]}`;
  return NAMES[t] || t;
}

const SUIT_MARK = { d: '筒', b: '索', c: '萬' };
const FACES = {
  we: ['東', 'E'], ws: ['南', 'S'], ww: ['西', 'W'], wn: ['北', 'N'],
  dr: ['中', 'RED'], dg: ['發', 'GRN'], dw: ['白', 'WHT'],
  f1: ['梅', 'F1'], f2: ['蘭', 'F2'], f3: ['菊', 'F3'], f4: ['竹', 'F4'],
  s1: ['春', 'S1'], s2: ['夏', 'S2'], s3: ['秋', 'S3'], s4: ['冬', 'S4'],
  a1: ['貓', 'A1'], a2: ['鼠', 'A2'], a3: ['雞', 'A3'], a4: ['蟲', 'A4'],
};

/**
 * How a tile is drawn: a large glyph plus a small label.
 * Every tile is identified by shape and text, never by colour alone, so the faces stay readable
 * for colour-blind players (proposal Section 6, "colour-blind-safe themes").
 */
export function tileFace(t) {
  if (isSuited(t)) return { main: String(rankOf(t)), sub: SUIT_MARK[suitOf(t)], kind: suitOf(t) };
  const [main, sub] = FACES[t] || [t, ''];
  const kind = isWind(t) ? 'wind' : isDragon(t) ? 'dragon' : 'bonus';
  return { main, sub, kind };
}
