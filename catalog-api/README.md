# Catalog HTTP API (Phase B)

Read-only JSON index over `catalog/community-catalog.json`. Same contract as [docs/RULESET_MARKETPLACE.md](../docs/RULESET_MARKETPLACE.md) Phase B.

## Run locally

```bash
cd catalog-api && npm start
# or: node server.mjs
```

Optional: `AGF_CATALOG_JSON=/path/to/community-catalog.json`, `PORT=4055`, `AGF_CATALOG_CORS=1` for `Access-Control-Allow-Origin: *`.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness JSON |
| GET | `/v1/entries` | List entries; query: `q`, `tag`, `jurisdiction` |
| GET | `/v1/entries/:id` | One listing (URL-encode `id`) |
| GET | `/v1/entries/:id/versions` | Version rows for that listing |
| GET | `/v1/catalog` | Raw catalog file (mirrors JSON on disk) |

In docker compose, the website nginx proxies **`/catalog/`** to this service, so from the browser use e.g. `GET /catalog/v1/entries` on the website origin.
