// Artwork coverage. With 148 tile faces specified by hand, a missing or miscounted layout is easy
// to introduce and very hard to spot by eye, so the layouts are checked here rather than in a browser.

import test from 'node:test';
import assert from 'node:assert/strict';

import { STANDARD_TILES, FLOWERS, SEASONS, ANIMALS, rankOf } from '../src/game/tiles.js';
import {
  faceSpec, DOT_LAYOUTS, BAMBOO_LAYOUTS, DOT_RADII, BAMBOO_SIZES, VIEWBOX,
} from '../src/components/tileArt.js';

const ALL_TILES = [...STANDARD_TILES, ...FLOWERS, ...SEASONS, ...ANIMALS];

test('every tile id resolves to a face spec with a known kind', () => {
  const kinds = new Set(['dots', 'bamboo', 'characters', 'wind', 'dragon', 'whiteDragon', 'bonus', 'animal']);
  assert.equal(ALL_TILES.length, 46); // 34 standard + 4 flowers + 4 seasons + 4 animals

  for (const tile of ALL_TILES) {
    const spec = faceSpec(tile);
    assert.ok(spec, `no face spec for ${tile}`);
    assert.ok(kinds.has(spec.kind), `${tile} has unknown kind ${spec.kind}`);
  }
});

test('each suited rank draws exactly that many pips', () => {
  for (let rank = 1; rank <= 9; rank++) {
    const dots = faceSpec(`d${rank}`);
    assert.equal(dots.pips.length, rank, `${rank} Dots should draw ${rank} pips`);

    const bamboo = faceSpec(`b${rank}`);
    // 1 Bamboo is the bird, which is drawn instead of canes rather than alongside them.
    const expected = rank === 1 ? 0 : rank;
    assert.equal(bamboo.pips.length, expected, `${rank} Bamboo should draw ${expected} canes`);
  }
  assert.equal(faceSpec('b1').bird, true);
  assert.equal(faceSpec('b2').bird, false);
});

test('every pip sits inside the tile, allowing for its radius', () => {
  for (let rank = 1; rank <= 9; rank++) {
    const r = DOT_RADII[rank];
    for (const [x, y] of DOT_LAYOUTS[rank]) {
      assert.ok(x - r >= 0 && x + r <= VIEWBOX.w, `${rank} Dots pip at x=${x} overflows`);
      assert.ok(y - r >= 0 && y + r <= VIEWBOX.h, `${rank} Dots pip at y=${y} overflows`);
    }
    if (rank === 1) continue; // the bird is drawn to the tile, not laid out from coordinates
    const [h, w] = BAMBOO_SIZES[rank];
    for (const [x, y, angle = 0] of BAMBOO_LAYOUTS[rank]) {
      // A rotated cane needs its bounding box, not its upright size.
      const rad = (Math.abs(angle) * Math.PI) / 180;
      const halfW = (w * Math.cos(rad) + h * Math.sin(rad)) / 2;
      const halfH = (h * Math.cos(rad) + w * Math.sin(rad)) / 2;
      assert.ok(x - halfW >= 0 && x + halfW <= VIEWBOX.w, `${rank} Bamboo cane at x=${x} overflows`);
      assert.ok(y - halfH >= 0 && y + halfH <= VIEWBOX.h, `${rank} Bamboo cane at y=${y} overflows`);
    }
  }
});

test('bamboo rows are spaced far enough apart for their cane height', () => {
  for (let rank = 2; rank <= 9; rank++) {
    const [h, w] = BAMBOO_SIZES[rank];
    const canes = BAMBOO_LAYOUTS[rank];
    for (let i = 0; i < canes.length; i++) {
      for (let j = i + 1; j < canes.length; j++) {
        const [ax, ay] = canes[i];
        const [bx, by] = canes[j];
        // Canes clear each other if they are apart either vertically or horizontally.
        const clearsVertically = Math.abs(ay - by) >= h;
        const clearsHorizontally = Math.abs(ax - bx) >= w + 2;
        assert.ok(
          clearsVertically || clearsHorizontally,
          `${rank} Bamboo: canes ${i} and ${j} collide (dx ${Math.abs(ax - bx)}, dy ${Math.abs(ay - by)}, cane ${w}x${h})`,
        );
      }
    }
  }
});

test('no two ranks share a layout, so ranks are never confusable', () => {
  for (const layouts of [DOT_LAYOUTS, BAMBOO_LAYOUTS]) {
    const seen = new Map();
    for (const [rank, pips] of Object.entries(layouts)) {
      if (pips.length === 0) continue; // the bird
      const key = JSON.stringify(pips);
      assert.ok(!seen.has(key), `ranks ${seen.get(key)} and ${rank} draw identically`);
      seen.set(key, rank);
    }
  }
});

test('pips within a rank never sit on top of each other', () => {
  for (let rank = 1; rank <= 9; rank++) {
    const positions = DOT_LAYOUTS[rank];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const [ax, ay] = positions[i];
        const [bx, by] = positions[j];
        const gap = Math.hypot(ax - bx, ay - by);
        assert.ok(gap >= DOT_RADII[rank] * 2, `${rank} Dots: pips ${i} and ${j} overlap (gap ${gap.toFixed(1)})`);
      }
    }
  }
});

test('the Characters suit uses traditional Chinese numerals', () => {
  const expected = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  for (let rank = 1; rank <= 9; rank++) {
    assert.equal(faceSpec(`c${rank}`).numeral, expected[rank - 1]);
  }
});

test('honour tiles keep their characters, and the White Dragon is a blank frame', () => {
  assert.equal(faceSpec('we').glyph, '東');
  assert.equal(faceSpec('wn').glyph, '北');
  assert.equal(faceSpec('dr').glyph, '中');
  assert.equal(faceSpec('dg').glyph, '發');
  assert.equal(faceSpec('dw').kind, 'whiteDragon'); // drawn, not written
});

test('every flower and season has its own motif and index', () => {
  const motifs = new Set();
  for (const tile of [...FLOWERS, ...SEASONS]) {
    const spec = faceSpec(tile);
    assert.equal(spec.kind, 'bonus');
    assert.ok(spec.motif, `${tile} has no motif`);
    assert.ok(!motifs.has(spec.motif), `${spec.motif} is used twice`);
    motifs.add(spec.motif);
    assert.equal(spec.index, rankOf(tile));
  }
  assert.equal(faceSpec('f1').label, 'FLOWER');
  assert.equal(faceSpec('s1').label, 'SEASON');
});
