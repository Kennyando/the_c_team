// Where things sit on the table.
//
// Pure functions, no React — the same convention as the rest of src/game/, and it means the wall
// ring can be checked in tests rather than eyeballed in a browser.

export const EDGES = ['far', 'right', 'near', 'left'];

/**
 * The wall as stacks around the table edge.
 *
 * A real wall is built two tiles high, so `remaining` tiles make up half as many stacks. They are
 * dealt out evenly across the four edges, with any remainder going to the far edge first so the
 * ring stays visually balanced from where the player is sitting.
 *
 * Returns one entry per edge: `{ edge, stacks }`.
 */
export function wallStacks(remaining) {
  const total = Math.max(0, Math.ceil(remaining / 2));
  const each = Math.floor(total / 4);
  let spare = total - each * 4;

  return EDGES.map((edge) => {
    const extra = spare > 0 ? 1 : 0;
    spare -= extra;
    return { edge, stacks: each + extra };
  });
}
