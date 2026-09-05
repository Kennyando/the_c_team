// Game state and turn flow.
//
// Every exported function takes a state and returns a NEW state (the caller clones first via
// `advance`), so React re-renders reliably and moves stay replayable.

import { buildWall, isBonus, sortTiles, tileName } from './tiles.js';
import { getClaimsFor, getSelfKongs, isWinningHand, bestClaim } from './melds.js';
import { scoreHand, settle, seatWindOf } from './scoring.js';
import { shanten, bestDiscard, evaluateDiscard, contextFor, claimAdvice } from './advisor.js';

export const SEAT_NAMES = ['You', 'Ah Ma', 'Ah Gong', 'Ah Huat'];

function log(state, text) {
  state.log.push(text);
}

/** Deal a fresh hand. Seat 0 is the human; the dealer holds 14 tiles and discards first. */
export function newGame(rules, dealer = 0, carriedPoints = [0, 0, 0, 0]) {
  const wall = buildWall(rules.includeAnimals);
  const players = [0, 1, 2, 3].map((seat) => ({
    seat,
    name: SEAT_NAMES[seat],
    isHuman: seat === 0,
    hand: [],
    melds: [],
    bonus: [],
    points: carriedPoints[seat],
  }));

  // Four at a time, three times round, then one each — the dealer takes an extra.
  for (let round = 0; round < 3; round++) {
    for (const p of players) for (let i = 0; i < 4; i++) p.hand.push(wall.shift());
  }
  for (const p of players) p.hand.push(wall.shift());
  players[dealer].hand.push(wall.shift());

  const state = {
    rules,
    wall,
    players,
    dealer,
    turn: dealer,
    prevailingWind: 'we',
    discards: [],
    phase: 'act',
    lastDrawn: null,
    pending: null,
    claimOptions: [],
    botClaims: [],
    result: null,
    log: [],
    // Structured record of the human's discard/claim decisions, for a future post-game review —
    // separate from `log` above, which is narrative text for display, not data to compare against.
    decisions: [],
  };

  // Bonus tiles held after the deal are set aside and replaced, dealer first.
  for (let i = 0; i < 4; i++) replaceBonus(state, players[(dealer + i) % 4]);
  for (const p of players) p.hand = sortTiles(p.hand);
  log(state, 'New hand dealt. Prevailing wind is East.');
  return state;
}

/** Move flowers/seasons/animals out of a hand, drawing replacements from the back of the wall. */
function replaceBonus(state, player) {
  for (let i = 0; i < player.hand.length; i++) {
    while (isBonus(player.hand[i])) {
      player.bonus.push(player.hand[i]);
      if (state.wall.length === 0) {
        player.hand.splice(i, 1);
        return;
      }
      player.hand[i] = state.wall.pop();
    }
  }
}

function endInDraw(state) {
  state.phase = 'over';
  state.result = { drawn: true, payments: [0, 0, 0, 0] };
  log(state, 'Wall exhausted — the hand is a draw.');
  return state;
}

/** Current player takes a tile from the wall, banking any bonus tiles along the way. */
export function drawTile(state) {
  const p = state.players[state.turn];
  if (state.wall.length === 0) return endInDraw(state);

  let tile = state.wall.shift();
  while (isBonus(tile)) {
    p.bonus.push(tile);
    log(state, `${p.name} drew ${tileName(tile)} and takes a replacement.`);
    if (state.wall.length === 0) return endInDraw(state);
    tile = state.wall.pop();
  }

  p.hand = sortTiles([...p.hand, tile]);
  state.lastDrawn = tile;
  state.phase = 'act';
  return state;
}

/** Replacement draw after a kong: comes off the back of the wall. */
function drawReplacement(state) {
  const p = state.players[state.turn];
  if (state.wall.length === 0) return endInDraw(state);

  let tile = state.wall.pop();
  while (isBonus(tile)) {
    p.bonus.push(tile);
    if (state.wall.length === 0) return endInDraw(state);
    tile = state.wall.pop();
  }

  p.hand = sortTiles([...p.hand, tile]);
  state.lastDrawn = tile;
  state.phase = 'act';
  return state;
}

