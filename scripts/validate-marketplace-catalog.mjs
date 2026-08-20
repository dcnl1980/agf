#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { computeBundleDigest } from "../control-plane/src/digest.js";
import { resolveRuleFiles } from "../control-plane/src/paths.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.AGF_SP1_ROOT = process.env.AGF_SP1_ROOT ?? path.join(repoRoot, "agf-sp1");
const catalogPath = path.join(repoRoot, "catalog", "community-catalog.json");
const schemaPath = path.join(repoRoot, "catalog", "community-catalog.schema.json");
const rulesRoot = path.join(repoRoot, "agf-sp1");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(catalogPath)) {
  fail(`Catalog not found: ${catalogPath}`);
}
if (!fs.existsSync(schemaPath)) {
  fail(`Schema not found: ${schemaPath}`);
}

const catalogRaw = fs.readFileSync(catalogPath, "utf8");
const catalog = JSON.parse(catalogRaw);

for (const entry of catalog.entries || []) {
  for (const version of entry.versions || []) {
    const relList = version.ruleFiles || [];
    const absPaths = resolveRuleFiles(relList);
    for (const rel of relList) {
      const abs = path.resolve(rulesRoot, rel);
      if (!abs.startsWith(path.resolve(rulesRoot) + path.sep)) {
        fail(`Invalid ruleFiles path (traversal): ${rel}`);
      }
      if (!fs.existsSync(abs)) {
        fail(`Missing rule file: ${rel}`);
      }
    }
    const expectedDigest = version.digest;
    if (typeof expectedDigest === "string" && expectedDigest.length > 0) {
      const computed = computeBundleDigest(absPaths);
      if (computed !== expectedDigest) {
        fail(
          `Digest mismatch for ${entry.id}@${version.version}:\n` +
            `  catalog: ${expectedDigest}\n` +
            `  computed: ${computed}`
        );
      }
    }
    for (const rel of relList) {
      const abs = path.resolve(rulesRoot, rel);
      const cmd = spawnSync(
        "cargo",
        [
          "run",
          "--manifest-path",
          path.join(repoRoot, "agf-sp1", "script", "Cargo.toml"),
          "--bin",
          "arsl-validate",
          "--",
          "--file",
          abs
        ],
        { stdio: "inherit" }
      );
      if (cmd.status !== 0) {
        fail(`arsl-validate failed for ${rel}`);
      }
    }
  }
}

console.log("Marketplace catalog validation passed.");
