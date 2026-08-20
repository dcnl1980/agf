/**
 * Lightweight in-process sliding-window rate limiter for Express.
 * Suitable for single-instance deployments; use an edge/gateway limiter for multi-replica prod.
 */

/**
 * @typedef {object} RateLimitOptions
 * @property {number} [windowMs]
 * @property {number} [max]
 * @property {(req: import("express").Request) => string} [keyFn]
 * @property {string} [message]
 */

/**
 * @param {RateLimitOptions} [opts]
 */
export function createRateLimiter(opts = {}) {
  const windowMs = Number.isFinite(opts.windowMs) && opts.windowMs > 0 ? opts.windowMs : 60_000;
  const max = Number.isFinite(opts.max) && opts.max > 0 ? opts.max : 120;
  const keyFn =
    typeof opts.keyFn === "function"
      ? opts.keyFn
      : (req) => {
          const xf = req.headers["x-forwarded-for"];
          if (typeof xf === "string" && xf.trim()) {
            return xf.split(",")[0].trim();
          }
          return req.ip || req.socket?.remoteAddress || "unknown";
        };
  const message = opts.message || "rate_limit_exceeded";

  /** @type {Map<string, number[]>} */
  const hits = new Map();

  /**
   * @param {import("express").Request} req
   * @param {import("express").Response} res
   * @param {import("express").NextFunction} next
   */
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = keyFn(req);
    const windowStart = now - windowMs;
    let stamps = hits.get(key) || [];
    stamps = stamps.filter((t) => t > windowStart);
    if (stamps.length >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      return res.status(429).json({ error: message });
    }
    stamps.push(now);
    hits.set(key, stamps);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - stamps.length)));
    return next();
  };
}

/**
 * Parse env-backed limits with sane defaults.
 * Auth routes get a stricter bucket; general API uses a higher one.
 */
export function buildRateLimitMiddlewareFromEnv() {
  const disabled =
    process.env.CONTROL_PLANE_RATE_LIMIT === "0" ||
    process.env.CONTROL_PLANE_DISABLE_RATE_LIMIT === "1";
  if (disabled) {
    return {
      api: (_req, _res, next) => next(),
      auth: (_req, _res, next) => next(),
    };
  }

  const apiWindowMs = Number(process.env.CONTROL_PLANE_RATE_LIMIT_WINDOW_MS) || 60_000;
  const apiMax = Number(process.env.CONTROL_PLANE_RATE_LIMIT_MAX) || 120;
  const authWindowMs = Number(process.env.CONTROL_PLANE_AUTH_RATE_LIMIT_WINDOW_MS) || 60_000;
  const authMax = Number(process.env.CONTROL_PLANE_AUTH_RATE_LIMIT_MAX) || 20;

  return {
    api: createRateLimiter({ windowMs: apiWindowMs, max: apiMax }),
    auth: createRateLimiter({
      windowMs: authWindowMs,
      max: authMax,
      message: "auth_rate_limit_exceeded",
    }),
  };
}
