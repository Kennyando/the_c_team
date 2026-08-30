// Traditional tile artwork, as pure data.
//
// Kept free of JSX so the layouts can be checked in plain Node (see test/tileArt.test.js) — with
// 148 faces, a missing or miscounted one is easy to introduce and hard to spot by eye.
//
// All coordinates live in a 0 0 100 140 viewBox, matching the tile's aspect ratio. The renderer in
// TileFace.jsx scales that to whatever size the accessibility slider is set to.

import { isSuited, suitOf, rankOf, isWind, isDragon } from '../game/tiles.js';

export const VIEWBOX = { w: 100, h: 140 };

/**
 * Dot (筒子) pip positions, following the arrangements on a real set: 1 is a single large ornate
 * circle, 3 runs on a diagonal, 5 is a quincunx, 7 is three slanted above a 2×2, 9 is a 3×3.
 */
export const DOT_LAYOUTS = {
  1: [[50, 70]],
  2: [[50, 44], [50, 96]],
  3: [[28, 36], [50, 70], [72, 104]],
  4: [[33, 48], [67, 48], [33, 92], [67, 92]],
  5: [[30, 44], [70, 44], [50, 70], [30, 96], [70, 96]],
  6: [[32, 38], [68, 38], [32, 70], [68, 70], [32, 102], [68, 102]],
  7: [[28, 26], [50, 42], [72, 58], [33, 90], [67, 90], [33, 118], [67, 118]],
  8: [[33, 26], [67, 26], [33, 55], [67, 55], [33, 85], [67, 85], [33, 114], [67, 114]],
  9: [[26, 36], [50, 36], [74, 36], [26, 70], [50, 70], [74, 70], [26, 104], [50, 104], [74, 104]],
};

/**
 * Bamboo (索子) stick positions, with an optional rotation in degrees.
 * 1 Bamboo is the traditional bird and has no sticks at all. 3 sits one-above-two, 7 is one above
 * two rows of three, and 8 is the classic pair of slanted groups that lean into each other.
 */
export const BAMBOO_LAYOUTS = {
  1: [],
  2: [[50, 42], [50, 98]],
  3: [[50, 34], [33, 98], [67, 98]],
  4: [[33, 44], [67, 44], [33, 96], [67, 96]],
  5: [[30, 40], [70, 40], [50, 70], [30, 100], [70, 100]],
  6: [[26, 44], [50, 44], [74, 44], [26, 98], [50, 98], [74, 98]],
  7: [[50, 26], [26, 74], [50, 74], [74, 74], [26, 114], [50, 114], [74, 114]],
  // The two slanted groups lean into each other. The slant stays gentle and the canes well spread,
  // or at tile size they cross and stop being countable.
  8: [[25, 44, -10], [42, 38, -10], [58, 38, 10], [75, 44, 10],
      [25, 98, 10], [42, 104, 10], [58, 104, -10], [75, 98, -10]],
  9: [[26, 34], [50, 34], [74, 34], [26, 70], [50, 70], [74, 70], [26, 106], [50, 106], [74, 106]],
};

/**
 * Cane [height, width] per rank. Like the dot radii, these shrink as the count grows — at a single
 * fixed size the rows of 8 and 9 Bamboo run into each other and stop reading as separate canes.
 */
export const BAMBOO_SIZES = {
  2: [46, 13], 3: [44, 13], 4: [44, 13], 5: [42, 12],
  6: [46, 12], 7: [34, 11], 8: [36, 10], 9: [30, 11],
};

/**
 * Pip radius shrinks as the count grows, so nine still fit comfortably.
 * Each value must stay under half the closest gap in that rank's layout, or the pips collide —
 * test/tileArt.test.js checks this, since it is not obvious by reading the numbers.
 */
export const DOT_RADII = { 1: 30, 2: 20, 3: 17, 4: 16, 5: 15, 6: 14, 7: 12, 8: 12, 9: 11 };

/** Traditional Chinese numerals for the Characters suit. */
export const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** Winds and the two coloured dragons are character tiles — the word is their traditional face. */
export const HONOUR_GLYPHS = {
  we: '東', ws: '南', ww: '西', wn: '北',
  dr: '中', dg: '發',
};

/**
 * Simple motifs for the bonus tiles.
 * The four Flowers are the traditional plants. The four Seasons are stylised: a real set shows
 * figurative scenes (fisherman, woodcutter, farmer, scholar), which do not survive being drawn at
 * tile size — so they get a seasonal mark plus their number instead.
 */
export const MOTIFS = {
  f1: 'blossom',   // 梅 plum
  f2: 'orchid',    // 蘭
  f3: 'chrys',     // 菊 chrysanthemum
  f4: 'bamboo',    // 竹
  s1: 'sprout',    // 春 spring
  s2: 'sun',       // 夏 summer
  s3: 'leaf',      // 秋 autumn
  s4: 'snow',      // 冬 winter
};

const BONUS_LABEL = { f: 'FLOWER', s: 'SEASON' };

/**
 * Resolve any tile id to a drawing spec. Every one of the 148 ids must land on a branch here —
 * `kind` tells the renderer what to draw, and the rest is its data.
 */
export function faceSpec(tile) {
  if (isSuited(tile)) {
    const suit = suitOf(tile);
    const rank = rankOf(tile);
    if (suit === 'd') return { kind: 'dots', rank, pips: DOT_LAYOUTS[rank], radius: DOT_RADII[rank] };
    if (suit === 'b') {
      const [h, w] = BAMBOO_SIZES[rank] || [0, 0];
      return { kind: 'bamboo', rank, pips: BAMBOO_LAYOUTS[rank], bird: rank === 1, caneH: h, caneW: w };
    }
    return { kind: 'characters', rank, numeral: CHINESE_NUMERALS[rank - 1] };
  }

  if (isWind(tile)) return { kind: 'wind', glyph: HONOUR_GLYPHS[tile] };
  if (isDragon(tile)) {
    // The White Dragon is a blank tile inside a blue double frame, not a written character.
    if (tile === 'dw') return { kind: 'whiteDragon' };
    return { kind: 'dragon', glyph: HONOUR_GLYPHS[tile], colour: tile === 'dr' ? 'red' : 'green' };
  }

  if (tile[0] === 'f' || tile[0] === 's') {
    return {
      kind: 'bonus',
      motif: MOTIFS[tile],
      index: rankOf(tile),
      label: BONUS_LABEL[tile[0]],
    };
  }

  // Animal tiles are an off-by-default house rule; their artwork is figurative, so they keep the
  // character face rather than getting a poor drawing.
  return { kind: 'animal', glyph: { a1: '貓', a2: '鼠', a3: '雞', a4: '蟲' }[tile], index: rankOf(tile) };
}
