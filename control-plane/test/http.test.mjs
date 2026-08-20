import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";

const tempRoot = await mkdtemp(path.join(tmpdir(), "agf-control-plane-test-"));
process.env.NODE_ENV = "test";
process.env.CONTROL_PLANE_REQUEST_LOG = "0";
process.env.CONTROL_PLANE_DATA = path.join(tempRoot, "data");
process.env.SQLITE_PATH = path.join(tempRoot, "data", "control-plane.db");
process.env.CONTROL_PLANE_JWT_SECRET = "test-jwt-secret-value-1234567890";

const { createApp, validateStartupConfig } = await import("../src/index.js");

function makeRequest({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const payload = body ? String(body) : "";
  const req = Readable.from(payload ? [payload] : []);
  req.method = method;
  req.url = url;
  const hdrs = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  if (payload && hdrs["content-length"] == null) {
    hdrs["content-length"] = String(Buffer.byteLength(payload));
  }
  req.headers = hdrs;
  req.connection = { remoteAddress: "127.0.0.1" };
  req.socket = req.connection;
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;
  return req;
}

function makeResponse(resolve) {
  const headers = new Map();
  const chunks = [];
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  res.statusCode = 200;
  res.setHeader = (name, value) => {
    headers.set(String(name).toLowerCase(), value);
  };
  res.getHeader = (name) => headers.get(String(name).toLowerCase());
  res.removeHeader = (name) => headers.delete(String(name).toLowerCase());
  res.getHeaders = () => Object.fromEntries(headers);
  res.writeHead = (statusCode, maybeHeaders) => {
    res.statusCode = statusCode;
    if (maybeHeaders && typeof maybeHeaders === "object") {
      for (const [key, value] of Object.entries(maybeHeaders)) {
        res.setHeader(key, value);
      }
    }
    return res;
  };
  res.write = (chunk) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return true;
  };
  res.end = (chunk) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    resolve({
      statusCode: res.statusCode,
      headers: Object.fromEntries(headers),
      body: Buffer.concat(chunks).toString("utf8"),
    });
  };
  return res;
}

async function callApp(app, reqOpts) {
  return new Promise((resolve, reject) => {
    const req = makeRequest(reqOpts);
    const res = makeResponse(resolve);
    try {
      app.handle(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

test("protected routes require auth by default", async () => {
  delete process.env.CONTROL_PLANE_API_KEY;
  const { app } = await createApp();
  const res = await callApp(app, { url: "/api/v1/customers" });
  assert.equal(res.statusCode, 401);
});

test("legacy default-customer paths are disabled unless explicitly enabled", async () => {
  process.env.CONTROL_PLANE_API_KEY = "test-api-key-value-1234567890";
  const { app } = await createApp();
  const res = await callApp(app, {
    url: "/api/v1/dashboard/summary",
    headers: { Authorization: `Bearer ${process.env.CONTROL_PLANE_API_KEY}` },
  });
  assert.equal(res.statusCode, 404);
});

test("startup rejects production mode with insecure auth disabled", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevNoAuth = process.env.CONTROL_PLANE_ALLOW_INSECURE_NO_AUTH;
  process.env.NODE_ENV = "production";
  process.env.CONTROL_PLANE_ALLOW_INSECURE_NO_AUTH = "1";
  assert.throws(() => validateStartupConfig(), /authentication disabled in production/i);
  process.env.NODE_ENV = prevNodeEnv;
  if (prevNoAuth == null) {
    delete process.env.CONTROL_PLANE_ALLOW_INSECURE_NO_AUTH;
  } else {
    process.env.CONTROL_PLANE_ALLOW_INSECURE_NO_AUTH = prevNoAuth;
  }
});

test("startup rejects default JWT secret in production", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSecret = process.env.CONTROL_PLANE_JWT_SECRET;
  process.env.NODE_ENV = "production";
  process.env.CONTROL_PLANE_JWT_SECRET = "dev-docker-compose-change-in-prod-32ch";
  assert.throws(() => validateStartupConfig(), /default or weak value in production/i);
  process.env.NODE_ENV = prevNodeEnv;
  process.env.CONTROL_PLANE_JWT_SECRET = prevSecret;
});

test("CORS only allows configured origins", async () => {
  process.env.CONTROL_PLANE_CORS_ORIGINS = "https://allowed.example";
  const { app } = await createApp();
  const allowed = await callApp(app, {
    url: "/health",
    headers: { Origin: "https://allowed.example" },
  });
  assert.equal(allowed.headers["access-control-allow-origin"], "https://allowed.example");

  const blocked = await callApp(app, {
    url: "/health",
    headers: { Origin: "https://blocked.example" },
  });
  assert.equal(blocked.headers["access-control-allow-origin"], undefined);
  delete process.env.CONTROL_PLANE_CORS_ORIGINS;
});

test("auth rate limiter returns 429 after max requests", async () => {
  process.env.CONTROL_PLANE_AUTH_RATE_LIMIT_MAX = "3";
  process.env.CONTROL_PLANE_AUTH_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.CONTROL_PLANE_RATE_LIMIT_MAX = "1000";
  const { app } = await createApp();
  /** @type {number[]} */
  const codes = [];
  for (let i = 0; i < 4; i++) {
    const res = await callApp(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password-value" }),
    });
    codes.push(res.statusCode);
  }
  assert.ok(codes.slice(0, 3).every((c) => c === 401 || c === 400 || c === 503));
  assert.equal(codes[3], 429);
  delete process.env.CONTROL_PLANE_AUTH_RATE_LIMIT_MAX;
  delete process.env.CONTROL_PLANE_AUTH_RATE_LIMIT_WINDOW_MS;
  delete process.env.CONTROL_PLANE_RATE_LIMIT_MAX;
});

test("readiness probe succeeds when DB is open", async () => {
  process.env.CONTROL_PLANE_API_KEY = "test-api-key-value-1234567890";
  const { app } = await createApp();
  const res = await callApp(app, { url: "/ready" });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /"ready"/);
});

  process.env.CONTROL_PLANE_API_KEY = "test-api-key-value-1234567890";
  const { app } = await createApp();
  const auth = { Authorization: `Bearer ${process.env.CONTROL_PLANE_API_KEY}` };
  const org = await callApp(app, {
    method: "POST",
    url: "/api/v1/customers",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ id: "cust_agents_test", name: "Agents test org" }),
  });
  assert.equal(org.statusCode, 201);

  const created = await callApp(app, {
    method: "POST",
    url: "/api/v1/customers/cust_agents_test/agents",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      agent_name: "payments-orchestrator",
      org_id: "org_finops",
      metadata: { framework: "temporal" },
      channels: ["api", "temporal"],
    }),
  });
  assert.equal(created.statusCode, 201);
  const createdBody = JSON.parse(created.body);
  assert.ok(createdBody.agent_id.startsWith("agt_"));
  assert.equal(createdBody.status, "active");

  const listed = await callApp(app, {
    url: "/api/v1/customers/cust_agents_test/agents",
    headers: auth,
  });
  assert.equal(listed.statusCode, 200);
  const listBody = JSON.parse(listed.body);
  assert.ok(listBody.items.some((a) => a.agentId === createdBody.agent_id));

  const deactivated = await callApp(app, {
    method: "POST",
    url: `/api/v1/customers/cust_agents_test/agents/${createdBody.agent_id}/deactivate`,
    headers: auth,
  });
  assert.equal(deactivated.statusCode, 200);
  assert.equal(JSON.parse(deactivated.body).status, "inactive");
});

test.after(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});
