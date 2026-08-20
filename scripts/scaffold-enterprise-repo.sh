#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$ROOT/templates/agf-enterprise-private"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 /absolute/path/to/agf-enterprise" >&2
  exit 1
fi

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "Template not found: $TEMPLATE_DIR" >&2
  exit 1
fi

if [[ -e "$TARGET" ]]; then
  echo "Target already exists: $TARGET" >&2
  exit 1
fi

mkdir -p "$TARGET"
cp -R "$TEMPLATE_DIR"/. "$TARGET"

PUBLIC_REPO="$ROOT"
if command -v python3 >/dev/null 2>&1; then
  python3 - "$TARGET" "$PUBLIC_REPO" <<'PY'
import pathlib
import sys

target = pathlib.Path(sys.argv[1])
public_repo = sys.argv[2]

for path in target.rglob("*"):
    if path.is_file():
        data = path.read_text(encoding="utf-8")
        data = data.replace("__PUBLIC_REPO_PATH__", public_repo)
        path.write_text(data, encoding="utf-8")
PY
else
  echo "python3 not found; placeholders were not replaced" >&2
fi

echo "Private enterprise repo scaffolded at: $TARGET"
echo "Next:"
echo "  1) cd \"$TARGET\""
echo "  2) npm install"
echo "  3) npm run build"
