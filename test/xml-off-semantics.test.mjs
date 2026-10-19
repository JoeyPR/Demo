import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fixture,n,set,upd,punchEvent} from "./xml-fixture.mjs";
import {PARTICLE_OFF,ADD_CLOTHING_PARTICLES,PUNCH_HOOK_EVIDENCE,EVENT_HOOKS} from "../src/xml-renderer.mjs";
import {buildTriggerTable} from "../src/xml-triggers.mjs";
import {SUPPORT} from "../src/xml-support.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const offOnPunch=()=>[n("AddClothingParticles",{},"",upd()),n("OnPunchStart",{},"",[n("ParticleSystemOff",{name:"ps"})])];
// Update only while idle; Off on a punch event. A punch (walking) therefore stops the emitter and nothing restarts it until idle again.
const idleThenOff=()=>[n("AddClothingParticles",{},"",[n("ParticleSystemUpdate",{name:"ps",onAction:"IDLE"}),n("ParticleSystemRender",{name:"ps"})]),
  n("OnPunchStart",{},"",[n("ParticleSystemOff",{name:"ps"})])];
const walking=t=>({locomotion:"walk",vx:90,...punchEvent(t)});

test("PARTICLE_OFF constant records the chosen semantics: stop + reset, not a latch, live particles finish", () => {
  assert.deepEqual(PARTICLE_OFF,{stopsEmission:true,resetsEmitterState:true,latches:false,liveParticlesFinish:true,winsSameFrame:true});
});

test("Off sets emitter running=false and clears emitted count and delay timer", () => {
  const run=fixture({hooks:offOnPunch()});
  run.until(0,1000);
  run(1050,punchEvent(1050));
  const stopped=run.item.xmlParticleRuns.find(r=>r.stopMs===1050);
  assert.deepEqual(stopped.emitter,{running:false,emitted:0,delayMs:0});
});

test("Off: live particles finish their life after emission stops", () => {
  const run=fixture({hooks:idleThenOff()});
  const alive=run.until(0,1000).length;
  assert.ok(alive>=8,`emitting (${alive})`);
  assert.ok(run(1050,walking(1050)).length>=alive-1,"Off frame keeps the existing particles");
  const mid=run(1550,{locomotion:"walk",vx:90}).length;
  assert.ok(mid>0&&mid<alive,`still finishing (${mid})`);
  assert.equal(run(2300,{locomotion:"walk",vx:90}).length,0,"all gone after one lifetime, nothing new born");
});

test("Off resets emitted count: a finite emitter (3 particles) emits its 3 again after Off + restart", () => {
  const run=fixture({emitter:[set("infParticles",false),set("particlesToEmit",3),set("checkParticleNumToEmit",true)],hooks:idleThenOff()});
  let first=0;for(let t=0;t<=900;t+=50)first=Math.max(first,run(t).length);
  assert.equal(first,3,"first run emits exactly 3");
  assert.equal(run(2300).length,0,"first run exhausted and dead while still running (no restart without Off)");
  run(2350,walking(2350));                              // Off while the exhausted emitter is still 'running'
  let second=0;for(let t=2400;t<=3300;t+=50)second=Math.max(second,run(t).length);
  assert.equal(second,3,"back to idle: the fresh emitter emits 3 more");
});

test("Off clears the delay timer: after restart nothing is born until a full new delayTimer has elapsed", () => {
  const run=fixture({emitter:[set("delayTimer",.5)],hooks:offOnPunch()});
  run.until(0,1500);
  assert.ok(run(1500).length>0,"steady state");
  run(1550,punchEvent(1550));                       // Off
  const restartMs=1600;
  run(restartMs);
  const born=[];for(let t=restartMs;t<=restartMs+450;t+=50){const ps=run(t);born.push(ps.filter(p=>p.xmlParticleAge<=t-restartMs).length);}
  // particles from before the Off may still be alive; the NEW emitter must not have born any: ages of survivors exceed time since restart
  const fresh=run(restartMs+450).filter(p=>p.xmlParticleAge<450-1);
  assert.equal(fresh.length,0,"no particle younger than the time since restart while the new delay runs");
  const later=run(restartMs+650).filter(p=>p.xmlParticleAge<100);
  assert.ok(later.length>0,"new emitter starts after its delay");
});

