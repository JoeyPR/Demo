import { itemRendererLoaders, worldRendererLoaders, loadRenderer } from "../renderer-modules/registry.mjs";
import { sampleSpriteTrack, sampleCurve } from "../runtime/sequence.mjs";
import { createRendererAdapter } from "../templates/renderer-adapter.mjs";
import assert from "node:assert/strict";

let loaded = 0;
for (const [name, load] of Object.entries({ ...itemRendererLoaders, ...worldRendererLoaders })) {
  const mod = await load();
  const r = mod.renderer ?? mod.default;
  assert.equal(r._meta.name, name, `metadata name mismatch for ${name}`);
  assert.ok(r.sourceTree?.tag, `missing sourceTree for ${name}`);
  assert.ok(r.rules && Array.isArray(r.animations) && Array.isArray(r.particles) && Array.isArray(r.machines), `missing compiled fields for ${name}`);
  loaded++;
}
assert.equal(loaded, 347, "expected all 347 XML modules");

const cape = await loadRenderer("CrepeCape");
const sampled0 = sampleSpriteTrack(cape, "s_Cape", 0, 0, { Action: "JumpStraight" });
const sampled100 = sampleSpriteTrack(cape, "s_Cape", 100, 0, { Action: "JumpStraight" });
assert.deepEqual(sampled0.cell, [0,12]);
assert.deepEqual(sampled100.cell, [1,12]);

const shoes = await loadRenderer("SpringLoadedShoes");
const offsetTrack = shoes.animations.find(x => x.tag === "CurveAnimationFloat" && x.a?.name === "a_Offset");
const curve = offsetTrack?.c?.find(x => x.tag === "Curve");
assert.ok(curve, "SpringLoadedShoes offset curve missing");
assert.deepEqual(sampleCurve(curve, 0.5), [-18]);

const wings = await loadRenderer("EclipseWings");
const originalFrameList = wings.animations.find(x => x.a?.name === "a_wings").c.filter(x => x.tag === "Frame").map(x => x.v);
const adapted = createRendererAdapter(wings, {
  name: "EclipseWingsTestAdapter",
  spriteAliases: { s_wings: "s_altWings" },
  atlasAliases: { "particles_large17.png": "test-atlas.png" },
  frameOverrides: { s_altWings: "0,0" },
  trackFrames: { a_wings: [[0,0], [1,0], [2,0], [3,0]] },
  offset: [1,2],
  passOverrides: { RenderBackpack: "RenderInFront" }
});
assert.equal(adapted.sprites.s_altWings.atlas, "test-atlas.png");
assert.equal(adapted.sprites.s_altWings.frame, "0,0");
const track = adapted.animations.find(x => x.a?.name === "a_wings");
assert.equal(track.a.sprite, "s_altWings");
assert.deepEqual(track.c.filter(x => x.tag === "Frame").map(x => x.v), ["0,0", "1,0", "2,0", "3,0"]);
assert.deepEqual(wings.animations.find(x => x.a?.name === "a_wings").c.filter(x => x.tag === "Frame").map(x => x.v), originalFrameList, "adapter must not mutate base renderer");
assert.ok(adapted.rules.c.some(x => x.tag === "RenderInFront"));
const leftEmitter = adapted.particles.find(x => x.a?.name === "ps_wingsLeft")?.c.find(x => x.tag === "Emitter");
const emitterOffset = leftEmitter?.c.find(x => x.tag === "Set" && x.a?.name === "offset")?.v;
assert.equal(emitterOffset, "1,-14", "offset should apply to particle emitters too");

console.log(`OK: ${loaded} renderer modules imported; cape frame timing, shoe curve, and adapter sprite/track/atlas/pass/offset fixtures passed.`);
