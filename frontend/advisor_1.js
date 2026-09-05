// advisor.js
//
// Position analysis for the help coach.
//
// Strategy objective:
//   1. Win quickly
//   2. Preserve realistic tai potential
//   3. Prefer hands with many live improving tiles
//   4. Avoid speculative high-tai paths with poor completion odds
//
// Pure functions over game state — no React.

import {
  STANDARD_TILES,
  isSuited,
  isHonour,
  suitOf,
  rankOf,
  tileName,
} from './tiles.js';

import {
  toCounts,
  isWinningHand,
} from './melds.js';

import {
  scoreHand,
  seatWindOf,
  DEFAULT_STRATEGY_WEIGHTS,
} from './scoring.js';

import { keepValue } from './bots.js';


/* ============================================================
 * SHANTEN
 * ============================================================ */

/**
 * How many useful tiles away from winning the hand is.
 *
 * -1 = complete
 *  0 = ready
 *  1+ = progressively further away
 */
export function shanten(concealed, melds = []) {
  const counts = toCounts(concealed);
  const fixed = melds.length;

  let best = 8;

  const walk = (index, sets, partials, hasPair) => {
    const blocks = fixed + sets + partials;

    const value =
      8 -
      2 * (fixed + sets) -
      partials +
      (blocks === 5 && !hasPair ? 1 : 0);

    if (value < best) best = value;

    if (index >= STANDARD_TILES.length) return;

    const tile = STANDARD_TILES[index];

    if (!counts[tile]) {
      walk(index + 1, sets, partials, hasPair);
      return;
    }

    const used = sets + fixed + partials;


    // --------------------------------------------------------
    // Complete triplet
    // --------------------------------------------------------

    if (counts[tile] >= 3 && used < 5) {
      counts[tile] -= 3;

      walk(index, sets + 1, partials, hasPair);

      counts[tile] += 3;
    }


    // --------------------------------------------------------
    // Complete run
    // --------------------------------------------------------

    if (isSuited(tile) && used < 5) {
      const suit = suitOf(tile);
      const rank = rankOf(tile);

      if (
        rank <= 7 &&
        counts[suit + (rank + 1)] &&
        counts[suit + (rank + 2)]
      ) {
        counts[tile]--;
        counts[suit + (rank + 1)]--;
        counts[suit + (rank + 2)]--;

        walk(index, sets + 1, partials, hasPair);

        counts[tile]++;
        counts[suit + (rank + 1)]++;
        counts[suit + (rank + 2)]++;
      }
    }


    // --------------------------------------------------------
    // Pair
    // --------------------------------------------------------

    if (counts[tile] >= 2 && used < 5) {
      counts[tile] -= 2;

      walk(index, sets, partials + 1, true);

      counts[tile] += 2;
    }


    // --------------------------------------------------------
    // Partial run
    // --------------------------------------------------------

    if (isSuited(tile) && used < 5) {
      const suit = suitOf(tile);
      const rank = rankOf(tile);

      for (const gap of [1, 2]) {
        const other = suit + (rank + gap);

        if (
          rank + gap <= 9 &&
          counts[other]
        ) {
          counts[tile]--;
          counts[other]--;

          walk(index, sets, partials + 1, hasPair);

          counts[tile]++;
          counts[other]++;
        }
      }
    }


    // Ignore this tile and continue.
    walk(index + 1, sets, partials, hasPair);
  };


  walk(0, 0, 0, false);

  return best;
}


/* ============================================================
 * WAITS
 * ============================================================ */

/**
 * Tiles that complete the hand immediately.
 */
export function waits(player) {
  const found = [];

  for (const tile of STANDARD_TILES) {
    if (
      isWinningHand(
        [...player.hand, tile],
        player.melds
      )
    ) {
      found.push(tile);
    }
  }

  return found;
}


/* ============================================================
 * VISIBLE TILE TRACKING
 * ============================================================ */

/**
 * Count tiles that are already known to be unavailable.
 *
 * IMPORTANT:
 * Adapt `state.discards` if your engine stores discards under a
 * different property.
 */
