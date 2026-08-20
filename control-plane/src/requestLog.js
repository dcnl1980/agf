/**
 * Minimal structured JSON request logging (no PII in default fields).
 */

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function structuredRequestLog(req, res, next) {
  if (process.env.CONTROL_PLANE_REQUEST_LOG === "0") {
    return next();
  }
  const start = Date.now();
  if (req.path === "/health" || req.path === "/ready") {
    return next();
  }
  res.on("finish", () => {
    const line = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      msg: "http_request",
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      requestId: req.headers["x-request-id"] || undefined,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  });
  return next();
}
