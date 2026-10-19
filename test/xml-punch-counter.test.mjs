// One player-level punch counter feeds BOTH Select input="punchCount" and <Emitter onPunchCount="odd|even">.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {n,set,upd} from "./xml-fixture.mjs";
import {PunchCounter,PUNCH_COUNTER} from "../src/punch-counter.mjs";
import {PlannerPlayer} from "../src/player.mjs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {ON_PUNCH_COUNT} from "../src/xml-renderer.mjs";
import {SUPPORT} from "../src/xml-support.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const catalog=JSON.parse(fs.readFileSync(new URL("../demo/catalog.json",import.meta.url),"utf8"));
const frame=(ms,o={})=>({clockMs:ms,moveMs:ms,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[],...o});
const punchAt=(ms,id)=>({events:[{type:"punch",id,at:ms}],punch:{}});

// Three systems on one item: SEL (Select offset by punchCount), ODD and EVEN emitters. All start while punching.
const sys=(name,emitterAttrs={},particle=[])=>n("ParticleSystem",{name},"",[
  n("Emitter",emitterAttrs,"",[set("emissionInterval",1),set("particlesToEmit",1),set("infParticles",false)]),
  n("Particle",{},"",[set("sprite","p"),set("lifeTime",5),...particle])]);
const select=n("Select",{name:"offset",input:"punchCount"},"",[n("Item",{},"-40, 0"),n("Item",{},"40, 0"),n("Item",{},"0, -46")]);
function renderer(extra=[]) {
  return {sprites:{p:{atlas:"fx.png",textureSize:"32",frame:"0,0"}},animations:[],machines:[],options:{},
    particles:[sys("SEL",{},[select]),sys("ODD",{onPunchCount:"odd"}),sys("EVEN",{onPunchCount:"even"}),...extra],
    rules:n("RenderRules",{},"",[n("AddClothingParticles",{},"",["SEL","ODD","EVEN",...extra.map(e=>e.a.name)].map(name=>n("ParticleSystemUpdate",{name,onAction:"PUNCH"})))])};
}
const wearing=(r,id=1,slot=1)=>{const item=normalizeCatalogItem({id,name:"T"+id,slot,script:"T"+id,gameIcon:[]},{renderers:{["T"+id]:r}});return item;};
// Drive the player through three punches (ids a,b,c at 100/600/1100 ms). Returns, per punch, the systems alive at +50 ms and SEL's x offset.
function threePunches(player,item) {
  const out=[];
  for(const [i,t] of [100,600,1100].entries()) {
    player.step(frame(t-50),50);
    player.step(frame(t,punchAt(t,"p"+i)),50);
    player.step(frame(t+50,{punch:{}}),50);
    const born=item.pieces.filter(p=>p.xmlSystem&&p.xmlParticleAge<=100);
    out.push({count:player.punches.count,systems:new Set(item.pieces.filter(p=>p.xmlParticle&&p.xmlParticleAge<=100).map(p=>p.xmlSystem)),
      selX:item.pieces.find(p=>p.xmlSystem==="SEL"&&p.xmlParticleAge<=100)?.x});
    player.step(frame(t+100,{}),50);
  }
  return out;
}

