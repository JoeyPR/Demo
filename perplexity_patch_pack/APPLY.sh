#!/usr/bin/env bash
# Run from the ROOT of the growtopia-rendering-handoff repo, with this pack unzipped next to it (or inside it).
set -e
PACK="${1:-./perplexity_patch_pack}"
cp "$PACK"/src/*.mjs src/ ; cp "$PACK"/test/*.mjs test/ ; cp "$PACK"/tools/*.mjs tools/ ; cp "$PACK"/evidence/xml-coverage.json evidence/
patch -p1 < "$PACK"/xml-renderer.patch
patch -p1 < "$PACK"/demo-test-paths.patch
# demo/engine is a byte-for-byte mirror of src/ : keep it that way
cp src/*.mjs demo/engine/
npm test
(cd demo && node --test test/*.test.mjs)
node tools/xml-coverage.mjs evidence/renderer-data.json
