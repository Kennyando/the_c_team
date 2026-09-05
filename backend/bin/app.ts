#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { KakiMahjongStack } from "../lib/kaki-mahjong-stack";

const app = new cdk.App();

const envName = app.node.tryGetContext("envName") ?? "dev";

new KakiMahjongStack(app, `KakiMahjong-${envName}`, {
  envName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // us-east-1: where the hackathon sandbox permits Bedrock (its org SCP denies Bedrock in
    // ap-southeast-1's neighbours, which the APAC Nova inference profile needs). Override with
    // CDK_DEFAULT_REGION; if you move it, also set -c bedrockModelId to that region's inference
    // profile (e.g. eu.amazon.nova-micro-v1:0) or a single-region model.
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "Kaki Mahjong backend: real-time Singapore-rules Mahjong for seniors",
});
