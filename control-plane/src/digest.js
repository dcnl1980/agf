import crypto from "crypto";
import fs from "fs";

/**
 * Content-addressed digest of rule files (for bundle pinning; not a legal "proof").
 * @param {string[]} absolutePaths
 */
export function computeBundleDigest(absolutePaths) {
  const h = crypto.createHash("sha256");
  for (const p of [...new Set(absolutePaths)].sort()) {
    h.update(p);
    h.update("\0");
    h.update(fs.readFileSync(p));
  }
  return `sha256:${h.digest("hex")}`;
}
