/**
 * Tile encoding used throughout the advisor: 34 tile "kinds", index 0-33.
 *   0-8   : Characters  1-9   (m1..m9)
 *   9-17  : Dots        1-9   (p1..p9)
 *   18-26 : Bamboo      1-9   (s1..s9)
 *   27-30 : Winds       East, South, West, North
 *   31-33 : Dragons     Red, Green, White
 *
 * Flower/season (bonus) tiles are handled separately at the game-state
 * level (proposal section 5) — they don't affect shanten/tenpai, only
 * bonus scoring, so the advisor ignores them entirely.
 */
export const TILE_COUNT = 34;

const SUIT_NAMES: Record<string, number> = {
  character: 0, characters: 0, man: 0, wan: 0,
  dot: 9, dots: 9, circle: 9, circles: 9,
  bamboo: 18, bam: 18, sou: 18, stick: 18, sticks: 18,
};

const HONOR_NAMES: Record<string, number> = {
  east: 27, south: 28, west: 29, north: 30,
  "red-dragon": 31, red: 31,
  "green-dragon": 32, green: 32,
  "white-dragon": 33, white: 33, blank: 33,
};

/** Parses "5-dot", "red-dragon", "east" etc into a 0-33 tile index. */
export function parseTile(label: string): number {
  const s = label.trim().toLowerCase();
  if (s in HONOR_NAMES) return HONOR_NAMES[s];

  const match = s.match(/^(\d)[\s-]?(\w+)$/);
  if (match) {
    const [, numStr, suitWord] = match;
    const base = SUIT_NAMES[suitWord];
    if (base !== undefined) return base + (parseInt(numStr, 10) - 1);
  }
  throw new Error(`Unrecognised tile label: "${label}"`);
}

const SUIT_LABELS = ["character", "dot", "bamboo"];
const HONOR_LABELS = ["east", "south", "west", "north", "red-dragon", "green-dragon", "white-dragon"];

/** Inverse of parseTile — used to build narration text and API responses. */
export function tileLabel(index: number): string {
  if (index < 27) {
    const suit = SUIT_LABELS[Math.floor(index / 9)];
    const num = (index % 9) + 1;
    return `${num}-${suit}`;
  }
  return HONOR_LABELS[index - 27];
}

/** Turns a list of tile labels into the 34-length count array the shanten engine uses. */
export function handToCounts(hand: string[]): number[] {
  const counts = new Array(TILE_COUNT).fill(0);
  for (const label of hand) counts[parseTile(label)]++;
  return counts;
}
