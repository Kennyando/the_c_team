// Where things sit on the table.
//
// Pure layout/configuration helpers only — no React and no game-state mutation.
// Components consume this module to render a 4-seat Mahjong table consistently.
//
// Coordinate convention:
//   - The local player sits SOUTH / near.
//   - Opponents sit WEST / left, NORTH / far, EAST / right.
//   - Coordinates are percentages of a fixed 16:9 logical table viewport.
//   - Rotations are clockwise CSS degrees.
//
// The goal is to keep presentation geometry centralized so components do not
// accumulate player-index conditionals or one-off positioning constants.

export const SEATS = Object.freeze({
  SOUTH: "south",
  WEST: "west",
  NORTH: "north",
  EAST: "east",
});

// Backward-compatible wall-edge names used by the existing UI/tests.
export const EDGES = Object.freeze(["far", "right", "near", "left"]);

export const SEAT_ORDER = Object.freeze([
  SEATS.SOUTH,
  SEATS.WEST,
  SEATS.NORTH,
  SEATS.EAST,
]);

export const EDGE_TO_SEAT = Object.freeze({
  far: SEATS.NORTH,
  right: SEATS.EAST,
  near: SEATS.SOUTH,
  left: SEATS.WEST,
});

export const SEAT_TO_EDGE = Object.freeze({
  [SEATS.NORTH]: "far",
  [SEATS.EAST]: "right",
  [SEATS.SOUTH]: "near",
  [SEATS.WEST]: "left",
});

/**
 * Fixed logical viewport.
 *
 * Render the table at this aspect ratio and scale the whole viewport to fit
 * the browser. This keeps the spatial model stable across desktop sizes.
 */
export const VIEWPORT = Object.freeze({
  width: 1600,
  height: 900,
  aspectRatio: 16 / 9,
});

/**
 * Centralized visual sizing tokens.
 *
 * Components may translate these into CSS custom properties. Keeping the
 * numbers here prevents hands, rivers and walls from independently drifting.
 */
export const TABLE_METRICS = Object.freeze({
  tile: Object.freeze({
    handWidth: 58,
    handHeight: 78,
    handGap: 3,
    drawnTileGap: 14,
    selectedLift: 18,
    hoverLift: 8,

    discardWidth: 38,
    discardHeight: 51,
    discardGap: 2,

    wallWidth: 34,
    wallHeight: 46,
    wallGap: 1,
    wallStackOffset: 5,
  }),

  river: Object.freeze({
    columns: 6,
  }),

  coach: Object.freeze({
    width: 330,
  }),
});

/**
 * Shared HUD/UI zones.
 */
export const TABLE_ZONES = Object.freeze({
  centerBoard: Object.freeze({
    x: 50,
    y: 47,
    width: 17,
    height: 18,
    zIndex: 30,
  }),

  coach: Object.freeze({
    x: 73,
    y: 59,
    width: 21,
    maxHeight: 28,
    zIndex: 50,
  }),

  controlsLeft: Object.freeze({
    x: 5,
    y: 58,
    zIndex: 60,
  }),

  controlsRight: Object.freeze({
    x: 95,
    y: 58,
    zIndex: 60,
  }),
});

/**
 * Geometry for each seat.
 *
 * Opponents retain concealed hands as tile backs. This is important both
 * visually and because concealed hand size communicates useful game state.
 */
