import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { getAgfSp1Root } from "./paths.js";

/**
 * @param {string} absPath absolute path to a .arsl.toml file
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateArslFile(absPath) {
  if (!fs.existsSync(absPath)) {
    return { ok: false, message: `missing file: ${absPath}` };
  }
  const root = getAgfSp1Root();
  const override = process.env.ARSL_VALIDATE_BIN;
  const release = path.join(root, "target/release/arsl-validate");
  const debug = path.join(root, "target/debug/arsl-validate");
  const binary =
    (override && fs.existsSync(override) && override) ||
    (fs.existsSync(release) ? release : null) ||
    (fs.existsSync(debug) ? debug : null);

  if (binary) {
    const r = spawnSync(binary, ["--file", absPath], {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
    if (r.status === 0) {
      return { ok: true };
    }
    const out = (r.stderr || r.stdout || r.error?.message || "").trim();
    return { ok: false, message: out || `arsl-validate exit ${r.status}` };
  }

  const r = spawnSync(
    "cargo",
    ["run", "-q", "-p", "agf-script", "--bin", "arsl-validate", "--", "--file", absPath],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      timeout: Number(process.env.ARSL_VALIDATE_CARGO_TIMEOUT_MS) || 300_000,
    }
  );
  if (r.error) {
    return { ok: false, message: r.error.message };
  }
  if (r.status === 0) {
    return { ok: true };
  }
  const out = (r.stderr || r.stdout || "").trim();
  return { ok: false, message: out || `cargo arsl-validate exit ${r.status}` };
}

/**
 * @param {string[]} absPaths
 * @returns {{ ok: true } | { ok: false, message: string, file?: string }}
 */
export function validateArslFiles(absPaths) {
  for (const p of absPaths) {
    const v = validateArslFile(p);
    if (!v.ok) {
      return { ok: false, message: v.message, file: p };
    }
  }
  return { ok: true };
}
