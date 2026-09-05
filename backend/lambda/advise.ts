import type { APIGatewayProxyHandler } from "aws-lambda";
import { postToConnection, getNarrationUrl } from "./util";
import { advise, AdviceResult } from "./mahjong/advisor";

interface AdviseBody {
  playerId: string;
  hand: string[]; // this player's own tiles, e.g. ["5-dot","5-dot","1-character",...]
  discardPile?: string[]; // every tile discarded in the room so far (safety heuristic)
  lastDiscard?: {
    tile: string;
    byPlayerId: string;
    byPlayerName: string;
    seatOffset: number; // (discardingSeat - mySeat + 4) % 4; 3 = the player to my left
  };
}

/**
 * Builds the spoken-aloud advice text: first narrates what the opponent
 * discarded (the "reads out the tiles" half of the feature request), then
 * layers on a recommendation (the "suggests the best move" half).
 */
function buildNarration(body: AdviseBody, advice: AdviceResult): string {
  const parts: string[] = [];

  if (body.lastDiscard) {
    parts.push(`${body.lastDiscard.byPlayerName} discards ${body.lastDiscard.tile}.`);

    const calls: string[] = [];
    if (advice.legalCalls.win) calls.push("win");
    if (advice.legalCalls.kong) calls.push("kong");
    if (advice.legalCalls.pong) calls.push("pong");
    if (advice.legalCalls.chow) calls.push("chow");

    if (calls.length > 0) {
      parts.push(`You can call ${calls.join(" or ")} on this tile.`);
    }
  }

  if (advice.recommendedDiscard) {
    parts.push(`If you draw, a good discard is ${advice.recommendedDiscard.tile}.`);
  } else if (!body.lastDiscard) {
    parts.push(`You are ${Math.max(advice.currentShanten, 0)} tiles away from a ready hand.`);
  }

  return parts.join(" ");
}

/**
 * "advise": the move-advisor / narration assistant. Unlike "action", this
 * route never touches shared game state and never broadcasts — the advice
 * is personal to the requesting player, so the response goes back down
 * their own connection only (an opponent should never see your hand or
 * your recommendations).
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId as string;
  const body = JSON.parse(event.body ?? "{}") as AdviseBody;

  if (!body.playerId || !Array.isArray(body.hand) || body.hand.length === 0) {
    return { statusCode: 400, body: "playerId and a non-empty hand are required" };
  }

  let result: AdviceResult;
  try {
    result = advise(body.hand, {
      discardPile: body.discardPile,
      lastDiscard: body.lastDiscard
        ? { tile: body.lastDiscard.tile, seatOffset: body.lastDiscard.seatOffset }
        : undefined,
    });
  } catch (err) {
    // Most likely an unrecognised tile label from the client.
    return { statusCode: 400, body: `Could not read hand: ${(err as Error).message}` };
  }

  const narrationText = buildNarration(body, result);
  const narrationUrl = await getNarrationUrl(narrationText);

  await postToConnection(connectionId, {
    type: "advice",
    advice: result,
    narration: { text: narrationText, audioUrl: narrationUrl },
  });

  return { statusCode: 200, body: "ok" };
};