export const TABLE_LAYOUT = Object.freeze({
  [SEATS.SOUTH]: Object.freeze({
    rotation: 0,
    handRotation: 0,
    discardRotation: 0,
    meldRotation: 0,

    hand: Object.freeze({
      x: 50,
      y: 89,
      maxWidth: 64,
      zIndex: 40,
      faceUp: true,
    }),

    wall: Object.freeze({
      x: 50,
      y: 76,
      maxLength: 38,
      orientation: "horizontal",
    }),

    river: Object.freeze({
      x: 50,
      y: 63,
      width: 22,
      height: 17,
    }),

    melds: Object.freeze({
      x: 72,
      y: 78,
      maxWidth: 22,
    }),

    avatar: Object.freeze({
      x: 28,
      y: 73,
    }),
  }),

  [SEATS.WEST]: Object.freeze({
    rotation: 90,
    handRotation: 90,
    discardRotation: 90,
    meldRotation: 90,

    hand: Object.freeze({
      x: 20,
      y: 43,
      maxWidth: 44,
      zIndex: 20,
      faceUp: false,
    }),

    wall: Object.freeze({
      x: 27,
      y: 43,
      maxLength: 38,
      orientation: "vertical",
    }),

    river: Object.freeze({
      x: 39,
      y: 47,
      width: 17,
      height: 22,
    }),

    melds: Object.freeze({
      x: 29,
      y: 65,
      maxWidth: 18,
    }),

    avatar: Object.freeze({
      x: 13,
      y: 33,
    }),
  }),

  [SEATS.NORTH]: Object.freeze({
    rotation: 180,
    handRotation: 180,
    discardRotation: 180,
    meldRotation: 180,

    hand: Object.freeze({
      x: 53,
      y: 7,
      maxWidth: 64,
      zIndex: 20,
      faceUp: false,
    }),

    wall: Object.freeze({
      x: 53,
      y: 17,
      maxLength: 38,
      orientation: "horizontal",
    }),

    river: Object.freeze({
      x: 50,
      y: 31,
      width: 22,
      height: 17,
    }),

    melds: Object.freeze({
      x: 68,
      y: 22,
      maxWidth: 22,
    }),

    avatar: Object.freeze({
      x: 72,
      y: 10,
    }),
  }),

  [SEATS.EAST]: Object.freeze({
    rotation: 270,
    handRotation: 270,
    discardRotation: 270,
    meldRotation: 270,

    hand: Object.freeze({
      x: 84,
      y: 44,
      maxWidth: 44,
      zIndex: 20,
      faceUp: false,
    }),

    wall: Object.freeze({
      x: 77,
      y: 44,
      maxLength: 38,
      orientation: "vertical",
    }),

    river: Object.freeze({
      x: 61,
      y: 47,
      width: 17,
      height: 22,
    }),

    melds: Object.freeze({
      x: 71,
      y: 28,
      maxWidth: 18,
    }),

    avatar: Object.freeze({
      x: 91,
      y: 34,
    }),
  }),
});

/**
 * Build the visible two-high Mahjong wall.
 *
 * Existing callers using only `{ edge, stacks }` remain compatible.
 */
export function wallStacks(remaining) {
  const safeRemaining = Number.isFinite(remaining)
    ? Math.max(0, Math.floor(remaining))
    : 0;

  // Two tiles per visible wall stack.
  const total = Math.ceil(safeRemaining / 2);

  const each = Math.floor(total / EDGES.length);

  let spare = total - each * EDGES.length;

  return EDGES.map((edge) => {
    const extra = spare > 0 ? 1 : 0;

    spare -= extra;

    const seat = EDGE_TO_SEAT[edge];
    const layout = TABLE_LAYOUT[seat];

    return {
      edge,
      stacks: each + extra,
      seat,
      rotation: layout.rotation,
      orientation: layout.wall.orientation,
    };
  });
}

/**
 * Translate a game player index into a visual seat.
 *
 * Example:
 *
 * localPlayerIndex = 0
 *
 * player 0 -> south
 * player 1 -> west
 * player 2 -> north
 * player 3 -> east
 */
export function seatForPlayer(
  playerIndex,
  localPlayerIndex = 0,
  playerCount = 4
) {
  if (playerCount !== 4) {
    throw new Error(
      "tableLayout currently supports exactly four players"
    );
  }

  if (
    !Number.isInteger(playerIndex) ||
    !Number.isInteger(localPlayerIndex)
  ) {
    throw new TypeError(
      "playerIndex and localPlayerIndex must be integers"
    );
  }

  const relative =
    ((playerIndex - localPlayerIndex) % playerCount + playerCount) %
    playerCount;

  return SEAT_ORDER[relative];
}

