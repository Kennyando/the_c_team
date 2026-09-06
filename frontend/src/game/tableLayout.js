// Where things sit on the table.
//
// Pure functions, no React — the same convention as the rest of src/game/, and it means the
// edge/seat mapping can be checked in tests rather than eyeballed in a browser.

/**
 * Which seat sits at which table edge, seen from your chair: you are always the near edge, and
 * the opponent you face is the far one. Play runs counter-clockwise, so the seat that plays
 * straight after you (seat 1) is on your right and the one before you (seat 3) is on your left —
 * which is also why you may only chow from the seat on your left. The same mapping places a
 * seat's discards just inside its own edge, so its wall of backs and its river below match.
 */
export const EDGE_SEATS = { far: 2, right: 1, near: 0, left: 3 };

/**
 * Where the n-th tile a player has discarded sits in that player's river: a grid six wide that
 * fills left-to-right and wraps downward, the way discards actually lie on a table.
 *
 * `index` is the tile's position within that one player's discards (0 for their first), not its
 * position in the whole game's discard order.
 */
export function discardPosition(index) {
  return {
    row: Math.floor(index / 6),
    column: index % 6,
  };
}