test("punch counter (b): PUNCH_COUNTER constant records first punch = 1, distinct ids counted once, reset on rewind", () => {
  assert.deepEqual(PUNCH_COUNTER,{firstPunchCount:1,countsDistinctEventIds:true,resetsOnRewind:true});
});
test("punch counter (b): PunchCounter counts each distinct punch id once even when the event repeats over frames", () => {
  const c=new PunchCounter();
  assert.equal(c.observe(frame(0)),0);
  assert.equal(c.observe(frame(100,punchAt(100,"a"))),1);
  assert.equal(c.observe(frame(116,punchAt(100,"a"))),1);
  assert.equal(c.observe(frame(600,punchAt(600,"b"))),2);
});
test("punch counter (b): PunchCounter resets when time is scrubbed backwards", () => {
  const c=new PunchCounter();c.observe(frame(600,punchAt(600,"b")));assert.equal(c.count,1);
  assert.equal(c.observe(frame(100)),0);
  assert.equal(c.observe(frame(150,punchAt(150,"b"))),1,"the same id counts again after a reset");
});
test("punch counter (b): onPunchCount odd/even table: odd for 1,3,5 and even for 0,2,4", () => {
  assert.deepEqual([0,1,2,3,4,5].map(k=>[ON_PUNCH_COUNT.odd(k),ON_PUNCH_COUNT.even(k)]),
    [[false,true],[true,false],[false,true],[true,false],[false,true],[true,false]]);
});
test("punch counter (b): the player owns one counter and injects it as motion.punchCount; the item keeps none of its own", () => {
  const item=wearing(renderer()),player=new PlannerPlayer(catalog,[item]);
  threePunches(player,item);
  assert.equal(player.punches.count,3);
  assert.equal(item.xmlPunchCount,undefined);assert.equal(item.xmlPunchIds,undefined);
  const counts=new Set(item.xmlParticleRuns.flatMap(r=>r.trail.map(p=>p[3])));
  assert.deepEqual([...counts].sort(),[1,2,3],"every run trail records the player's count");
});
test("punch counter (b): Select input punchCount and emitter onPunchCount read the same count across three punches", () => {
  const item=wearing(renderer()),player=new PlannerPlayer(catalog,[item]);
  const [p1,p2,p3]=threePunches(player,item);
  assert.deepEqual([p1.count,p2.count,p3.count],[1,2,3]);
  assert.deepEqual([[...p1.systems].sort(),[...p2.systems].sort(),[...p3.systems].sort()],[["ODD","SEL"],["EVEN","SEL"],["ODD","SEL"]],"odd on 1 and 3, even on 2");
  // Select index = count % 3 -> items 1, 2, 0
  assert.deepEqual([p1.selX,p2.selX,p3.selX],[16+40,16+0,16-40]);
});
test("punch counter (b): an injected motion.punchCount drives both consumers with no event history (5 -> odd emitter, Select item 2)", () => {
  const item=wearing(renderer());
  for(let ms=0;ms<=200;ms+=50)advanceCatalogItem(item,ms,frame(ms,{punchCount:5,punch:{},events:[]}));
  const alive=new Set(item.pieces.filter(p=>p.xmlParticle).map(p=>p.xmlSystem));
  assert.deepEqual([...alive].sort(),["ODD","SEL"]);
  assert.equal(item.pieces.find(p=>p.xmlSystem==="SEL").x,16+0);
});
test("punch counter (b): two worn items see the same player count (no per-item drift when one is equipped later)", () => {
  const a=wearing(renderer(),1,1),b=wearing(renderer(),2,2),player=new PlannerPlayer(catalog,[a]);
  player.step(frame(100,punchAt(100,"x")),50);player.step(frame(150,{}),50);
  player.equip([a,b]);                       // b joins after one punch: it must not restart its own count at 0
  player.step(frame(600,punchAt(600,"y")),50);player.step(frame(650,{punch:{}}),50);
  assert.equal(player.punches.count,2);
  const alive=item=>new Set(item.pieces.filter(p=>p.xmlParticle&&p.xmlParticleAge<=100).map(p=>p.xmlSystem));
  assert.deepEqual([...alive(a)].sort(),["EVEN","SEL"]);
  assert.deepEqual([...alive(b)].sort(),["EVEN","SEL"],"late-joining item agrees with the first");
});
test("punch counter (b): rewinding the timeline resets the one counter for every consumer", () => {
  const item=wearing(renderer()),player=new PlannerPlayer(catalog,[item]);
  threePunches(player,item);
  player.step(frame(50),50);
  assert.equal(player.punches.count,0);
});
test("punch counter (b): systems without onPunchCount, and unknown onPunchCount values, are not gated", () => {
  const item=wearing(renderer([sys("ANY"),sys("WEIRD",{onPunchCount:"third"})])),player=new PlannerPlayer(catalog,[item]);
  const [p1,p2]=threePunches(player,item);
  for(const p of [p1,p2]){assert.ok(p.systems.has("ANY"));assert.ok(p.systems.has("WEIRD"));}
});
test("punch counter (b): real data, DivineAstras alternates ps_punchCurved (odd) and ps_punchStraight (even) on consecutive punches", () => {
  const item=normalizeCatalogItem({id:5,name:"DA",slot:1,script:"DivineAstras",gameIcon:[]},{renderers:{DivineAstras:scripts.DivineAstras}});
  const player=new PlannerPlayer(catalog,[item]);
  const seen=[];
  for(const [i,t] of [100,700].entries()) {
    player.step(frame(t-50),50);player.step(frame(t,punchAt(t,"d"+i)),50);
    for(let ms=t+50;ms<=t+300;ms+=50)player.step(frame(ms,{punch:{}}),50);
    // the particles of these two systems need a VectorTo hit target (step 7), so compare the runs the item opened for this punch
    seen.push(new Set(item.xmlParticleRuns.filter(r=>r.startMs>=t-1&&r.startMs<=t+400).map(r=>r.node.a.name)));
    player.step(frame(t+400),50);
  }
  assert.ok(seen[0].has("ps_punchCurved")&&!seen[0].has("ps_punchStraight"),[...seen[0]].join());
  assert.ok(seen[1].has("ps_punchStraight")&&!seen[1].has("ps_punchCurved"),[...seen[1]].join());
});
test("punch counter (b): xml-support: Emitter@onPunchCount is partial (not full)", () => {
  assert.equal(SUPPORT["Emitter@onPunchCount"],"partial");
});
