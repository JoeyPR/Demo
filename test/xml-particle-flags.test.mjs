// Step 5: one describe-by-comment block per particle flag, each added in its own commit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fixture,n,set,upd,base} from "./xml-fixture.mjs";
import {emitterPosAt,USE_PLAYER_FACING_DEFAULT,OFFSET_FACING_DEFAULT} from "../src/xml-renderer.mjs";
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

// ---- 5.2 rotateWithVelocity -------------------------------------------------------------------------------------------
const veloc=(v,extra=[])=>withFlags([set("initialVelocity",v),...extra]);
test("5.2 rotateWithVelocity=true: velocity (0,1) rotates the sprite +90 degrees", () => {
  const [p]=veloc("0,1",[set("rotateWithVelocity",true)])(0,{});
  approx(p.r,90);
});
test("5.2 rotateWithVelocity=true: velocity (1,0) is 0, (-1,0) is 180, (0,-1) is -90", () => {
  for(const [v,deg] of [["1,0",0],["-1,0",180],["0,-1",-90]]) {
    const [p]=veloc(v,[set("rotateWithVelocity",true)])(0,{});approx(p.r,deg,1e-9);
  }
});
test("5.2 rotateWithVelocity=true adds to initialAngle; false/absent leaves the angle alone", () => {
  const [a]=veloc("0,1",[set("rotateWithVelocity",true),set("initialAngle",10)])(0,{});approx(a.r,100);
  const [b]=veloc("0,1",[set("rotateWithVelocity",false),set("initialAngle",10)])(0,{});approx(b.r,10);
  const [c]=veloc("0,1",[set("initialAngle",10)])(0,{});approx(c.r,10);
});
test("5.2 rotateWithVelocity=true with zero velocity does not rotate (no NaN)", () => {
  const [p]=veloc("0,0",[set("rotateWithVelocity",true)])(0,{});approx(p.r,0);
});
test("5.2 rotateWithVelocity follows the instantaneous velocity when gravity bends the path", () => {
  const run=veloc("10,0",[set("rotateWithVelocity",true),set("useGravity",true),set("gravityVector","0,10")]);
  run(0,{});const [p]=run(1000,{});
  approx(p.r,Math.atan2(10,10)*180/Math.PI,1e-6);
});

// ---- 5.3 usePlayerFacing / Emitter.offsetFacing ------------------------------------------------------------------------
// The rig mirrors every draw call for facing=-1, so "net mirrored once" is checked on the FINAL draw-list matrices.
import {PlannerPlayer} from "../src/player.mjs";
const catalog=JSON.parse(fs.readFileSync(new URL("../demo/catalog.json",import.meta.url),"utf8"));
const finalCall=(run,facing,t=100)=>{
  const p=new PlannerPlayer(catalog,[run.item]);
  const m=ms=>({clockMs:ms,moveMs:ms,locomotion:"idle",ground:true,x:0,y:0,vx:0,vy:0,facing,events:[],punch:null});
  p.step(m(0),16);return p.step(m(t),16).calls.find(c=>c.xmlParticle);
};
const facingFx=(particleAttrs,emitter=[],particle=[])=>fixture({particleAttrs,emitter:[set("emissionInterval",1),set("particlesToEmit",1),set("infParticles",false),...emitter],
  particle:[set("lifeTime",10),...(particle.some(x=>x.a.name==="offset")?[]:[set("offset","10,0")]),...particle]});
test("5.3 usePlayerFacing=true, facing=-1: the particle is mirrored with the player exactly once (offset x and sprite flip)", () => {
  const c=finalCall(facingFx({usePlayerFacing:"true"}),-1);
  approx(c.matrix[0],-1);approx(c.matrix[4],22);
});
test("5.3 usePlayerFacing=false, facing=-1: the particle ignores facing (same matrix as facing=+1)", () => {
  const right=finalCall(facingFx({usePlayerFacing:"false"}),1),left=finalCall(facingFx({usePlayerFacing:"false"}),-1);
  assert.deepEqual(left.matrix.map(v=>+v.toFixed(6)),right.matrix.map(v=>+v.toFixed(6)));
});
test("5.3 usePlayerFacing=false: velocity.x is not mirrored (moves the same screen direction at facing -1 and +1)", () => {
  const fx=()=>facingFx({usePlayerFacing:"false"},[],[set("initialVelocity","20,0"),set("offset","0,0")]);
  const r=finalCall(fx(),1,1000),l=finalCall(fx(),-1,1000);
  approx(r.matrix[4],l.matrix[4]);approx(l.matrix[0],r.matrix[0]);
});
test("5.3 usePlayerFacing=true: velocity.x is mirrored with the player", () => {
  const fx=()=>facingFx({usePlayerFacing:"true"},[],[set("initialVelocity","20,0"),set("offset","0,0")]);
  const r=finalCall(fx(),1,1000),l=finalCall(fx(),-1,1000);
  approx(r.matrix[4]+l.matrix[4],32,1e-6);   // reflected about the player centre x=16
});
test("5.3 usePlayerFacing=false composes with an authored flipX exactly once (no double flip)", () => {
  const fx=f=>finalCall(facingFx({usePlayerFacing:"false"},[],[set("flipX",true)]),f);
  approx(fx(1).matrix[0],-1);approx(fx(-1).matrix[0],-1);
});
test("5.3 Emitter.offsetFacing=false: the emitter offset does not mirror with facing; true does (sprite centre on screen)", () => {
  const centre=c=>c.matrix[4]+16*c.matrix[0];
  const mk=flag=>facingFx({},[set("offset","10,0"),set("offsetFacing",flag)],[set("offset","0,0")]);
  approx(centre(finalCall(mk(false),1)),centre(finalCall(mk(false),-1)));
  approx(centre(finalCall(mk(true),1))+centre(finalCall(mk(true),-1)),32,1e-6);
});
test("5.3 absent flags keep the old behaviour (mirrored with the player); constants record the [HYP] defaults", () => {
  const f=finalCall(facingFx({}),-1);approx(f.matrix[0],-1);approx(f.matrix[4],22);
  assert.equal(USE_PLAYER_FACING_DEFAULT,true);assert.equal(OFFSET_FACING_DEFAULT,true);
  assert.equal(SUPPORT["Particle@usePlayerFacing"],"partial");assert.equal(SUPPORT["Emitter.offsetFacing"],"partial");
});

