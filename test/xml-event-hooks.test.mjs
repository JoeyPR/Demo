import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
const n=(tag,a={},v="",c=[])=>({tag,a,v,c});
const set=(name,v)=>n("Set",{name},String(v));
// A continuously emitting system (0.1s interval, 1s life) wired into whatever hooks the test asks for.
function build(hooks) {
  const emitter=n("Emitter",{},"",[set("emissionInterval",.1),set("infParticles",true),set("infLifeTime",true),set("particlesPerEmission",1)]);
  const particle=n("Particle",{},"",[set("sprite","p"),set("lifeTime",1)]);
  const renderer={sprites:{p:{atlas:"fx.png",textureSize:"32",frame:"0,0"}},animations:[],machines:[],options:{},
    particles:[n("ParticleSystem",{name:"ps"},"",[emitter,particle])],rules:n("RenderRules",{},"",hooks)};
  const item=normalizeCatalogItem({id:1,name:"T",slot:9,script:"T",gameIcon:[]},{renderers:{T:renderer}});
  const run=(t,o={})=>{advanceCatalogItem(item,t,{clockMs:t,moveMs:0,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[],...o});
    return item.pieces.filter(p=>p.xmlParticle).length;};
  run.item=item;return run;
}
const upd=()=>[n("ParticleSystemUpdate",{name:"ps"}),n("ParticleSystemRender",{name:"ps"})];
const punchEvent=t=>({events:[{type:"punch",id:`punch:${t}`,at:t}],punch:{}});

test("content inside OnDamagedTile / OnDestroyedTile / OnKilled / OnRespawned / OnEnteredToWorld never appears (no planner event source)", () => {
  for(const hook of ["OnDamagedTile","OnDestroyedTile","OnKilled","OnRespawned","OnEnteredToWorld","SwitchOffClothingParticles"]) {
    const run=build([n(hook,{},"",upd())]);let max=0;
    for(let t=0;t<=1500;t+=50)max=Math.max(max,run(t));
    assert.equal(max,0,`${hook} must not emit continuously`);
  }
});

test("a steady-state hook (AddClothingParticles) still emits - gating only touches event hooks", () => {
  const run=build([n("AddClothingParticles",{},"",upd())]);let max=0;
  for(let t=0;t<=1500;t+=50)max=Math.max(max,run(t));
  assert.ok(max>0);
});

test("OnPunchStart / OnPunchBegin content appears on a punch event, not before", () => {
  for(const hook of ["OnPunchStart","OnPunchBegin"]) {
    const run=build([n(hook,{},"",upd())]);
    for(let t=0;t<500;t+=50)assert.equal(run(t),0,`${hook} before punch @${t}`);
    run(500,punchEvent(500));
    assert.ok(run(550,{punch:{}})>0,`${hook} after punch`);
  }
});

test("OnPunchUpdate content is live only while a punch is in progress", () => {
  const run=build([n("OnPunchUpdate",{},"",upd())]);
  assert.equal(run(0),0);run(100,{punch:{}});
  assert.ok(run(150,{punch:{}})>0);
});

test("OnPunchStop content is live for the frame a punch ends, not before or after", () => {
  const run=build([n("OnPunchStop",{},"",upd())]);
  run(0);run(100,{punch:{}});assert.equal(run(150,{punch:{}}),0,"still punching");
  run(200);assert.ok(run(250)>0,"burst started by the punch-stop frame is alive");
  let later=0;for(let t=300;t<=1500;t+=50)later=run(t);
  assert.equal(later,0,"does not stay on after the stop frame");
});

test("ParticleSystemOff stops the running emitter at once; particles already alive finish their lifetime", () => {
  const run=build([n("AddClothingParticles",{},"",upd()),n("OnPunchStart",{},"",[n("ParticleSystemOff",{name:"ps"})])]);
  let alive=0;for(let t=0;t<=1000;t+=50)alive=run(t);
  assert.ok(alive>=5,`steady state emitting (${alive})`);
  const afterOff=run(1050,punchEvent(1050));
  assert.ok(afterOff>=alive-1,"existing particles survive the Off frame");
  const runs=run.item.xmlParticleRuns.filter(r=>r.node.a.name==="ps");
  const stopped=runs.find(r=>r.stopMs===1050);
  assert.ok(stopped,"the running emitter was stopped on the Off frame");
  assert.ok(!runs.some(r=>r.startMs===1050),"no new emitter was started on the same frame as the Off");
  // The stopped run emits nothing after stopMs: its newest particle is the one born at/before the Off frame.
  assert.ok(stopped.startMs<1050);
});

test("ParticleSystemOff in SwitchOffClothingParticles (unequip side) does not stop a worn item", () => {
  const run=build([n("AddClothingParticles",{},"",upd()),n("SwitchOffClothingParticles",{},"",[n("ParticleSystemOff",{name:"ps"})])]);
  let alive=0;for(let t=0;t<=2000;t+=50)alive=run(t);
  assert.ok(alive>=5);
});

test("real data: CyberCycle ps_Hit (inside OnDamagedTile) no longer emits continuously", () => {
  const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
  const item=normalizeCatalogItem({id:1,name:"T",slot:9,script:"CyberCycle",gameIcon:[]},{renderers:{CyberCycle:scripts.CyberCycle}});
  for(let t=0;t<=1000;t+=50)advanceCatalogItem(item,t,{clockMs:t,moveMs:0,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[]});
  assert.equal(item.pieces.filter(p=>p.xmlParticle&&p.xmlSystem==="ps_Hit").length,0);
});
