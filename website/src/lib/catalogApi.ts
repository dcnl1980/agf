/**
 * Same-origin catalog HTTP API (Phase B). In docker / Vite dev, nginx (or the dev server) proxies `/catalog` to catalog-api.
 * Override with `VITE_CATALOG_HTTP_BASE` when the index is hosted on another origin.
 */
const BASE = ((import.meta.env.VITE_CATALOG_HTTP_BASE as string | undefined) ?? "/catalog").replace(/\/$/, "");

export function catalogHttpPath(suffix: string): string {
  const s = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${BASE}${s}`;
}
