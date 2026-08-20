#!/usr/bin/env node
import path from "path";
import { computeBundleDigest } from "../control-plane/src/digest.js";
import { resolveRuleFiles } from "../control-plane/src/paths.js";

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/marketplace-compute-digest.mjs --rule-file rules/finance/kyc/standard_onboarding.arsl.toml",
      "  node scripts/marketplace-compute-digest.mjs --absolute /abs/path/file.arsl.toml",
      "",
      "Repeat --rule-file or --absolute to hash multiple files in one bundle."
    ].join("\n")
  );
}

/** @type {string[]} */
const rel = [];
/** @type {string[]} */
const abs = [];
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  const val = process.argv[i + 1];
  if (arg === "--rule-file") {
    if (!val) {
      usage();
      process.exit(1);
    }
    rel.push(val);
    i += 1;
    continue;
  }
  if (arg === "--absolute") {
    if (!val) {
      usage();
      process.exit(1);
    }
    abs.push(path.resolve(val));
    i += 1;
    continue;
  }
  if (arg === "--help" || arg === "-h") {
    usage();
    process.exit(0);
  }
  console.error(`Unknown arg: ${arg}`);
  usage();
  process.exit(1);
}

if (rel.length === 0 && abs.length === 0) {
  usage();
  process.exit(1);
}

const resolved = [...resolveRuleFiles(rel), ...abs];
const digest = computeBundleDigest(resolved);
console.log(digest);
