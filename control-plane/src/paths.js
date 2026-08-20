import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Root of the agf-sp1 workspace (contains `rules/**` and the server).
 * Override with env when deploying.
 */
export function getAgfSp1Root() {
  if (process.env.AGF_SP1_ROOT) {
    return path.resolve(process.env.AGF_SP1_ROOT);
  }
  return path.resolve(__dirname, "../../agf-sp1");
}

/**
 * @param {string[]} relPaths paths relative to agf-sp1 root, e.g. `rules/finance/x.arsl.toml`
 * @returns {string[]} absolute paths
 */
export function resolveRuleFiles(relPaths) {
  const root = getAgfSp1Root();
  return relPaths.map((p) => path.resolve(root, p.replace(/^\//, "")));
}

/**
 * Read a single file under the agf-sp1 root (e.g. rules/...). Rejects path traversal.
 * @param {string} relPath path relative to agf-sp1, e.g. `rules/finance/x.arsl.toml`
 * @returns {string} file contents
 */
export function readAgfFileUnderRoot(relPath) {
  const root = path.resolve(getAgfSp1Root());
  const normalized = path.resolve(root, String(relPath).replace(/^\//, ""));
  if (!normalized.startsWith(root + path.sep) && normalized !== root) {
    throw new Error("invalid path");
  }
  if (!fs.existsSync(normalized) || !fs.statSync(normalized).isFile()) {
    throw new Error("file not found");
  }
  return fs.readFileSync(normalized, "utf8");
}
