// Where things sit on the table.
//
// Keep this module limited to layout logic that is consumed by the current UI.
// Add seat/river/hand geometry here only when the corresponding component is
// wired up in the same change and covered by tests.

/**
 * Which seat sits at which table edge, seen from your chair: you are always the near edge, and
 * the opponent you face is the far one. The same mapping places a seat's discards just inside
 * its own edge, so the row of backs and the pile below it belong to the same player.
 */
export const EDGE_SEATS = { far: 2, right: 3, near: 0, left: 1 };

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

    return {
      edge,
      stacks: stacksPerEdge + extraStack,
    };
  });
}
