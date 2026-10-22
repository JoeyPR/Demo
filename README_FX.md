# FX + punch wiring (added on top of the Perplexity demo)

New modules (src/ and mirrored in demo/engine/):
- `fx-engine.mjs` – particle engine (0.033s tick, emitters, trails, orbit, beams, additive) run from compiled XML renderer data.
- `xml-particles.mjs` – `XmlParticleLayer`: runs the engine per equipped item, returns world-space draw calls (`fxEngine:true`).
- `punch-data.mjs` – applies official `punch_options` (up_face, up_arm1/2, RFA_HIDEITEM) while punching.

Data: `demo/fx-data.json` (314 scripts, includes VariableMap), `demo/punch-data.json` (981 items: reconstructed class RP-### + confidence; 58 carry official punch_options), `demo/assets/particles*.png` (31 official atlases).

Hooks: `PlannerPlayer` builds the layer, skips the legacy `particleRuns` for handled items (`item.skipLegacyParticles`), and `step(..., {xmlParticles:false, punchData:false})` turns each off.

Known gaps: RP-### ids are our own numbering, not official IDs; "low" confidence classes only group items by shared baked fields. ~247/924 particle systems did not emit in the sweep (event/state dependent). Arcane Armor ground-slam placement unverified. op_particle1/2 ids are carried as data but not yet mapped to particle XML (table not available). Hide-item removes the held item's draw calls only.
Tests: `npm test` (85 pass, incl. test/xml-particles.test.mjs).
