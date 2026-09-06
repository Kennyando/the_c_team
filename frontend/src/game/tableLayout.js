// Where things sit on the table.
//
// Keep this module limited to layout logic that is consumed by the current UI.
// Add seat/river/hand geometry here only when the corresponding component is
// wired up in the same change and covered by tests.

export const EDGES = ['far', 'right', 'near', 'left'];

/**
 * Split the remaining wall into two-tile-high stacks across the four edges.
 *
 * A visual stack represents up to two wall tiles, so the number of stacks is
 * ceil(remaining / 2). Stacks are distributed evenly around the table. Any
 * remainder is assigned in EDGES order (far, right, near, left), preserving
 * the existing behaviour and keeping the ring balanced.
 *
 * Invalid, negative, and non-finite values are treated as an empty wall. This
 * keeps the render path defensive rather than throwing during state changes.
 *
 * @param {number} remaining number of tiles remaining in the wall
 * @returns {{ edge: string, stacks: number }[]}
 */
export function wallStacks(remaining) {
  const safeRemaining = Number.isFinite(remaining)
    ? Math.max(0, Math.floor(remaining))
    : 0;

  const totalStacks = Math.ceil(safeRemaining / 2);
  const stacksPerEdge = Math.floor(totalStacks / EDGES.length);
  let remainder = totalStacks % EDGES.length;

  return EDGES.map((edge) => {
    const extraStack = remainder > 0 ? 1 : 0;

    if (remainder > 0) {
      remainder -= 1;
    }

  export function TileBack({ small = false }) {
    return (
      <span
        className={`tile-back${small ? ' tile-back-small' : ''}`}
        aria-hidden="true"
      />
    );
}

    return {
      edge,
      stacks: stacksPerEdge + extraStack,
    };
  });
}
