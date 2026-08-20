# Contributing to AGF

Thanks for helping improve AGF.

## Development setup

1. Clone the repository.
2. Copy `/Users/cvsteenbergen/Code/agf/.env.example` to `.env`.
3. Start the local stack:
   - `docker compose up -d --build`
4. For local app development:
   - Control plane: `cd control-plane && npm install && npm run dev`
   - Website: `cd website && npm install && npm run dev`

## Pull requests

- Keep changes focused and scoped to one logical topic.
- Include tests or verification steps for behavior changes.
- Update docs when behavior, endpoints, or configuration changes.
- Never commit secrets, customer data, or `.env` values.

## Community catalog contributions

For marketplace ruleset listings, use the canonical catalog under:

- `/Users/cvsteenbergen/Code/agf/catalog/community-catalog.json`
- `/Users/cvsteenbergen/Code/agf/catalog/community-catalog.schema.json`

Before opening a PR for a listing:

1. Validate ARSL files:
   - `cargo run --manifest-path /Users/cvsteenbergen/Code/agf/agf-sp1/script/Cargo.toml --bin arsl-validate -- --file /Users/cvsteenbergen/Code/agf/agf-sp1/rules/<path>.arsl.toml`
2. Compute digest using the same logic as control-plane publish:
   - `node /Users/cvsteenbergen/Code/agf/scripts/marketplace-compute-digest.mjs --rule-file rules/<path>.arsl.toml`
3. Update the catalog entry and ensure schema validation passes in CI.

See `/Users/cvsteenbergen/Code/agf/catalog/README.md` for naming conventions and checklist details.

## Sign-off policy (DCO)

AGF uses the Developer Certificate of Origin (DCO) for incoming contributions.
Each commit must include a sign-off line:

`Signed-off-by: Full Name <email@example.com>`

Use:

`git commit -s -m "your message"`

This certifies that you have the right to submit the contribution under the project license.

## Code of conduct

By participating, you agree to collaborate respectfully and constructively.