export function visibleTileCounts(state, player) {
  const counts = Object.fromEntries(
    STANDARD_TILES.map((tile) => [tile, 0])
  );


  const add = (tile) => {
    if (tile in counts) {
      counts[tile]++;
    }
  };


  // Own concealed hand is known.
  for (const tile of player.hand ?? []) {
    add(tile);
  }


  // Every player's exposed melds are known.
  for (const p of state.players ?? []) {
    for (const meld of p.melds ?? []) {
      for (const tile of meld.tiles ?? []) {
        add(tile);
      }
    }
  }


  // Handle either:
  //
  // state.discards = [...]
  //
  // or
  //
  // state.discards = [[...], [...], ...]
  //
  if (Array.isArray(state.discards)) {
    for (const entry of state.discards) {
      if (Array.isArray(entry)) {
        for (const tile of entry) add(tile);
      } else {
        add(entry);
      }
    }
  }


  return counts;
}


/**
 * Number of copies of a tile that can theoretically still be drawn.
 */
function remainingCopies(tile, visibleCounts) {
  return Math.max(
    0,
    4 - (visibleCounts[tile] ?? 0)
  );
}


/* ============================================================
 * UKEIRE
 * ============================================================ */

/**
 * Find every LIVE tile that improves shanten.
 *
 * Example:
 *
 * {
 *   total: 12,
 *   types: 4,
 *   tiles: [
 *     { tile: "b3", remaining: 4, after: 0 },
 *     ...
 *   ]
 * }
 */
export function improvingTiles(
  hand,
  melds = [],
  visibleCounts = {}
) {
  const current = shanten(hand, melds);

  const improvements = [];


  for (const tile of STANDARD_TILES) {
    const remaining = remainingCopies(
      tile,
      visibleCounts
    );

    if (remaining <= 0) continue;


    const nextHand = [...hand, tile];

    const after = isWinningHand(nextHand, melds)
      ? -1
      : shanten(nextHand, melds);


    if (after < current) {
      improvements.push({
        tile,
        remaining,
        after,
      });
    }
  }


  return {
    current,
    total: improvements.reduce(
      (sum, item) => sum + item.remaining,
      0
    ),
    types: improvements.length,
    tiles: improvements,
  };
}


/* ============================================================
 * TAI POTENTIAL
 * ============================================================ */

/**
 * Exact tai when the hand is already ready.
 *
 * This is intentionally grounded in scoreHand(), so advisor logic
 * cannot invent tai values that contradict the table's rules.
 */
function scoreReadyHand(hand, player, state) {
  const results = [];


  for (const tile of STANDARD_TILES) {
    if (
      !isWinningHand(
        [...hand, tile],
        player.melds
      )
    ) {
      continue;
    }


    const score = scoreHand({
      concealed: [...hand, tile],
      melds: player.melds,
      bonus: player.bonus,
      seatWind: seatWindOf(
        player.seat,
        state.dealer
      ),
      prevailingWind: state.prevailingWind,
      rules: state.rules,
    });


    if (score) {
      results.push({
        tile,
        tai: score.tai,
        score,
      });
    }
  }


  return results;
}


/**
 * Estimate future tai.
 *
 * This is intentionally bounded to ONE improvement step.
 *
 * Why?
 *
 * advisor.js is called synchronously by the UI. An unrestricted
 * recursive search becomes expensive very quickly:
 *
 *   discard
 *      × 34 draws
 *      × possible discards
 *      × 34 draws...
 *
 * V2 therefore searches:
 *
 *   discard -> improvement -> winning waits
 *
 * A later Monte Carlo worker can replace this implementation
 * without changing bestDiscard().
 */
