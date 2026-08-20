# AGF Enterprise (Private Repo Template)

This repository is intended to stay private. It extends the public AGF
control-plane at runtime through `AGF_ENTERPRISE_MODULE`.

## Local usage

1. Install dependencies:
   - `npm install`
2. Build plugin:
   - `npm run build`
3. Start public control-plane with:
   - `AGF_ENTERPRISE_MODULE=/absolute/path/to/agf-enterprise/dist/control-plane-plugin.mjs npm run dev`

## Public dependency

`package.json` is preconfigured with a file dependency to the local public repo:

- `agf-control-plane-public`: `file:__PUBLIC_REPO_PATH__/control-plane`

In a real private setup, replace this with one of:

- a pinned git dependency to your public AGF mirror, or
- an internal package registry artifact of the public control-plane package.
