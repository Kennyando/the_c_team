#!/usr/bin/env node
// tsc type-checks JSON imports (resolveJsonModule) but does not copy the JSON file itself into
// dist/ — esbuild (used when CDK bundles the Lambda for deploy) inlines it automatically, so
// `cdk synth`/`cdk deploy` were never affected. Plain `tsc` output was the one thing left broken:
// dist/lambda/classifyIntent.js still does require("../shared/intents.json"), which only resolves
// if dist/shared/intents.json actually exists. fs.cpSync is used (not a shell `cp`) so this runs
// the same way on Windows as everywhere else.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "shared");
const dest = path.join(__dirname, "..", "dist", "shared");
fs.cpSync(src, dest, { recursive: true });
console.log(`copied ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
