#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$ROOT/website/public"
exec pandoc "$ROOT/docs/WHITEPAPER.md" \
  --resource-path="$ROOT/docs/pandoc" \
  -d "$ROOT/docs/pandoc/whitepaper-pdf.yaml" \
  -o "$ROOT/website/public/agf-whitepaper-v1.pdf"
