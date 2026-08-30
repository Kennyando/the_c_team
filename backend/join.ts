import type { APIGatewayProxyHandler } from "aws-lambda";
import { putConnection, getGameState, putGameState, broadcastToRoom } from "./util";

interface JoinBody {
  roomId: string;
  playerId: string;
  playerName: string;
  seat: number; // 0=East, 1=South, 2=West, 3=North
}

/**
 * "join": a player enters (or reconnects to) a room. Creates the room's
 * STATE record on first join. Full deal/turn logic belongs in gameAction.ts
 * (Phase 2 of the roadmap) — this just seats the player and syncs state.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId as string;
  const body = JSON.parse(event.body ?? "{}") as JoinBody;

  if (!body.roomId || !body.playerId || body.seat === undefined) {
    return { statusCode: 400, body: "roomId, playerId and seat are required" };
  }

  await putConnection(body.roomId, connectionId, body.playerId, body.seat);

  let state = await getGameState(body.roomId);
  if (!state) {
    state = {
      roomId: body.roomId,
      phase: "waiting_for_players",
      seats: { [body.seat]: { playerId: body.playerId, playerName: body.playerName } },
      houseRules: { limitHandCap: 1000 }, // configurable per proposal section 5
    };
    await putGameState(body.roomId, state);
  } else {
    (state.seats as Record<string, unknown>)[body.seat] = { playerId: body.playerId, playerName: body.playerName };
    await putGameState(body.roomId, state);
  }

  await broadcastToRoom(body.roomId, { type: "playerJoined", seat: body.seat, playerName: body.playerName, state });

  return { statusCode: 200, body: "joined" };
};
