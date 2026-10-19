// Step 5: one describe-by-comment block per particle flag, each added in its own commit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fixture,n,set,upd,base} from "./xml-fixture.mjs";
import {emitterPosAt} from "../src/xml-renderer.mjs";
import {SUPPORT} from "../src/xml-support.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const approx=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
// one long-lived particle per second, born at t=0
const slow={emitter:[set("emissionInterval",1),set("particlesToEmit",1),set("infParticles",false)],particle:[set("lifeTime",10)]};
const withFlags=(extra,o={})=>fixture({...slow,...o,particle:[...slow.particle,...extra,...(o.particle??[])]});

// ---- infrastructure ---------------------------------------------------------------------------------------------------
test("infra: a run records the emitter position each frame and emitterPosAt returns the position at a past time", () => {
  const run=fixture();
  run(0,{x:0,y:0});run(100,{x:10,y:0});run(200,{x:30,y:5});
  const r=run.item.xmlParticleRuns[0];
  assert.deepEqual(r.emitter,{running:true,emitted:0,delayMs:0});
  assert.deepEqual(emitterPosAt(r,150),[10,0]);
  assert.deepEqual(emitterPosAt(r,200),[30,5]);
  assert.deepEqual(emitterPosAt(r,-5),[0,0],"before the first sample uses the first sample");
});

// ---- 5.1 relativeToEmitter --------------------------------------------------------------------------------------------
const moveAfterSpawn=run=>{run(0,{x:0,y:0});run(100,{x:0,y:0});return run(600,{x:100,y:-20});};
test("5.1 relativeToEmitter=true: the particle follows the player after spawn", () => {
  const [p]=moveAfterSpawn(withFlags([set("relativeToEmitter",true)]));
  approx(p.x,16);approx(p.y,32);
});
test("5.1 relativeToEmitter=false: the particle stays where it spawned when the player moves (x and y)", () => {
  const [p]=moveAfterSpawn(withFlags([set("relativeToEmitter",false)]));
  approx(p.x,16-100);approx(p.y,32+20);
});
test("5.1 relativeToEmitter=false: a particle born after the player moved is anchored at the NEW spawn position", () => {
  const run=fixture({emitter:[set("emissionInterval",.5)],particle:[set("lifeTime",10),set("relativeToEmitter",false)]});
  run(0,{x:0});run(400,{x:0});run(600,{x:100});run(1100,{x:100});
  const xs=run(1600,{x:150}).map(p=>Math.round(p.x)).sort((a,b)=>a-b);
  assert.ok(xs.includes(16-150),"born at x=0, now 150 away");
  assert.ok(xs.includes(16-50),"born at x=100, now 50 away");
});
test("5.1 relativeToEmitter absent: default is RELATIVE_TO_EMITTER_DEFAULT (follows), so existing items do not change", () => {
  const [p]=moveAfterSpawn(withFlags([]));
  approx(p.x,16);
});
test("5.1 relativeToEmitter is marked partial in xml-support (default is [HYP])", () => {
  assert.equal(SUPPORT["Particle.relativeToEmitter"],"partial");
});
