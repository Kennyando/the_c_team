import test from "node:test";
import assert from "node:assert/strict";

import { bedrockInvokeResources, assertModelRegionMatch, inferenceProfileGeo } from "../lib/bedrockResources";

// These functions control the bedrock:InvokeModel IAM boundary for both Bedrock Lambdas
// (ClassifyIntentFn, ReviewHandFn). The stack calls the same `bedrockInvokeResources` for each
// with its own model id, so covering the function covers both routes' policy shape.

test("a bare model id -> exactly one region-scoped foundation-model ARN (no account segment)", () => {
  assert.deepEqual(bedrockInvokeResources("aws", "us-east-1", "123456789012", "amazon.nova-micro-v1:0"), [
    "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
  ]);
});

test("a cross-region inference profile -> account-scoped profile ARN + region-wildcarded base-model ARN", () => {
  assert.deepEqual(bedrockInvokeResources("aws", "us-east-1", "123456789012", "us.amazon.nova-micro-v1:0"), [
    "arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.amazon.nova-micro-v1:0",
    "arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0",
  ]);
});

test("the base-model id keeps its own dots (only the leading geo prefix is stripped)", () => {
  const [, base] = bedrockInvokeResources("aws", "eu-west-1", "1", "eu.anthropic.claude-3-5-haiku-20241022-v1:0");
  assert.equal(base, "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0");
});

test("inferenceProfileGeo distinguishes us. from us-gov. and returns null for a plain id", () => {
  assert.equal(inferenceProfileGeo("us.amazon.nova-micro-v1:0"), "us");
  assert.equal(inferenceProfileGeo("us-gov.amazon.nova-micro-v1:0"), "us-gov");
  assert.equal(inferenceProfileGeo("apac.amazon.nova-micro-v1:0"), "apac");
  assert.equal(inferenceProfileGeo("amazon.nova-micro-v1:0"), null);
});

test("assertModelRegionMatch: a matching geo/region pair passes", () => {
  assert.doesNotThrow(() => assertModelRegionMatch("us-east-1", "us.amazon.nova-micro-v1:0", "agentModelId"));
  assert.doesNotThrow(() => assertModelRegionMatch("eu-west-1", "eu.amazon.nova-micro-v1:0", "agentModelId"));
  assert.doesNotThrow(() => assertModelRegionMatch("ap-southeast-1", "apac.amazon.nova-micro-v1:0", "agentModelId"));
  assert.doesNotThrow(() => assertModelRegionMatch("us-gov-west-1", "us-gov.amazon.nova-micro-v1:0", "agentModelId"));
});

test("assertModelRegionMatch: a bare model id never throws, any region", () => {
  assert.doesNotThrow(() => assertModelRegionMatch("eu-west-1", "amazon.nova-micro-v1:0", "bedrockModelId"));
});

test("assertModelRegionMatch: a prefix/region mismatch throws, naming the region, prefix and context key", () => {
  assert.throws(
    () => assertModelRegionMatch("eu-west-1", "us.amazon.nova-micro-v1:0", "bedrockModelId"),
    /bedrockModelId.*"us\.".*eu-west-1/s,
  );
  assert.throws(() => assertModelRegionMatch("us-east-1", "eu.amazon.nova-micro-v1:0", "agentModelId"), /eu\./);
  assert.throws(() => assertModelRegionMatch("us-east-1", "apac.amazon.nova-micro-v1:0", "bedrockModelId"), /apac/);
  // us. is not us-gov-*, and us-gov. is not us-*
  assert.throws(() => assertModelRegionMatch("us-gov-west-1", "us.amazon.nova-micro-v1:0", "x"));
  assert.throws(() => assertModelRegionMatch("us-east-1", "us-gov.amazon.nova-micro-v1:0", "x"));
});

test("assertModelRegionMatch: the error suggests the right prefix for the current region", () => {
  assert.throws(
    () => assertModelRegionMatch("eu-central-1", "us.amazon.nova-micro-v1:0", "agentModelId"),
    /-c agentModelId=eu\./,
  );
});
