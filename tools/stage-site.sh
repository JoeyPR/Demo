#!/usr/bin/env bash
# Stage the static site (index.html + demo/ without tests/QA files) into ../site for hosting. Run from the repo root.
set -e
OUT="${1:-../site}"
rm -rf "$OUT" && mkdir -p "$OUT/demo"
cp index.html "$OUT/"
rsync -a --exclude test --exclude tools --exclude 'QA_*' --exclude 'qa-*' demo/ "$OUT/demo/"
du -sh "$OUT"
