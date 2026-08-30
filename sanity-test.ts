import { handToCounts, tileLabel } from "./tiles";
import { shanten } from "./shanten";
import { advise } from "./advisor";

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  if (!ok) process.exitCode = 1;
}

// Complete hand: 123m 456p 789s 11z(East) 22z(South) — 4 runs + pair = win.
const completeHand = [
  "1-character", "2-character", "3-character",
  "4-dot", "5-dot", "6-dot",
  "7-bamboo", "8-bamboo", "9-bamboo",
  "east", "east",
  "south", "south",
  // 13 tiles is a pair short of 4 melds+pair; add one more meld's worth to reach 14 and win:
];
// Build a genuine 14-tile complete hand: 4 melds + a pair.
const winningHand14 = [
  "1-character", "2-character", "3-character",
  "4-dot", "5-dot", "6-dot",
  "7-bamboo", "8-bamboo", "9-bamboo",
  "1-bamboo", "2-bamboo", "3-bamboo",
  "east", "east",
];
assertEqual("complete 14-tile hand is a win (shanten -1)", shanten(handToCounts(winningHand14)), -1);

// Tenpai (0-shanten): 13 tiles, one tile away from winning — remove the last East.
const tenpaiHand13 = winningHand14.slice(0, -1);
assertEqual("13-tile hand missing one pair tile is tenpai (shanten 0)", shanten(handToCounts(tenpaiHand13)), 0);

// A scattered, far-from-winning hand should have a high shanten.
const messyHand13 = [
  "1-character", "5-dot", "9-bamboo", "east", "south", "west", "north",
  "red-dragon", "green-dragon", "white-dragon", "2-character", "6-dot", "3-bamboo",
];
const messyShanten = shanten(handToCounts(messyHand13));
console.log(`INFO  messy 13-tile hand shanten = ${messyShanten} (expect high, roughly 6-8)`);

// Seven pairs, one pair short (6 pairs + 1 singleton) should be shanten 0 via chiitoitsu path.
const sixPairsHand = [
  "1-character", "1-character",
  "2-character", "2-character",
  "3-character", "3-character",
  "4-dot", "4-dot",
  "5-dot", "5-dot",
  "6-dot", "6-dot",
  "9-bamboo",
];
assertEqual("six pairs + one singleton is chiitoitsu-tenpai (shanten 0)", shanten(handToCounts(sixPairsHand)), 0);

// Advisor: from tenpai-minus-a-draw (14 tiles), discarding the right tile should reach shanten 0.
const advice = advise(winningHand14); // 14 tiles, already a win, but exercise the discard-recommend path
console.log("INFO  advice on a 14-tile winning hand:", JSON.stringify(advice));
assertEqual("recommended discard exists for a 14-tile hand", advice.recommendedDiscard !== null, true);

// Advisor: legal calls — hand has two 5-dots, opponent to our left discards a 5-dot -> pong should be legal.
const pongReadyHand = [
  "5-dot", "5-dot", "1-character", "2-character", "3-character",
  "4-dot", "6-dot", "7-bamboo", "8-bamboo", "9-bamboo", "east", "south", "west",
];
const pongAdvice = advise(pongReadyHand, { lastDiscard: { tile: "5-dot", seatOffset: 1 } });
assertEqual("pong is legal with two 5-dots in hand", pongAdvice.legalCalls.pong, true);
assertEqual("kong is NOT legal with only two 5-dots in hand", pongAdvice.legalCalls.kong, false);

// Chow only legal from the left player (seatOffset === 3).
const chowReadyHand = [
  "4-dot", "6-dot", "1-character", "2-character", "3-character",
  "1-dot", "2-dot", "7-bamboo", "8-bamboo", "9-bamboo", "east", "south", "west",
];
const chowFromLeft = advise(chowReadyHand, { lastDiscard: { tile: "5-dot", seatOffset: 3 } });
const chowFromAcross = advise(chowReadyHand, { lastDiscard: { tile: "5-dot", seatOffset: 2 } });
assertEqual("chow legal when discard comes from the left player", chowFromLeft.legalCalls.chow, true);
assertEqual("chow NOT legal when discard comes from across the table", chowFromAcross.legalCalls.chow, false);

console.log(`\nSample tile label round-trip: ${tileLabel(0)}, ${tileLabel(31)}`);