// ---- 5.4 renderAlignment ----------------------------------------------------------------------------------------------
import {RENDER_ALIGNMENT} from "../src/xml-renderer.mjs";
test("5.4 renderAlignment maps every value in the data set to its anchor (ax,ay)", () => {
  const expected={CENTER:[.5,.5],DOWN_CENTER:[.5,1],UPPER_CENTER:[.5,0],LEFT_CENTER:[0,.5],RIGHT_CENTER:[1,.5]};
  for(const [name,anchor] of Object.entries(expected)) {
    const [p]=withFlags([set("renderAlignment",name)])(0,{});
    assert.deepEqual([p.ax,p.ay],anchor,name);
  }
  assert.deepEqual(RENDER_ALIGNMENT,expected);
});
test("5.4 renderAlignment: every value used in the shipped XML is a known alignment", () => {
  const used=new Set();
  for(const r of Object.values(scripts))for(const sys of r.particles??[])for(const side of sys.c)for(const c of side.c)
    if(c.a?.name==="renderAlignment"&&c.tag==="Set")used.add(c.v);
  assert.deepEqual([...used].sort(),Object.keys(RENDER_ALIGNMENT).sort());
});
test("5.4 renderAlignment DOWN_CENTER draws the sprite above the particle point; UPPER_CENTER below it (final matrices)", () => {
  const ty=name=>finalCall(withFlags([set("renderAlignment",name),set("offset","0,0")]),1).matrix[5];
  const centre=ty("CENTER"),down=ty("DOWN_CENTER"),up=ty("UPPER_CENTER");
  approx(centre-down,16);approx(up-centre,16);        // 32px sprite: half a sprite either way
});
test("5.4 renderAlignment LEFT_CENTER / RIGHT_CENTER shift the sprite horizontally by half its width", () => {
  const tx=name=>finalCall(withFlags([set("renderAlignment",name),set("offset","0,0")]),1).matrix[4];
  approx(tx("CENTER")-tx("LEFT_CENTER"),-16);approx(tx("RIGHT_CENTER")-tx("CENTER"),-16);
});
test("5.4 renderAlignment: absent keeps CENTER; an unknown value falls back to CENTER and is reported on the item", () => {
  const [a]=withFlags([])(0,{});assert.deepEqual([a.ax,a.ay],[.5,.5]);
  const run=withFlags([set("renderAlignment","NOT_A_REAL_ONE")]);const [b]=run(0,{});
  assert.deepEqual([b.ax,b.ay],[.5,.5]);assert.equal(run.item.xmlUnsupportedValues["ps.renderAlignment"],"NOT_A_REAL_ONE");
  assert.equal(SUPPORT["Particle.renderAlignment"],"partial");
});

// ---- 5.5 isBackgroundParticle -----------------------------------------------------------------------------------------
import {BACKGROUND_PARTICLE_PASS} from "../src/xml-renderer.mjs";
import {PLANNER_PROFILE} from "../src/planner-profile.mjs";
test("5.5 isBackgroundParticle=true: the particle is assigned the BEHIND pass, which is the first pass in the profile", () => {
  const [p]=withFlags([set("isBackgroundParticle",true)])(0,{});
  assert.equal(p.pass,BACKGROUND_PARTICLE_PASS);assert.equal(PLANNER_PROFILE.passOrder[0],BACKGROUND_PARTICLE_PASS);
});
test("5.5 isBackgroundParticle=false/absent: the particle keeps the pass of the hook that started it", () => {
  const hook=[n("AddClothingParticles",{},"",upd())];
  const [a]=withFlags([set("isBackgroundParticle",false)],{hooks:hook})(0,{});
  const [b]=withFlags([],{hooks:hook})(0,{});
  assert.notEqual(a.pass,BACKGROUND_PARTICLE_PASS);assert.equal(a.pass,b.pass);
});
test("5.5 isBackgroundParticle=true overrides a front pass (RenderInFront hook) and reaches the final draw list in the BEHIND pass", () => {
  const hooks=[n("RenderInFront",{},"",upd())];
  const run=withFlags([set("isBackgroundParticle",true)],{hooks});
  const [p]=run(0,{});assert.equal(p.pass,"RenderBehind");
  assert.equal(finalCall(run,1).pass,"RenderBehind");
});
test("5.5 isBackgroundParticle is marked partial in xml-support", () => {
  assert.equal(SUPPORT["Particle.isBackgroundParticle"],"partial");
});
