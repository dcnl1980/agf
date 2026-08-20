import * as jose from "jose";

/** @type {() => boolean} */
let _usersExist = () => false;

function getDashboardPasswordValue() {
  return process.env.CONTROL_PLANE_DASHBOARD_PASSWORD || "";
}

function getJwtSecretValue() {
  return process.env.CONTROL_PLANE_JWT_SECRET || "";
}

function getPlatformAdmins() {
  return (process.env.CONTROL_PLANE_PLATFORM_ADMINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Call after DB open: `setUsersExistCheck(() => countUsers() > 0)` so JWT login is required once users exist.
 * @param {() => boolean} fn
 */
export function setUsersExistCheck(fn) {
  _usersExist = fn;
}

export function getApiKey() {
  return process.env.CONTROL_PLANE_API_KEY || "";
}

export function parseRoles() {
  const s = process.env.CONTROL_PLANE_ROLES || "admin,policy_author,approver,viewer";
  return s
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * @param {string | undefined} email
 */
export function isPlatformAdminEmail(email) {
  const admins = getPlatformAdmins();
  if (!email || !admins.length) {
    return false;
  }
  return admins.includes(String(email).toLowerCase().trim());
}

export function needsStrictAuth() {
  if (process.env.CONTROL_PLANE_REQUIRE_AUTH === "1") {
    return true;
  }
  if (process.env.CONTROL_PLANE_REQUIRE_AUTH === "0") {
    return false;
  }
  if (process.env.CONTROL_PLANE_ALLOW_INSECURE_NO_AUTH === "1") {
    return false;
  }
  return true;
}

export function isDashboardPasswordConfigured() {
  return Boolean(getDashboardPasswordValue());
}

export function isJwtSecretConfigured() {
  return Boolean(getJwtSecretValue());
}

/**
 * @param {string} password
 */
export function verifyDashboardPassword(password) {
  const configured = getDashboardPasswordValue();
  if (!configured) {
    return false;
  }
  return password === configured;
}

/**
 * Legacy single-password JWT (v1) — all roles from env in one token.
 * @returns {Promise<string>}
 */
export async function signDashboardJwt() {
  const jwtSecret = getJwtSecretValue();
  if (!jwtSecret) {
    throw new Error("CONTROL_PLANE_JWT_SECRET is not set");
  }
  const secret = new TextEncoder().encode(jwtSecret);
  const roles = parseRoles();
  return new jose
    .SignJWT({ ver: 1, roles })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject("control-plane-legacy")
    .setExpirationTime(process.env.CONTROL_PLANE_JWT_TTL || "8h")
    .sign(secret);
}

/**
 * Per-user / multi-org token (v2).
 * @param {object} p
 * @param {string} p.sub
 * @param {string} p.email
 * @param {{ customerId: string, role: string, createdAt?: string }[]} p.memberships
 * @param {{ expiresIn?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function signUserJwt(p, opts) {
  const jwtSecret = getJwtSecretValue();
  if (!jwtSecret) {
    throw new Error("CONTROL_PLANE_JWT_SECRET is not set");
  }
  const secret = new TextEncoder().encode(jwtSecret);
  const exp = opts?.expiresIn || process.env.CONTROL_PLANE_ACCESS_JWT_TTL || process.env.CONTROL_PLANE_JWT_TTL || "15m";
  return new jose
    .SignJWT({
      ver: 2,
      sub: p.sub,
      email: p.email,
      memberships: p.memberships.map((m) => ({
        c: m.customerId,
        r: m.role,
      })),
    })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(p.sub)
    .setExpirationTime(exp)
    .sign(secret);
}

/**
 * @param {string | undefined} token
 * @returns {Promise<{
 *   kind: "apikey_compat" | "legacy" | "user";
 *   sub?: string;
 *   email?: string;
 *   roles: string[];
 *   memberships: { customerId: string, role: string }[];
 * } | null>}
 */
export async function verifyBearerJwt(token) {
  const jwtSecret = getJwtSecretValue();
  if (!token || !jwtSecret) {
    return null;
  }
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(jwtSecret));
    const ver = /** @type {unknown} */ (payload.ver);
    if (ver === 2) {
      const mraw = /** @type {unknown} */ (payload.memberships);
      const list = Array.isArray(mraw) ? mraw : [];
      const memberships = [];
      for (const it of list) {
        if (it && typeof it === "object" && "c" in it && "r" in it) {
          const o = /** @type {Record<string, unknown>} */ (it);
          memberships.push({ customerId: String(o.c), role: String(o.r) });
        }
      }
      return {
        kind: "user",
        sub: String(payload.sub || ""),
        email: typeof payload.email === "string" ? payload.email : undefined,
        roles: [],
        memberships,
      };
    }
    const raw = /** @type {unknown} */ (payload.roles);
    const roles = Array.isArray(raw) ? raw.map(String) : raw != null ? [String(raw)] : [];
    return { kind: "legacy", roles, memberships: [] };
  } catch {
    return null;
  }
}

/**
 * @param {string[]} allowed
 * @param {string | null | undefined} customerId from route
 */
function memberSatisfies(/** @type {{ role: string }} */ m, allowed) {
  if (m.role === "admin") {
    return true;
  }
  for (const a of allowed) {
    if (m.role === a) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} user from req.user
 * @param {string[]} allowed
 * @param {string | null | undefined} customerId
 */
export function hasAnyRole(user, allowed, customerId) {
  if (!user || typeof user !== "object") {
    return false;
  }
  if ("viaApiKey" in user && user.viaApiKey) {
    return true;
  }
  const u = /** @type {Record<string, unknown>} */ (user);
  if (u.kind === "user" && typeof u.email === "string" && isPlatformAdminEmail(u.email)) {
    return true;
  }
  if (u.kind === "user" && Array.isArray(u.memberships)) {
    const subs = /** @type {{ customerId: string, role: string }[]} */ (u.memberships);
    if (customerId) {
      const m = subs.find((x) => x.customerId === customerId);
      if (!m) {
        return false;
      }
      return memberSatisfies(m, allowed);
    }
    if (subs.length === 0) {
      return false;
    }
    return subs.some((m) => memberSatisfies(m, allowed));
  }
  const roles = /** @type {string[]} */ (Array.isArray(u.roles) ? u.roles : []);
  if (roles.includes("admin")) {
    return true;
  }
  for (const a of allowed) {
    if (roles.includes(a)) {
      return true;
    }
  }
  return false;
}
