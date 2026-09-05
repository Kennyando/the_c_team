import { createHash } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const polly = new PollyClient({});
const s3 = new S3Client({});
const TABLE = process.env.GAME_TABLE_NAME as string;
const BUCKET = process.env.ASSETS_BUCKET_NAME as string;
const ASSETS_DOMAIN = process.env.ASSETS_DOMAIN as string;

export const roomPk = (roomId: string) => `ROOM#${roomId}`;
export const connSk = (connectionId: string) => `CONN#${connectionId}`;

/** All active connections currently sitting in a room. */
export async function getRoomConnections(roomId: string): Promise<{ connectionId: string; playerId: string }[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": roomPk(roomId), ":prefix": "CONN#" },
    }),
  );
  return (res.Items ?? []) as { connectionId: string; playerId: string }[];
}

export async function putConnection(roomId: string, connectionId: string, playerId: string, seat: number) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: roomPk(roomId), SK: connSk(connectionId), connectionId, playerId, seat, roomId },
    }),
  );
}

/** Reverse lookup used by $disconnect, via the byConnection GSI. */
export async function findConnection(connectionId: string) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "byConnection",
      KeyConditionExpression: "connectionId = :c",
      ExpressionAttributeValues: { ":c": connectionId },
    }),
  );
  return res.Items?.[0] as { PK: string; SK: string; roomId: string; connectionId: string } | undefined;
}

export async function deleteConnection(pk: string, sk: string) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
}

export async function getGameState(roomId: string) {
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: roomPk(roomId), SK: "STATE" } }));
  return res.Item;
}

export async function putGameState(roomId: string, state: Record<string, unknown>) {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: roomPk(roomId), SK: "STATE", ...state } }));
}

/** Push a JSON payload down one WebSocket connection. Swallows stale (410) connections. */
export async function postToConnection(connectionId: string, payload: unknown) {
  const client = new ApiGatewayManagementApiClient({ endpoint: process.env.WEBSOCKET_CALLBACK_URL });
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(payload)),
      }),
    );
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode !== 410) throw err; // 410 = client already gone, ignore
  }
}

export async function broadcastToRoom(roomId: string, payload: unknown, excludeConnectionId?: string) {
  const connections = await getRoomConnections(roomId);
  await Promise.all(
    connections
      .filter((c) => c.connectionId !== excludeConnectionId)
      .map((c) => postToConnection(c.connectionId, payload)),
  );
}

/**
 * Synthesize (or reuse a cached) narration clip and return its public URL.
 * Shared by gameAction.ts (move narration) and advise.ts (spoken advice).
 */
export async function getNarrationUrl(text: string): Promise<string> {
  const key = `voice/${createHash("sha256").update(text).digest("hex")}.mp3`;

  const alreadyCached = await s3
    .send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    .then(() => true)
    .catch(() => false);

  if (!alreadyCached) {
    const synthesized = await polly.send(
      new SynthesizeSpeechCommand({ Text: text, OutputFormat: "mp3", VoiceId: "Amy", Engine: "neural" }),
    );
    const audioBytes = await synthesized.AudioStream?.transformToByteArray();
    if (audioBytes) {
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: audioBytes, ContentType: "audio/mpeg" }));
    }
  }

  return `https://${ASSETS_DOMAIN}/${key}`;
}