test("Off is not a latch: the next Update starts the system again", () => {
  const run=fixture({hooks:offOnPunch()});
  run.until(0,1000);run(1050,punchEvent(1050));
  const after=run.until(1100,1600);
  assert.ok(after.some(p=>p.xmlParticleAge<200),"newly born particles after the Off");
  assert.equal(PARTICLE_OFF.latches,false);
});

test("Off wins over an Update for the same system on the same frame", () => {
  const hooks=[n("OnPunchStart",{},"",[...upd(),n("ParticleSystemOff",{name:"ps"})])];
  const run=fixture({hooks});
  assert.equal(run(0,punchEvent(0)).length,0);
  assert.equal(run(50).length,0);
});

test("AddClothingParticles is continuous while worn (constant + hook liveness)", () => {
  assert.deepEqual(ADD_CLOTHING_PARTICLES,{mode:"continuous-while-worn",conditionGatedPerFrame:true});
  assert.equal(EVENT_HOOKS.AddClothingParticles({},{}),true);
  const run=fixture();
  const counts=[];for(let t=0;t<=2000;t+=50)counts.push(run(t).length);
  assert.ok(counts.at(-1)>=8&&counts.at(-1)===counts.at(-2),"steady emission, no gaps");
});

test("AddClothingParticles is condition-gated every frame: onAction=PUNCH emits only while punching and restarts each punch", () => {
  const hooks=[n("AddClothingParticles",{},"",[n("ParticleSystemUpdate",{name:"ps",onAction:"PUNCH"}),n("ParticleSystemRender",{name:"ps"})])];
  const run=fixture({hooks});
  assert.equal(run.until(0,500).length,0,"idle: nothing");
  const during=run.until(550,800,50,()=>({punch:{}}));assert.ok(during.length>0,"punching: emits");
  const born=run.until(850,1000,50,()=>({punch:null})).filter(p=>p.xmlParticleAge<50).length;
  assert.equal(born,0,"released: no new births");
  assert.ok(run.until(1050,1300,50,()=>({punch:{}})).some(p=>p.xmlParticleAge<100),"punching again: new births");
  assert.equal(run.item.xmlParticleRuns.filter(r=>r.stopMs!==undefined).length>=1,true,"first run was closed when the condition went false");
});

test("AddClothingParticles content gated by StopIf is re-evaluated every frame (stops while airborne, resumes on landing)", () => {
  const stop=n("StopIf",{},"",[n("IsVariableBool",{name:"onGround"},"false")]);
  const run=fixture({hooks:[n("AddClothingParticles",{},"",[stop,...upd()])]});
  assert.ok(run.until(0,500).length>0,"grounded: emits");
  const air=()=>({ground:false,vy:-200});
  const during=run.until(550,1700,50,air);
  assert.equal(during.filter(p=>p.xmlParticleAge<100).length,0,"airborne: no new births (StopIf true)");
  assert.equal(run(1750,air()).length,0,"airborne for a full lifetime: nothing left");
  assert.ok(run.until(1800,2300).some(p=>p.xmlParticleAge<100),"landed: births resume");
});

test("OnPunchBegin / OnPunchStop evidence: the ArcaneArmor Update/Off pairs exist in the shipped data and are mapped as documented", () => {
  for(const pair of PUNCH_HOOK_EVIDENCE.pairs) {
    const sys=buildTriggerTable(scripts[pair.script]).systems.find(s=>s.name===pair.system);
    assert.ok(sys.rule.some(r=>r.kind==="Update"&&r.hook===pair.update),`${pair.system} Update@${pair.update}`);
    assert.ok(sys.rule.some(r=>r.kind==="Off"&&r.hook===pair.off),`${pair.system} Off@${pair.off}`);
  }
  assert.equal(PUNCH_HOOK_EVIDENCE.OnPunchBegin.alias,"OnPunchStart");
  assert.equal(typeof EVENT_HOOKS.OnPunchBegin,"function");assert.equal(typeof EVENT_HOOKS.OnPunchStop,"function");
});

test("xml-support entries touched by these decisions stay 'partial' (none promoted to full)", () => {
  for(const k of ["Emitter.enable","Emitter.delayTimer","Emitter.infParticles","Emitter.particlesToEmit","Emitter.checkParticleNumToEmit"])
    assert.equal(SUPPORT[k],"partial",k);
});