export function estimateTaiPotential(
  hand,
  player,
  state,
  visibleCounts
) {
  const distance = shanten(
    hand,
    player.melds
  );


  // ----------------------------------------------------------
  // Already ready: score every actual wait.
  // ----------------------------------------------------------

  if (distance === 0) {
    const winningPaths = scoreReadyHand(
      hand,
      player,
      state
    );


    if (winningPaths.length === 0) {
      return {
        expectedTai: 0,
        maxTai: 0,
        paths: [],
      };
    }


    let weightedTai = 0;
    let totalCopies = 0;


    for (const path of winningPaths) {
      const copies = remainingCopies(
        path.tile,
        visibleCounts
      );

      weightedTai += path.tai * copies;
      totalCopies += copies;
    }


    return {
      expectedTai:
        totalCopies > 0
          ? weightedTai / totalCopies
          : 0,

      maxTai: Math.max(
        ...winningPaths.map((p) => p.tai)
      ),

      paths: winningPaths,
    };
  }


  // ----------------------------------------------------------
  // Search one improvement ahead.
  // ----------------------------------------------------------

  const improvements = improvingTiles(
    hand,
    player.melds,
    visibleCounts
  );


  let weightedTai = 0;
  let totalWeight = 0;
  let maxTai = 0;

  const paths = [];


  for (const improvement of improvements.tiles) {
    const nextHand = [
      ...hand,
      improvement.tile,
    ];


    // After drawing an improvement we may have too many concealed
    // tiles, so test all legal discard outcomes.
    const discardOptions =
      nextHand.length % 3 === 2
        ? [...new Set(nextHand)]
        : [null];


    let bestBranch = null;


    for (const discard of discardOptions) {
      const branchHand = [...nextHand];


      if (discard !== null) {
        branchHand.splice(
          branchHand.indexOf(discard),
          1
        );
      }


      const branchDistance = shanten(
        branchHand,
        player.melds
      );


      // Only evaluate branches that reach ready.
      if (branchDistance !== 0) {
        continue;
      }


      const wins = scoreReadyHand(
        branchHand,
        player,
        state
      );


      if (wins.length === 0) continue;


      let branchTai = 0;
      let copies = 0;


      for (const win of wins) {
        const remaining = remainingCopies(
          win.tile,
          visibleCounts
        );

        branchTai += win.tai * remaining;
        copies += remaining;
      }


      const expected =
        copies > 0
          ? branchTai / copies
          : 0;


      if (
        !bestBranch ||
        expected > bestBranch.expectedTai
      ) {
        bestBranch = {
          improvement: improvement.tile,
          discard,
          expectedTai: expected,
          maxTai: Math.max(
            ...wins.map((w) => w.tai)
          ),
          waits: wins,
        };
      }
    }


    if (!bestBranch) continue;


    /*
     * Weight by the number of available copies of the improvement.
     *
     * A beautiful 5-tai branch requiring the last copy of one tile
     * should not outweigh a 3-tai branch with twelve live tiles.
     */
    const weight = improvement.remaining;

    weightedTai +=
      bestBranch.expectedTai * weight;

    totalWeight += weight;

    maxTai = Math.max(
      maxTai,
      bestBranch.maxTai
    );

    paths.push(bestBranch);
  }


  /*
   * Discount speculative tai.
   *
   * If we're multiple shanten away, high tai becomes progressively
   * less meaningful because many future draws have to cooperate.
   */
  const discount =
    DEFAULT_STRATEGY_WEIGHTS.futureDiscount **
    Math.max(0, distance - 1);


  return {
    expectedTai:
      totalWeight > 0
        ? (weightedTai / totalWeight) * discount
        : 0,

    maxTai,

    paths,
  };
}


/* ============================================================
 * FLEXIBILITY
 * ============================================================ */

/**
 * Cheap structural measure used only as a tie-breaker.
 *
 * Rewards:
 * - pairs
 * - connected suited tiles
 * - middle tiles
 */
function handFlexibility(hand) {
  const counts = toCounts(hand);

  let value = 0;


  for (const tile of STANDARD_TILES) {
    if (!counts[tile]) continue;


    if (counts[tile] >= 2) {
      value += 1;
    }


    if (isSuited(tile)) {
      const suit = suitOf(tile);
      const rank = rankOf(tile);


      for (const offset of [-2, -1, 1, 2]) {
        const neighbour = suit + (rank + offset);

        if (
          rank + offset >= 1 &&
          rank + offset <= 9 &&
          counts[neighbour]
        ) {
          value += 0.25;
        }
      }


      // Middle tiles participate in more possible sequences.
      if (rank >= 3 && rank <= 7) {
        value += 0.1;
      }
    }
  }


  return value;
}


