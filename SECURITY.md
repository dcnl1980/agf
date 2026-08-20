# Security Policy

## Supported versions

Security fixes are accepted for the current `main` line of this community repository (kernel, control plane, website, catalog). Older tags are best-effort only.

## Reporting a vulnerability

Please **do not** open a public GitHub/GitLab issue for security-sensitive reports.

Email or message the maintainers privately with:

- affected component (`agf-sp1`, `control-plane`, `website`, `catalog-api`, deploy manifests)
- description and impact
- reproduction steps or proof of concept (non-destructive preferred)
- any suggested remediation

If a dedicated security contact is published later for this forge, prefer that channel.

We aim to acknowledge reports within a few business days and coordinate disclosure after a fix is available.

## Hardening expectations (operators)

When deploying beyond local development:

- Set a strong `CONTROL_PLANE_JWT_SECRET` (≥32 chars, non-default) and/or `CONTROL_PLANE_API_KEY`.
- Do **not** enable `CONTROL_PLANE_ALLOW_INSECURE_NO_AUTH`, `CONTROL_PLANE_SKIP_ARSL_VALIDATE`, or `*_DEV` token-echo flags in production.
- Terminate TLS at the edge; keep control plane and kernel off the public internet where possible.
- Configure `CONTROL_PLANE_CORS_ORIGINS` explicitly when the API is cross-origin.
- Leave rate limiting enabled (default). Tune via `CONTROL_PLANE_RATE_LIMIT_*` / `CONTROL_PLANE_AUTH_RATE_LIMIT_*`, or disable only behind a trusted gateway with `CONTROL_PLANE_RATE_LIMIT=0`.
- Rotate MinIO/S3 credentials; never ship `.env` with real secrets.

## Scope notes

- Kernel TEE attestation in this repo may still be **mock** depending on deployment profile; treat hardware attestation as a separate production gate.
- Enterprise SSO/IdP and advanced audit sinks live outside this community tree via `AGF_ENTERPRISE_MODULE` or private distributions.
