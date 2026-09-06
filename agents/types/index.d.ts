// Hand-written types for the public surface of @kaki/agents. The implementation is plain ESM
// JavaScript (like frontend/src/game/); this file is only so the TypeScript backend Lambda that
// imports `runReview` type-checks. Keep it in sync with src/index.js.

export interface ReviewResult {
  /** One warm sentence summing the hand up. */
  headline: string;
  /** Up to 4 short "you did this well" notes. May be empty. */
  goodMoves: string[];
  /** Up to 4 short "next time, try this" notes. May be empty. */
  improvements: string[];
  /** A single concrete focus for the next hand. */
  oneThingToTry: string;
  /** true if a model phrased it, false if it's the deterministic fallback. */
  modelAssisted: boolean;
}

export interface RunReviewInput {
  /** The engine's `state.decisions` array. Untrusted; each entry is guarded. */
  decisions?: unknown[];
  /** The game's `state.rules` object. */
  rules?: Record<string, unknown>;
  /** Defaults to true. false forces the deterministic, model-free review. */
  useModel?: boolean;
}

export function runReview(input?: RunReviewInput): Promise<ReviewResult>;

export interface CoachAnswerResult {
  /** Always "Coach" — the same shape a local coach answer has, so the UI needs no special case. */
  title: string;
  /** 1–3 short lines answering the question. */
  lines: string[];
  /** true when a model wrote it, false for the fixed deterministic fallback. */
  modelAssisted: boolean;
}

export interface RunCoachAnswerInput {
  /** The browser's serialized `state` subset. Untrusted; every field is guarded. */
  position?: Record<string, unknown>;
  /** The player's typed question. */
  question?: string;
  /** Defaults to true. false forces the deterministic answer. */
  useModel?: boolean;
}

export function runCoachAnswer(input?: RunCoachAnswerInput): Promise<CoachAnswerResult>;

export interface CoachContext {
  facts: string[];
  phase: string;
  yourTurn: boolean;
  wallCount: number;
}
export function coachContext(position: Record<string, unknown>): CoachContext;

export interface DecisionFact {
  /** Stable id (`d<index>`) so a grounding check can cite which decision a review bullet is about. */
  id: string;
  index: number;
  type: "discard" | "claim";
  wasOptimal: boolean;
  text: string;
}
export interface DecisionContext {
  total: number;
  optimalCount: number;
  discardCount: number;
  claimCount: number;
  facts: DecisionFact[];
  mistakes: DecisionFact[];
}
export function decisionContext(decisions: unknown[]): DecisionContext;

export interface RulesContext {
  limit: number;
  active: string[];
  line: string;
}
export function rulesContext(rules: Record<string, unknown> | undefined): RulesContext;

export interface Memory {
  load(playerId: string): Promise<{ notes: string[] }>;
  save(playerId: string, summary: { notes: string[] }): Promise<void>;
}
export function createMemory(): Memory;

export const MODEL_ID: string;
