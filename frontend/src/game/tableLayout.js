// Where things sit on the table.
//
// Pure functions, no React — the same convention as the rest of src/game/, and it means the
// edge/seat mapping can be checked in tests rather than eyeballed in a browser.

/**
 * Which seat sits at which table edge, seen from your chair: you are always the near edge, and
 * the opponent you face is the far one. The same mapping places a seat's discards just inside
 * its own edge, so the row of backs and the pile below it belong to the same player.
 */
export const EDGE_SEATS = { far: 2, right: 3, near: 0, left: 1 };

/**
 * The face-down tiles laid along each table edge: one back per tile that seat is still holding,
 * so the length of a row is that player's hand size — 13 normally, 14 for whoever is mid-turn,
 * and fewer once they have exposed melds.
 *
 * Returns one entry per edge: `{ edge, seat, tiles }`.
 */
export function handRows(players) {
  return Object.entries(EDGE_SEATS).map(([edge, seat]) => ({
    edge,
    seat,
    tiles: players[seat].hand.length,
  }));
}
