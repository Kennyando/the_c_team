import type { APIGatewayProxyHandler } from "aws-lambda";

/**
 * $connect: the socket is open but the player hasn't chosen a room yet.
 * Room membership is written by the "join" route once the client sends
 * { action: "join", roomId, playerId, seat }. Nothing to persist here.
 */
export const handler: APIGatewayProxyHandler = async () => {
  return { statusCode: 200, body: "connected" };
};
