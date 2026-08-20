import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import {
  countUsers,
  getUserByEmail,
  getMembershipsForUser,
  insertUserRecord,
  upsertOrgMembership,
  getUserById,
  getCustomerById,
  createCustomer,
  getOrgInviteByRawToken,
  markOrgInviteAccepted,
  DEFAULT_CUSTOMER_ID,
} from "./db.js";

const ROUNDS = 12;

/**
 * @param {string} plain
 */
export function hashPassword(plain) {
  return bcrypt.hashSync(plain, ROUNDS);
}

/**
 * @param {string} plain
 * @param {string} hash
 */
export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {{ id: string, email: string, memberships: { customerId: string, role: string, createdAt: string }[] } | null}
 */
export function verifyUserPassword(email, password) {
  const u = getUserByEmail(email);
  if (!u) {
    return null;
  }
  if (!verifyPassword(password, u.password_hash)) {
    return null;
  }
  const mem = getMembershipsForUser(u.id);
  return {
    id: u.id,
    email: u.email,
    memberships: mem,
  };
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} customerId
 * @param {string} role
 */
export function createUserInOrg(email, password, customerId, role) {
  const u = getUserByEmail(email);
  if (u) {
    throw new Error("email already registered");
  }
  const id = `usr_${randomUUID()}`;
  const h = hashPassword(password);
  const em = String(email).toLowerCase().trim();
  insertUserRecord(id, em, h);
  upsertOrgMembership(id, customerId, role);
  return { id, email: em, customerId, role };
}

/**
 * If env bootstrap is set and `users` is empty, create an admin for `DEFAULT_CUSTOMER_ID` / env customer.
 */
export function tryBootstrapUserFromEnv() {
  const email = process.env.CONTROL_PLANE_BOOTSTRAP_EMAIL;
  const pass = process.env.CONTROL_PLANE_BOOTSTRAP_PASSWORD;
  if (!email || !pass) {
    return;
  }
  if (countUsers() > 0) {
    return;
  }
  const cust = process.env.CONTROL_PLANE_BOOTSTRAP_CUSTOMER || DEFAULT_CUSTOMER_ID;
  try {
    if (!getCustomerById(cust)) {
      const customerName = process.env.CONTROL_PLANE_BOOTSTRAP_CUSTOMER_NAME || "Bootstrap customer";
      createCustomer(cust, customerName);
    }
    const out = createUserInOrg(String(email), String(pass), cust, "admin");
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] created admin user ${out.email} in ${cust}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[bootstrap] failed", e instanceof Error ? e.message : e);
  }
}

/**
 * Join org from invite. Creates user with `password` if email is new, else verifies password and adds/updates membership.
 * @param {string} rawToken
 * @param {string} password
 */
export function completeOrgInvite(rawToken, password) {
  const inv = getOrgInviteByRawToken(rawToken);
  if (!inv) {
    throw new Error("invalid_or_expired_invite");
  }
  const email = String(inv.email).toLowerCase().trim();
  const em = getUserByEmail(email);
  if (em) {
    if (!verifyPassword(password, em.password_hash)) {
      throw new Error("invalid_password");
    }
    upsertOrgMembership(em.id, inv.customer_id, inv.role);
  } else {
    const id = `usr_${randomUUID()}`;
    const h = hashPassword(password);
    insertUserRecord(id, email, h);
    upsertOrgMembership(id, inv.customer_id, inv.role);
  }
  markOrgInviteAccepted(inv.id);
  const u = getUserByEmail(email);
  if (!u) {
    throw new Error("accept_failed");
  }
  return { id: u.id, email: u.email, memberships: getMembershipsForUser(u.id) };
}

export { getUserById, getUserByEmail, getMembershipsForUser, countUsers };
