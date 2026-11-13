#!/usr/bin/env bash
set -euo pipefail

EXPECTED_SHA256="b550a89b9f642c8c90ac48f1d21038d2f118ff4fb9a192c976140a79b6acf403"
ZIP_PATH="${1:-NewDemo-Integrated-Milestone3.zip}"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Run this script from inside a clone of JoeyPR/Demo." >&2
  exit 1
}
cd "$REPO_ROOT"

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "overhaul" ]]; then
  echo "Refusing to import on '$BRANCH'. Switch to branch 'overhaul' first." >&2
  exit 1
fi

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Archive not found: $ZIP_PATH" >&2
  echo "Download NewDemo-Integrated-Milestone3.zip and pass its path as argument." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(sha256sum "$ZIP_PATH" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')"
else
  echo "Need sha256sum or shasum to verify the archive." >&2
  exit 1
fi

if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo "Archive checksum mismatch; refusing to import." >&2
  echo "Expected: $EXPECTED_SHA256" >&2
  echo "Actual:   $ACTUAL_SHA256" >&2
  exit 1
fi

TARGET="$REPO_ROOT/NewDemo-integrated"
if [[ -e "$TARGET" ]]; then
  echo "Target already exists: $TARGET" >&2
  echo "Move it aside or review it before importing; nothing was overwritten." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
unzip -q "$ZIP_PATH" -d "$TMP_DIR"

SOURCE="$TMP_DIR/NewDemo-integrated"
if [[ ! -d "$SOURCE" ]]; then
  echo "Expected archive root NewDemo-integrated/ was not found." >&2
  exit 1
fi

FILE_COUNT="$(find "$SOURCE" -type f | wc -l | tr -d ' ')"
if [[ "$FILE_COUNT" != "6300" ]]; then
  echo "Unexpected extracted file count: $FILE_COUNT (expected 6300)." >&2
  exit 1
fi

cp -a "$SOURCE" "$TARGET"
git add -- NewDemo-integrated
git commit -m "Import NewDemo integrated Milestone 3"
git push -u origin overhaul

echo "Milestone 3 source imported, committed, and pushed to origin/overhaul."