/* ============================================================
 * DISCARD EVALUATION
 * ============================================================ */

function evaluateDiscard(
  tile,
  player,
  state,
  visibleCounts,
  weights
) {
  const hand = [...player.hand];

  hand.splice(
    hand.indexOf(tile),
    1
  );


  const distance = shanten(
    hand,
    player.melds
  );


  const ukeire = improvingTiles(
    hand,
    player.melds,
    visibleCounts
  );


  const tai = estimateTaiPotential(
    hand,
    player,
    state,
    visibleCounts
  );


  const flexibility =
    handFlexibility(hand);


  /*
   * Multi-objective utility.
   *
   * IMPORTANT:
   *
   * Tai should NOT simply be added linearly without a speed penalty.
   *
   * Otherwise the advisor will routinely recommend speculative flush
   * hands instead of taking realistic wins.
   */
  const utility =
    (-weights.shanten * distance) +

    (
      weights.ukeire *
      Math.log1p(ukeire.total)
    ) +

    (
      weights.tai *
      tai.expectedTai
    ) +

    (
      weights.flexibility *
      flexibility
    );


  return {
    tile,

    shanten: distance,

    ukeire: ukeire.total,
    ukeireTypes: ukeire.types,
    improvingTiles: ukeire.tiles,

    expectedTai: tai.expectedTai,
    maxTai: tai.maxTai,

    flexibility,

    utility,
  };
}


/* ============================================================
 * PARETO FRONTIER
 * ============================================================ */

/**
 * A candidate is dominated when another discard is:
 *
 * - at least as fast,
 * - has at least as much ukeire,
 * - has at least as much expected tai,
 *
 * AND is strictly better in at least one category.
 *
 * Dominated choices should never be recommended.
 */
function dominates(a, b) {
  const noWorse =
    a.shanten <= b.shanten &&
    a.ukeire >= b.ukeire &&
    a.expectedTai >= b.expectedTai;


  const strictlyBetter =
    a.shanten < b.shanten ||
    a.ukeire > b.ukeire ||
    a.expectedTai > b.expectedTai;


  return noWorse && strictlyBetter;
}


export function paretoFrontier(candidates) {
  return candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) =>
          other !== candidate &&
          dominates(other, candidate)
      )
  );
}


/* ============================================================
 * DISCARD REASONS
 * ============================================================ */

function discardReasons(tile, player) {
  const counts = toCounts(
    player.hand
  );

  const reasons = [];


  if (
    isHonour(tile) &&
    counts[tile] === 1
  ) {
    reasons.push(
      'It is a lone wind or dragon, so it needs matching copies to become useful.'
    );
  }


  if (isSuited(tile)) {
    const suit = suitOf(tile);
    const rank = rankOf(tile);


    const neighbours =
      [-2, -1, 1, 2]
        .filter((offset) => {
          const next = rank + offset;

          return (
            next >= 1 &&
            next <= 9 &&
            counts[suit + next]
          );
        })
        .length;


    const inSuit =
      player.hand.filter(
        (t) =>
          isSuited(t) &&
          suitOf(t) === suit
      ).length;


    if (neighbours === 0) {
      reasons.push(
        'Nothing nearby connects with it into a run.'
      );
    }


    if (inSuit === 1) {
      reasons.push(
        `It is your only ${suitWord(suit)} tile.`
      );
    }


    if (rank === 1 || rank === 9) {
      reasons.push(
        'Terminals participate in fewer possible runs.'
      );
    }
  }


  if (counts[tile] === 1) {
    reasons.push(
      'You only hold one copy, so it is not currently a pair.'
    );
  }


  return reasons;
}


const SUIT_WORDS = {
  d: 'Dots',
  b: 'Bamboo',
  c: 'Characters',
};