/**
 * A structured record of the human's discard, for a future post-game review — separate from the
 * narrative `log`, which is display text, not data to compare against. Reuses `advisor.js`'s own
 * `bestDiscard`, the exact function the live coach uses to judge a position, so this is by
 * construction the same recommendation the coach would give at the same moment.
 */
function recordDiscardDecision(state, player, chosen) {
  const ctx = contextFor(state, player);
  const rec = bestDiscard(player, ctx);
  const chosenEval = evaluateDiscard(player, chosen, ctx);

  return {
    type: 'discard',
    hand: [...player.hand],
    melds: player.melds.map((m) => ({ ...m })),
    chosen,
    recommended: rec.tile,
    shantenBefore: shanten(player.hand, player.melds),
    shantenAfterChosen: chosenEval.after,
    shantenAfterRecommended: rec.shantenAfter,
    reasons: rec.reasons,
    // Compare the blended (speed + value) score directly, not membership in `alternatives` — that
    // list is capped at two entries for the coach's UI text ("X is just as good"), so a four-way
    // tie for best would wrongly flag the fourth tile as a mistake if used as the correctness
    // signal. Now that bestDiscard() can prefer a marginally slower tile for its value, comparing
    // resulting shanten alone would also wrongly flag a tile that matches speed but not value (or
    // credit one that matches neither) — the blended score is the only number that actually
    // reflects what was recommended and why.
    optimal: chosenEval.blended === rec.blended,
  };
}

/** Discard, then open the claim window for the other three players. */
export function discardTile(state, tile) {
  const p = state.players[state.turn];
  const i = p.hand.indexOf(tile);
  if (i === -1) return state;

  if (p.isHuman) state.decisions.push(recordDiscardDecision(state, p, tile));

  p.hand.splice(i, 1);
  state.discards.push({ tile, by: p.seat });
  state.lastDrawn = null;
  state.pending = { tile, by: p.seat };
  state.phase = 'claim';
  log(state, `${p.name} discarded ${tileName(tile)}.`);

  // Work out who could claim it. The human's options drive the highlighted call buttons; the bots'
  // best claim is held so it can be compared against whatever the human chooses.
  const botClaims = [];
  state.claimOptions = [];
  for (const other of state.players) {
    if (other.seat === p.seat) continue;
    const claims = getClaimsFor(other, tile, p.seat).map((c) => ({ ...c, seat: other.seat }));
    if (other.isHuman) state.claimOptions = claims;
    else botClaims.push(...claims);
  }
  state.botClaims = botClaims;
  return state;
}

/** Nobody claimed: play passes to the next seat. */
export function passClaims(state) {
  state.pending = null;
  state.claimOptions = [];
  state.botClaims = [];
  state.turn = (state.turn + 1) % 4;
  state.phase = 'draw';
  return state;
}

/**
 * A structured record of the human's call/pass decision on a contested discard, alongside
 * `recordDiscardDecision` above. Reuses `advisor.js`'s `claimAdvice` per option on offer, so the
 * logged `recommended` call is exactly what the live coach would say about the same discard.
 */
function recordClaimDecision(state, humanChoice) {
  const human = state.players[0];
  const claimedTile = state.pending.tile;
  const options = state.claimOptions.map((claim) => ({ claim, ...claimAdvice(human, claim, claimedTile) }));
  // `claim` on each option (and `chosen`, when set) all come from the same `state.claimOptions`
  // array elements, so reference equality is enough to tell which option the human took.
  const yesClaims = options.filter((o) => o.verdict === 'yes').map((o) => o.claim);
  const chosen = humanChoice || null;

  return {
    type: 'claim',
    pendingTile: claimedTile,
    discardedBy: state.pending.by,
    options,
    chosen,
    // A single canonical answer for display, e.g. "you could have called X" — but see `optimal`
    // below: claimAdvice() doesn't rank between two calls that both help, so when more than one
    // option is legitimately good, this is only *a* correct answer, not the only one.
    recommended: yesClaims[0] ?? null,
    // Any positively-advised option is an acceptable outcome, not just the (arbitrary) first one —
    // otherwise a hand with two good chow configurations would flag choosing the second as a
    // mistake purely because of array order.
    optimal: chosen === null ? yesClaims.length === 0 : yesClaims.includes(chosen),
  };
}

