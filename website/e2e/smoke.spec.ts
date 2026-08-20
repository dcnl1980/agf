import { test, expect } from "@playwright/test";

const apiBase = process.env.AGF_E2E_API_URL || "http://127.0.0.1:4046";
const e2eEmail = process.env.AGF_E2E_EMAIL || "e2e@agf.local";
const e2ePassword = process.env.AGF_E2E_PASSWORD || "e2e-test-password-16ch";

test.describe("public surfaces", () => {
  test("home page renders brand and hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/AI Governance Control Plane/i);
    await expect(page.getByText(/Agentic AI Trust Platform/i).first()).toBeVisible();
  });

  test("marketplace page loads catalog entries via proxy", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: /Community ruleset catalog/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("login page renders sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign-in/i })).toBeVisible();
    await expect(page.locator("#cp-email")).toBeVisible();
    await expect(page.locator("#cp-pw")).toBeVisible();
  });
});

test.describe("API health", () => {
  test("control plane ready and metrics", async ({ request }) => {
    const ready = await request.get(`${apiBase}/ready`);
    expect(ready.ok()).toBeTruthy();
    const metrics = await request.get(`${apiBase}/metrics`);
    expect(metrics.ok()).toBeTruthy();
    expect(await metrics.text()).toContain("agf_control_plane_up 1");
  });

  test("website proxies public config", async ({ request }) => {
    const res = await request.get("/api/v1/public/config");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toHaveProperty("jwtSigningConfigured");
  });
});

test.describe("authenticated dashboard", () => {
  test("login then see dashboard KPIs and agent registry", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#cp-email").fill(e2eEmail);
    await page.locator("#cp-pw").fill(e2ePassword);
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.getByText(/Agent registry/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Recent decisions|Pending approvals|AGF kernel/i).first()).toBeVisible();
  });
});
