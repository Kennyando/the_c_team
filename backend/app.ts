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
    region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
  },
  description: "Kaki Mahjong backend: real-time Singapore-rules Mahjong for seniors",
});
