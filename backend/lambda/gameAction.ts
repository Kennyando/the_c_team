import type { APIGatewayProxyHandler } from "aws-lambda";
import { getGameState, putGameState, broadcastToRoom, getNarrationUrl } from "./util";

type ActionType = "draw" | "discard" | "chow" | "pong" | "kong" | "win";

interface ActionBody {
  roomId: string;
  playerId: string;
  action: ActionType;
  tile?: string; // e.g. "5-dot", "red-dragon"
}

/**
 * Applies a move to the game state. This is a structural stub: it records
 * the action and advances turn/phase bookkeeping. The actual Singapore
 * Mahjong rules engine (tile legality, Chow/Pong/Kong/Win validation, and
 * limit-hand scoring — see proposal section 5) is Phase 2 of the roadmap
 * and plugs in here.
 */
function applyAction(state: Record<string, any>, body: ActionBody) {
  state.lastAction = { action: body.action, tile: body.tile, playerId: body.playerId, at: Date.now() };
  state.log = [...(state.log ?? []).slice(-49), state.lastAction]; // keep last 50 events
  return state;
}

function narrationFor(body: ActionBody, playerName: string): string {
  switch (body.action) {
    case "draw":
      return `${playerName} draws a tile.`;
    case "discard":
      return `${playerName} discards ${body.tile}.`;
    case "chow":
      return `${playerName} calls chow with ${body.tile}.`;
    case "pong":
      return `${playerName} calls pong on ${body.tile}.`;
    case "kong":
      return `${playerName} calls kong on ${body.tile}.`;
    case "win":
      return `${playerName} wins the hand!`;
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const body = JSON.parse(event.body ?? "{}") as ActionBody;
  if (!body.roomId || !body.playerId || !body.action) {
    return { statusCode: 400, body: "roomId, playerId and action are required" };
  }

  const state = (await getGameState(body.roomId)) ?? { roomId: body.roomId };
  const updated = applyAction(state as Record<string, any>, body);
  await putGameState(body.roomId, updated);

  const seat = Object.values(updated.seats ?? {}).find((s: any) => s.playerId === body.playerId) as
    | { playerName: string }
    | undefined;
  const narrationText = narrationFor(body, seat?.playerName ?? "A player");
  const narrationUrl = await getNarrationUrl(narrationText);

  await broadcastToRoom(body.roomId, {
    type: "gameUpdate",
    state: updated,
    narration: { text: narrationText, audioUrl: narrationUrl },
  });

  return { statusCode: 200, body: "ok" };
};