/** Award a contested discard to the highest-priority claim. */
export function resolveClaims(state, humanChoice) {
  if (state.claimOptions.length > 0) state.decisions.push(recordClaimDecision(state, humanChoice));

  const candidates = [...(state.botClaims || [])];
  if (humanChoice) candidates.push({ ...humanChoice, seat: 0 });
  const winner = bestClaim(candidates, state.pending.by);
  return winner ? applyClaim(state, winner) : passClaims(state);
}

export function applyClaim(state, claim) {
  const player = state.players[claim.seat];
  const { tile, by } = state.pending;

  if (claim.type === 'win') {
    return finishHand(state, player, tile, false, by);
  }

  // Take the discard off the table and move the matching tiles out of hand into an exposed meld.
  state.discards.pop();
  const fromHand = [...claim.tiles];
  fromHand.splice(fromHand.indexOf(tile), 1);
  for (const t of fromHand) player.hand.splice(player.hand.indexOf(t), 1);
  player.melds.push({ type: claim.type, tiles: claim.tiles, concealed: false, from: by });

  state.pending = null;
  state.claimOptions = [];
  state.botClaims = [];
  state.turn = player.seat;
  log(state, `${player.name} called ${claim.type.toUpperCase()} on ${tileName(tile)}.`);

  // A kong is short a tile, so it draws a replacement; pong and chow discard straight away.
  if (claim.type === 'kong') return drawReplacement(state);
  state.phase = 'act';
  return state;
}

/** Concealed kong (four in hand) or added kong (fourth tile onto an exposed pong). */
export function declareKong(state, kong) {
  const p = state.players[state.turn];
  if (kong.type === 'concealedKong') {
    for (let i = 0; i < 4; i++) p.hand.splice(p.hand.indexOf(kong.tile), 1);
    p.melds.push({ type: 'kong', tiles: Array(4).fill(kong.tile), concealed: true });
  } else {
    p.hand.splice(p.hand.indexOf(kong.tile), 1);
    const meld = p.melds.find((m) => m.type === 'pong' && m.tiles[0] === kong.tile);
    meld.type = 'kong';
    meld.tiles = Array(4).fill(kong.tile);
  }
  log(state, `${p.name} declared a KONG of ${tileName(kong.tile)}.`);
  return drawReplacement(state);
}

/** Win on a tile drawn from the wall. */
export function declareSelfDraw(state) {
  const p = state.players[state.turn];
  return finishHand(state, p, state.lastDrawn, true, null);
}

function finishHand(state, winner, winningTile, selfDraw, fromSeat) {
  // On a discard win the claimed tile is not yet in hand; on a self-draw it already is.
  const concealed = selfDraw ? winner.hand : [...winner.hand, winningTile];
  const score = scoreHand({
    concealed,
    melds: winner.melds,
    bonus: winner.bonus,
    seatWind: seatWindOf(winner.seat, state.dealer),
    prevailingWind: state.prevailingWind,
    rules: state.rules,
  });

  const payments = settle({
    points: score.points,
    winnerSeat: winner.seat,
    selfDraw,
    fromSeat,
    rules: state.rules,
  });
  for (const p of state.players) p.points += payments[p.seat];

  winner.hand = sortTiles(concealed);
  state.pending = null;
  state.claimOptions = [];
  state.botClaims = [];
  state.phase = 'over';
  state.result = {
    drawn: false,
    winnerSeat: winner.seat,
    winnerName: winner.name,
    winningTile,
    selfDraw,
    fromSeat,
    payments,
    ...score,
  };
  log(state, `${winner.name} won with ${tileName(winningTile)} — ${score.tai} tai.`);
  return state;
}

/** What the player whose turn it is may do besides discarding. */
export function getTurnActions(state) {
  const p = state.players[state.turn];
  const actions = [];
  if (isWinningHand(p.hand, p.melds)) actions.push({ type: 'win' });
  for (const kong of getSelfKongs(p)) actions.push(kong);
  return actions;
}