const suitWord = (suit) =>
  SUIT_WORDS[suit];


/* ============================================================
 * BEST DISCARD
 * ============================================================ */

/**
 * Find the best discard by balancing:
 *
 *   SPEED
 *     shanten + live improving tiles
 *
 *   VALUE
 *     expected tai
 *
 *   FLEXIBILITY
 *     future structural options
 *
 * The return value deliberately exposes the underlying metrics so
 * LangGraph / the UI can explain the recommendation rather than
 * merely displaying "discard X".
 */
export function bestDiscard(
  player,
  state,
  weights = DEFAULT_STRATEGY_WEIGHTS
) {
  if (!player.hand?.length) {
    return null;
  }


  const visible = visibleTileCounts(
    state,
    player
  );


  const counts = toCounts(
    player.hand
  );


  const suitTotals = {
    d: 0,
    b: 0,
    c: 0,
  };


  for (const tile of player.hand) {
    if (isSuited(tile)) {
      suitTotals[suitOf(tile)]++;
    }
  }


  const candidates =
    [...new Set(player.hand)]
      .map((tile) => {
        const evaluation =
          evaluateDiscard(
            tile,
            player,
            state,
            visible,
            weights
          );


        return {
          ...evaluation,

          // Existing bot heuristic remains a final deterministic
          // tie-break rather than the primary strategy.
          keep: keepValue(
            tile,
            counts,
            suitTotals
          ),
        };
      });


  const frontier =
    paretoFrontier(candidates);


  frontier.sort(
    (a, b) =>
      b.utility - a.utility ||

      a.shanten - b.shanten ||

      b.ukeire - a.ukeire ||

      b.expectedTai - a.expectedTai ||

      a.keep - b.keep
  );


  const choice = frontier[0];


  /*
   * Also expose explicitly different play styles.
   *
   * This is useful for the coaching agent:
   *
   * "East is balanced, but 9 Bamboo wins faster."
   */
  const fastest =
    [...candidates].sort(
      (a, b) =>
        a.shanten - b.shanten ||
        b.ukeire - a.ukeire ||
        b.utility - a.utility
    )[0];


  const highestTai =
    [...candidates].sort(
      (a, b) =>
        b.expectedTai - a.expectedTai ||
        a.shanten - b.shanten
    )[0];


  return {
    tile: choice.tile,

    shantenAfter:
      choice.shanten,

    ukeire:
      choice.ukeire,

    ukeireTypes:
      choice.ukeireTypes,

    expectedTai:
      choice.expectedTai,

    maxTai:
      choice.maxTai,

    utility:
      choice.utility,

    reasons:
      discardReasons(
        choice.tile,
        player
      ),

    alternatives:
      frontier
        .slice(1, 3)
        .map((candidate) => ({
          tile: candidate.tile,
          shantenAfter:
            candidate.shanten,
          ukeire:
            candidate.ukeire,
          expectedTai:
            candidate.expectedTai,
          utility:
            candidate.utility,
        })),

    strategies: {
      balanced: choice.tile,
      fastest: fastest.tile,
      highestTai: highestTai.tile,
    },

    candidates,
  };
}


/* ============================================================
 * CLAIM ADVICE
 * ============================================================ */

/**
 * Evaluate whether calling chow/pong/kong actually improves the
 * player's position.
 *
 * This retains shanten as the primary call criterion for now.
 *
 * Future V3:
 * evaluate claims using the same expected-tai utility function used
 * for discards.
 */
