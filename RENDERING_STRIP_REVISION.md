# Rendering strip / world-preservation handoff

Base: `9ac9f16df6a2812e0203184aeace5addf01d50e8`

This revision disconnects the active player/wearable rendering pipeline from the root planner runtime. It intentionally does not delete the old research and renderer source modules; they remain dormant reference material for the next implementation phase.

## Retained systems

- The preview element and its canvas sizing, camera zoom, and frame loop.
- The Weather picker and animated weather renderer.
- The Land picker, terrain tile drawing, editable world grid, and real `WorldMotion` tile collision.
- Movement and punch input through the existing on-screen pads and keyboard mappings.
- Inventory catalog, equipment state, filters, favorites, icons, wrench metadata, and UI.
- Drop confirmation, dropped pickup boxes, stack labels, pickup collection collision/timing, and return-to-inventory behavior.

Land is not a decorative strip. `WorldMotion` continues to resolve horizontal collision and vertical landing against the selected foreground tile grid. The feet snap to the top of a solid tile. That world model is preserved as the foundation for the future player renderer.

## Disconnected rendering

The root planner no longer creates a `PlannerPlayer`, loads wearable atlases, resolves avatar draw calls, rasterizes clothing/body sprites, or runs player shadow, pet, ancestral aura, particle, and plate-on-canvas passes. The invisible simulation actor still advances so movement, camera tracking, world collision, and pickup collection remain functional while the player renderer is rebuilt.

Inventory icons and Drop visuals are retained because they belong to the inventory/Drop UI contracts. Terrain and weather drawing are also retained as explicitly requested.

## Paradise City weather

The checked-in Demo snapshot contains `data/variants/base/paradise-city.json` but omits all six `bg_pc_*.webp` files referenced by that config. The supplied `real-setplanner.zip` contains the six original files under `setplanner/site/weather/sheets/`. The weather loader now retries only failed `bg_pc_*` sheet loads against `https://setplannergt.com/weather/sheets/`; all other weather paths keep their existing local-only behavior.

## Validation

- A focused regression test verifies all six Paradise sheets retry through the original asset path and that non-Paradise missing sheets do not use that fallback.
- Existing world-motion, Drop, preview, inventory, and weather tests remain in place and are expected to run in the repository's Node test suite.
- Browser interaction QA is still required for visual confirmation on the deployed preview.
