import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src", "control-plane-plugin.mjs");
const outDir = path.join(root, "dist");
const out = path.join(outDir, "control-plane-plugin.mjs");

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(src, out);
console.log(`Built enterprise plugin: ${out}`);
