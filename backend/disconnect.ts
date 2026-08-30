import type { APIGatewayProxyHandler } from "aws-lambda";
import { findConnection, deleteConnection, broadcastToRoom } from "./util";

/**
 * $disconnect: look up which room this connection belonged to via the
 * byConnection GSI, remove it, and tell the remaining players someone left
 * (so the UI can show "waiting for Ah Ma to reconnect..." rather than stall).
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId as string;

  const record = await findConnection(connectionId);
  if (record) {
    await deleteConnection(record.PK, record.SK);
    await broadcastToRoom(record.roomId, { type: "playerLeft", connectionId }, connectionId);
  }

  return { statusCode: 200, body: "disconnected" };
};
