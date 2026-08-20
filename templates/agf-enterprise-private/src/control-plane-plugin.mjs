/**
 * Enterprise extension entrypoint loaded by AGF_ENTERPRISE_MODULE.
 * The public control plane passes { app, express, getDb, env }.
 */
export async function registerControlPlaneExtensions(ctx) {
  const { app } = ctx;

  app.get("/api/v1/enterprise/health", (_req, res) => {
    res.json({
      status: "ok",
      tier: "enterprise",
      service: "agf-enterprise-extension",
    });
  });
}

export default registerControlPlaneExtensions;
