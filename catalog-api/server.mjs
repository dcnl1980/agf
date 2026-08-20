#!/usr/bin/env node
/**
 * Read-only HTTP index for the community ruleset catalog (Phase B).
 * Serves the same data as `catalog/community-catalog.json` with optional search filters.
 */
import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.CATALOG_API_PORT || 4055);
const CATALOG_JSON =
  process.env.AGF_CATALOG_JSON || path.join(__dirname, "..", "catalog", "community-catalog.json");
const CORS = process.env.AGF_CATALOG_CORS === "1";

let cache = { mtimeMs: 0, parsed: null };

function loadCatalog() {
  const st = fs.statSync(CATALOG_JSON);
  if (!cache.parsed || st.mtimeMs !== cache.mtimeMs) {
    const raw = fs.readFileSync(CATALOG_JSON, "utf8");
    cache = { mtimeMs: st.mtimeMs, parsed: JSON.parse(raw) };
  }
  return cache.parsed;
}

function setCors(res) {
  if (CORS) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept");
  }
}

/**
 * @param {import("http").ServerResponse} res
 * @param {number} code
 * @param {unknown} body
 */
function sendJson(res, code, body) {
  setCors(res);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.statusCode = code;
  res.end(JSON.stringify(body));
}

function filterEntries(catalog, q) {
  let items = catalog.entries || [];
  const text = (q.get("q") || "").trim().toLowerCase();
  const tag = (q.get("tag") || "").trim().toLowerCase();
  const juri = (q.get("jurisdiction") || "").trim().toLowerCase();
  if (text) {
    items = items.filter((e) => {
      const blob = [e.id, e.summary, e.maintainer, e.license, ...(e.tags || []), ...(e.jurisdiction || [])]
        .join(" ")
        .toLowerCase();
      return blob.includes(text);
    });
  }
  if (tag) {
    items = items.filter((e) => (e.tags || []).some((t) => String(t).toLowerCase() === tag));
  }
  if (juri) {
    items = items.filter((e) => (e.jurisdiction || []).some((t) => String(t).toLowerCase() === juri));
  }
  return items;
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS" && CORS) {
    setCors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    setCors(res);
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const p = url.pathname;
  if (p === "/health") {
    setCors(res);
    res.setHeader("content-type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true, service: "agf-catalog-api" }));
  }
  let catalog;
  try {
    catalog = loadCatalog();
  } catch (e) {
    return sendJson(res, 500, {
      error: "catalog_unreadable",
      message: e instanceof Error ? e.message : String(e),
    });
  }
  if (p === "/v1/entries") {
    const items = filterEntries(catalog, url.searchParams);
    return sendJson(res, 200, {
      catalogVersion: catalog.catalogVersion,
      generatedAt: catalog.generatedAt,
      items,
    });
  }
  if (p === "/v1/catalog") {
    setCors(res);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=60");
    return res.end(fs.readFileSync(CATALOG_JSON, "utf8"));
  }
  const prefix = "/v1/entries/";
  if (p.startsWith(prefix)) {
    const rest = p.slice(prefix.length);
    if (rest.endsWith("/versions")) {
      const id = decodeURIComponent(rest.slice(0, -"/versions".length));
      const entry = (catalog.entries || []).find((e) => e.id === id);
      if (!entry) {
        return sendJson(res, 404, { error: "not_found", id });
      }
      return sendJson(res, 200, { publicBundleId: entry.id, versions: entry.versions || [] });
    }
    const id = decodeURIComponent(rest);
    const entry = (catalog.entries || []).find((e) => e.id === id);
    if (!entry) {
      return sendJson(res, 404, { error: "not_found", id });
    }
    return sendJson(res, 200, entry);
  }
  sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`agf-catalog-api listening on :${PORT} (catalog: ${CATALOG_JSON})`);
});