/**
 * Reverse lookup:
 *
 * visual seat -> game player index
 */
export function playerForSeat(
  seat,
  localPlayerIndex = 0,
  playerCount = 4
) {
  if (playerCount !== 4) {
    throw new Error(
      "tableLayout currently supports exactly four players"
    );
  }

  const relative = SEAT_ORDER.indexOf(seat);

  if (relative === -1) {
    throw new Error(`Unknown seat: ${seat}`);
  }

  return (localPlayerIndex + relative) % playerCount;
}

/**
 * Get the complete layout configuration for a seat.
 */
export function layoutForSeat(seat) {
  const layout = TABLE_LAYOUT[seat];

  if (!layout) {
    throw new Error(`Unknown seat: ${seat}`);
  }

  return layout;
}

/**
 * Get visual geometry directly from a game player index.
 */
export function layoutForPlayer(
  playerIndex,
  localPlayerIndex = 0
) {
  const seat = seatForPlayer(
    playerIndex,
    localPlayerIndex
  );

  return {
    seat,
    ...TABLE_LAYOUT[seat],
  };
}

/**
 * Convert a percentage anchor into a React-compatible style object.
 *
 * Example:
 *
 * <div style={anchorStyle(TABLE_LAYOUT.south.hand)}>
 */
export function anchorStyle(anchor) {
  if (
    !anchor ||
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y)
  ) {
    throw new TypeError(
      "anchor must contain numeric x and y values"
    );
  }

  return {
    position: "absolute",
    left: `${anchor.x}%`,
    top: `${anchor.y}%`,
    transform: "translate(-50%, -50%)",

    ...(Number.isFinite(anchor.zIndex)
      ? {
          zIndex: anchor.zIndex,
        }
      : {}),
  };
}

/**
 * Deterministic discard-river positioning.
 *
 * Mahjong discard rivers conventionally use six tiles per row.
 *
 * Instead of allowing flex-wrap to decide where tiles go:
 *
 *  1  2  3  4  5  6
 *  7  8  9 10 11 12
 * 13 14 15 16 17 18
 *
 * Rotate the entire river according to its seat rather than rotating
 * individual discard tiles.
 */
export function discardPosition(
  index,
  columns = TABLE_METRICS.river.columns
) {
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError(
      "discard index must be a non-negative integer"
    );
  }

  if (!Number.isInteger(columns) || columns <= 0) {
    throw new TypeError(
      "columns must be a positive integer"
    );
  }

  return {
    row: Math.floor(index / columns),
    column: index % columns,
  };
}

/**
 * Determine spacing for the newly drawn tile.
 *
 * The drawn tile should appear visually separated from the concealed hand:
 *
 * 🀇 🀇 🀈 🀈 🀙 🀚 🀛 🀜 🀐 🀑 🀒 🀓   🀔
 *                                      ^
 *                                  drawn tile
 */
export function handTileOffset(
  index,
  concealedCount,
  hasDrawnTile = false
) {
  const isDrawnTile =
    hasDrawnTile && index === concealedCount;

  return {
    isDrawnTile,

    marginBefore: isDrawnTile
      ? TABLE_METRICS.tile.drawnTileGap
      : 0,
  };
}

/**
 * Get the rotation used for a seat-oriented group.
 */
export function rotationForSeat(seat) {
  return layoutForSeat(seat).rotation;
}

/**
 * Determines whether concealed tile faces should be visible.
 *
 * South/local player:
 *   🀇 🀈 🀉 ...
 *
 * Opponents:
 *   🟧 🟧 🟧 ...
 *
 * Opponent hands should NOT be removed from the table. Their identities
 * remain concealed, but the physical tile backs communicate hand size and
 * reproduce the intended four-sided Mahjong-table composition.
 */
export function shouldShowTileFaces(seat) {
  return layoutForSeat(seat).hand.faceUp;
}
