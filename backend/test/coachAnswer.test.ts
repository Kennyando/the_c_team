// Unit tests for the coach-answer Lambda (lambda/coachAnswer.ts).
//
// This handler is a thin wrapper: request validation, then it delegates to `runCoachAnswer` from
// @kaki/agents. The agent's own model path (Bedrock call, shape check, fallback) is covered in
// agents/test/coachAnswer.test.js — and can't be mocked from here anyway, because @kaki/agents
// resolves its *own* copy of the AWS SDK. So, like reviewHand.ts, the backend tests only cover
// what this file owns: the 400s (which never reach the agent) and that a valid request yields a
// 200 with a well-formed answer object. With no AWS credentials the agent's Bedrock call fails
// and it returns its deterministic answer — a 200 either way, which is what the frontend needs.

import test from "node:test";
import assert from "node:assert/strict";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "../lambda/coachAnswer";

const event = (body: unknown): APIGatewayProxyEventV2 =>
  ({ body: typeof body === "string" ? body : JSON.stringify(body) }) as APIGatewayProxyEventV2;

const call = (body: unknown) =>
  handler(event(body), {} as never, (() => {}) as never) as Promise<{ statusCode: number; body: string }>;

const POSITION = {
  hand: ["d1", "d2", "d3", "d4", "d5", "d6", "b1", "b2", "b3", "c7", "c8", "we", "we"],
  melds: [[], [], [], []],
  bonus: [[], [], [], []],
  discards: [],
  wallCount: 70,
  turn: 0,
  phase: "act",
  dealer: 0,
  prevailingWind: "we",
  rules: { dragonPong: true, limit: 5 },
};

// --- request validation (returns before it ever reaches the agent) ---

test("rejects malformed JSON", async () => {
  const res = await call("{not json");
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /malformed json/i);
});

test("rejects a missing / empty / whitespace / non-string question", async () => {
  for (const body of [{}, { question: "" }, { question: "   " }, { question: 42 }, { question: null }]) {
    const res = await call({ ...body, position: POSITION });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
});

test("rejects an over-long question", async () => {
  const res = await call({ question: "a".repeat(301), position: POSITION });
  assert.equal(res.statusCode, 400);
});

// --- a valid request always resolves to a 200 with a well-formed answer ---

const isWellFormed = (a: unknown): boolean =>
  !!a &&
  typeof a === "object" &&
  typeof (a as { title: unknown }).title === "string" &&
  Array.isArray((a as { lines: unknown }).lines) &&
  (a as { lines: unknown[] }).lines.length > 0 &&
  (a as { lines: unknown[] }).lines.every((l) => typeof l === "string") &&
  typeof (a as { modelAssisted: unknown }).modelAssisted === "boolean";

test("a question exactly at the length cap is accepted", async () => {
  const res = await call({ question: "a".repeat(300), position: POSITION });
  assert.equal(res.statusCode, 200);
  assert.ok(isWellFormed(JSON.parse(res.body).answer));
});

test("a valid question + position yields a 200 with a well-formed answer", async () => {
  const res = await call({ question: "am I close to winning?", position: POSITION });
  assert.equal(res.statusCode, 200);
  assert.ok(isWellFormed(JSON.parse(res.body).answer));
});

test("a missing position does not 5xx — it still answers", async () => {
  const res = await call({ question: "how do I win?" });
  assert.equal(res.statusCode, 200);
  assert.ok(isWellFormed(JSON.parse(res.body).answer));
});