export function claimAdvice(
  player,
  claim,
  claimedTile = claim.tiles[0]
) {
  if (claim.type === 'win') {
    return {
      verdict: 'yes',
      lines: [
        'Take it — that completes your hand.',
      ],
    };
  }


  const fromHand = [
    ...claim.tiles,
  ];


  const claimedAt =
    fromHand.indexOf(
      claimedTile
    );


  if (claimedAt !== -1) {
    fromHand.splice(
      claimedAt,
      1
    );
  }


  const rest = [
    ...player.hand,
  ];


  for (const tile of fromHand) {
    const index =
      rest.indexOf(tile);


    if (index === -1) {
      return {
        verdict: 'no',
        lines: [
          'You do not hold the tiles required for that call.',
        ],
      };
    }


    rest.splice(
      index,
      1
    );
  }


  const before =
    shanten(
      player.hand,
      player.melds
    );


  const after =
    shanten(
      rest,
      [
        ...player.melds,
        {
          type: claim.type,
          tiles: claim.tiles,
        },
      ]
    );


  const lines = [];

  const helps =
    after < before;


  if (helps) {
    lines.push(
      `Yes — it takes you from ${describeDistance(before)} to ${describeDistance(after)}.`
    );
  } else {
    lines.push(
      `It does not get you closer — you stay ${describeDistance(before)}.`
    );
  }


  if (claim.type === 'chow') {
    lines.push(
      'Chow only works on the player to your left.'
    );
  } else {
    lines.push(
      'Calling turns those tiles face up for everyone to see.'
    );
  }


  return {
    verdict: helps
      ? 'yes'
      : 'no',

    lines,
  };
}


/* ============================================================
 * DISTANCE DESCRIPTION
 * ============================================================ */

export function describeDistance(value) {
  if (value <= -1) {
    return 'a complete hand';
  }

  if (value === 0) {
    return 'one tile from winning';
  }

  return `${value + 1} tiles from winning`;
}


/* ============================================================
 * HAND SUMMARY
 * ============================================================ */

export function handSummary(
  player,
  state
) {
  const distance =
    shanten(
      player.hand,
      player.melds
    );


  const ready =
    waits(player);


  const scoreFor =
    (winningTile) =>
      scoreHand({
        concealed: [
          ...player.hand,
          winningTile,
        ],

        melds:
          player.melds,

        bonus:
          player.bonus,

        seatWind:
          seatWindOf(
            player.seat,
            state.dealer
          ),

        prevailingWind:
          state.prevailingWind,

        rules:
          state.rules,
      });


  const scoredWaits =
    ready
      .map((tile) => ({
        tile,
        score:
          scoreFor(tile),
      }))
      .filter(
        (result) =>
          result.score
      );


  const best =
    [...scoredWaits]
      .sort(
        (a, b) =>
          b.score.tai -
          a.score.tai
      )[0];


  return {
    distance,

    waits:
      ready,

    scoredWaits,

    best,

    bonusCount:
      player.bonus.length,
  };
}


/* ============================================================
 * PROACTIVE COACH HINT
 * ============================================================ */

export function situationHint(state) {
  const you =
    state.players[0];


  if (
    state.phase === 'claim' &&
    state.claimOptions?.length > 0
  ) {
    const claim =
      state.claimOptions[0];


    const advice =
      claimAdvice(
        you,
        claim,
        state.pending.tile
      );


    return (
      `You can ${claim.type} ` +
      `${tileName(state.pending.tile)}. ` +
      advice.lines[0]
    );
  }


  if (
    state.phase === 'act' &&
    state.turn === 0
  ) {
    const advice =
      bestDiscard(
        you,
        state
      );


    if (!advice) {
      return null;
    }


    let hint =
      `Discard ${tileName(advice.tile)}. `;


    if (advice.shantenAfter === 0) {
      hint +=
        `This leaves you one tile from winning ` +
        `with ${advice.ukeire} live winning tiles`;

    } else {
      hint +=
        `This leaves ${advice.ukeire} live improving tiles`;
    }


    if (advice.expectedTai > 0) {
      hint +=
        ` and roughly ${advice.expectedTai.toFixed(1)} expected tai`;
    }


    hint += '.';


    /*
     * Surface an interesting strategic trade-off.
     */
    if (
      advice.strategies.fastest !==
      advice.tile
    ) {
      hint +=
        ` ${tileName(advice.strategies.fastest)} is the faster alternative.`;
    }


    if (
      advice.strategies.highestTai !==
      advice.tile
    ) {
      hint +=
        ` ${tileName(advice.strategies.highestTai)} preserves the highest-value line.`;
    }


    return hint;
  }


  return null;
}
