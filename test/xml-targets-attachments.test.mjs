// Step 7: punch targets (env.targetPos) and Emitter attachment (targetPos, targetPos2, handspotRoot, contextRotation).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fixture,n,set} from "./xml-fixture.mjs";
import {EMITTER_ATTACHMENT,TARGET_POS_RELATIVE_TO,CONTEXT_ROTATION_FALLBACK_TARGET,punchTargetAt} from "../src/xml-renderer.mjs";
import {SUPPORT} from "../src/xml-support.mjs";
import {PlannerPlayer} from "../src/player.mjs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const catalog=JSON.parse(fs.readFileSync(new URL("../demo/catalog.json",import.meta.url),"utf8"));
const approx=(a,b,eps=1)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b} (tolerance ${eps})`);
const aim=(target,extra={})=>({punch:{ageMs:50,target},...extra});
// one particle, 0.4 s life, flies from spawn to the punch target (AtomConstructs ps_Punch1 shape)
const toTarget=(attrs={},emitter=[])=>fixture({emitterAttrs:attrs,emitter:[set("infParticles",false),set("particlesToEmit",1),set("emissionInterval",5),set("offset","25, -25"),...emitter],
  particle:[set("lifeTime",.4),n("VectorTo",{name:"initialVelocity",source:"targetPos",duration:"lifeTime",x:"1"})]});

// ---- 7.1 targetPos -----------------------------------------------------------------------------------------------------
test("7.1 TARGET_POS_RELATIVE_TO records that targetPos is measured from the particle's spawn point", () => assert.equal(TARGET_POS_RELATIVE_TO,"spawn"));
test("7.1 VectorTo targetPos: with a punch target the particle ends on the target after lifeTime (tolerance 1 px)", () => {
  const run=toTarget();run(0,aim([64,16]));
  const [p]=run(396,aim([64,16]));          // 4 ms before the end of its 0.4 s life
  approx(p.x,64);approx(p.y,16);
});
test("7.1 VectorTo targetPos: any target, not just the default (cell [40,50] and [100,-10])", () => {
  for(const t of [[40,50],[100,-10]]) {
    const run=toTarget();run(0,aim(t));const [p]=run(396,aim(t));approx(p.x,t[0]);approx(p.y,t[1]);
  }
});
test("7.1 VectorTo targetPos: no target -> no particle, and the system is reported as needing a hit target", () => {
  const run=toTarget();run(0,{});
  assert.deepEqual(run(200,{}),[]);
  assert.match(run.item.xmlUnsupportedReasons.ps.join(),/targetPos unavailable \(needs a hit target\)/);
});
test("7.1 VectorTo targetPos: the target is the one at the particle's birth, later aim changes do not bend it", () => {
  const run=toTarget();run(0,aim([64,16]));
  const [p]=run(396,aim([10,60]));approx(p.x,64);approx(p.y,16);
});
test("7.1 VectorTo targetPos: facing -1 uses the same facing-local target, so piece-space positions equal facing +1 (the rig mirrors them once)", () => {
  const a=toTarget();a(0,aim([64,16],{facing:1}));const [pa]=a(396,aim([64,16],{facing:1}));
  const b=toTarget();b(0,aim([64,16],{facing:-1}));const [pb]=b(396,aim([64,16],{facing:-1}));
  approx(pb.x,pa.x,1e-6);approx(pb.y,pa.y,1e-6);
});
test("7.1 punch target is recorded in the run trail each frame and punchTargetAt returns the one at a past time", () => {
  const run=toTarget();run(0,{});run(100,aim([64,16]));run(200,aim([10,10]));
  const r=run.item.xmlParticleRuns[0];
  assert.equal(punchTargetAt(r,50),null);assert.deepEqual(punchTargetAt(r,150),[64,16]);assert.deepEqual(punchTargetAt(r,250),[10,10]);
});
test("7.1 RandomRadial(baseAnglePosition=targetPos) works with a target: radius-0 range lands the heading on the target direction", () => {
  const run=fixture({emitter:[set("infParticles",false),set("particlesToEmit",1),set("emissionInterval",5)],
    particle:[set("lifeTime",1),n("RandomRadial",{name:"initialVelocity",angleRange:"0,0",radiusRange:"100,100",baseAnglePosition:"targetPos"})]});
  run(0,aim([16,32+100]));const [p]=run(500,aim([16,32+100]));       // target straight below the spawn point (particle space [0,100])
  approx(p.x,16,.5);approx(p.y,32+50,.5);              // 100 px/s * 0.5 s along +y
});
test("7.1 real data: AtomConstructs ps_Punch1 flies to the target within 1 px; without a target it is reported unresolved", () => {
  const make=()=>normalizeCatalogItem({id:9,name:"AC",slot:1,script:"AtomConstructs",gameIcon:[]},{renderers:{AtomConstructs:scripts.AtomConstructs}});
  const frame=(ms,o={})=>({clockMs:ms,moveMs:ms,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",events:[],punch:null,...o});
  const hit=make(),ev={type:"punch",id:"p",at:100};
  advanceCatalogItem(hit,0,frame(0));
  let last;
  for(let ms=100;ms<=100+396;ms+=4){advanceCatalogItem(hit,ms,frame(ms,{punch:{ageMs:ms-100,target:[64,16]},events:[ev]}));
    const ps=hit.pieces.filter(p=>p.xmlSystem==="ps_Punch1");     // the oldest particle is the first one born at the first punch frame
    if(ps.length&&ps[0].xmlParticleAge<400)last=ps[0];}
  assert.ok(last,"ps_Punch1 emitted");approx(last.x,64);approx(last.y,16);
  const miss=make();advanceCatalogItem(miss,0,frame(0));
  for(let ms=100;ms<=400;ms+=50)advanceCatalogItem(miss,ms,frame(ms,{punch:{ageMs:ms-100},events:[ev]}));
  assert.equal(miss.pieces.filter(p=>p.xmlSystem==="ps_Punch1").length,0);
  assert.match(miss.xmlUnsupportedReasons.ps_Punch1.join(),/needs a hit target/);
});

// ---- 7.2 Emitter attachment -------------------------------------------------------------------------------------------
const still=(attrs,emitter=[],particle=[])=>fixture({emitterAttrs:attrs,emitter:[set("infParticles",false),set("particlesToEmit",1),set("emissionInterval",5),...emitter],particle:[set("lifeTime",2),...particle]});
test("7.2 EMITTER_ATTACHMENT lists exactly the four values shipped in the XML, with targetPos2 marked unsupported", () => {
  const shipped=new Set();
  for(const r of Object.values(scripts))for(const ps of r.particles??[]){const a=ps.c.find(c=>c.tag==="Emitter")?.a.attachment;if(a)shipped.add(a);}
  assert.deepEqual([...shipped].sort(),Object.keys(EMITTER_ATTACHMENT).sort());
  assert.equal(EMITTER_ATTACHMENT.targetPos2.supported,false);
  assert.ok(EMITTER_ATTACHMENT.targetPos.supported&&EMITTER_ATTACHMENT.handspotRoot.supported&&EMITTER_ATTACHMENT.contextRotation.supported);
});
test("7.2 targetPos: the emitter sits at the punch target (cell [64,16] puts the particle at x=64, y=16)", () => {
  const run=still({attachment:"targetPos"});run(0,aim([64,16]));
  const [p]=run(100,aim([64,16]));approx(p.x,64,1e-6);approx(p.y,16,1e-6);
});
test("7.2 targetPos: the emitter offset is added on top of the target", () => {
  const run=still({attachment:"targetPos"},[set("offset","3, -4")]);run(0,aim([64,16]));
  const [p]=run(100,aim([64,16]));approx(p.x,67,1e-6);approx(p.y,12,1e-6);
});
test("7.2 targetPos: no target -> nothing drawn and reported as needing a hit target", () => {
  const run=still({attachment:"targetPos"});run(0,{});
  assert.deepEqual(run(100,{}),[]);
  assert.match(run.item.xmlUnsupportedReasons.ps.join(),/targetPos: needs a hit target/);
});
test("7.2 targetPos: the emitter stays at the target it had at birth while the aim moves on", () => {
  const run=still({attachment:"targetPos"});run(0,aim([64,16]));run(100,aim([64,16]));
  const [p]=run(300,aim([10,10]));approx(p.x,64,1e-6);
});
test("7.2 targetPos2: unsupported, nothing drawn, reported with the reason (GuardianCharm PS124 and ps_hit are the only shipped users)", () => {
  const run=still({attachment:"targetPos2"});run(0,aim([64,16]));
  assert.deepEqual(run(100,aim([64,16])),[]);
  assert.match(run.item.xmlUnsupportedReasons.ps.join(),/targetPos2: second target spot/);
  const users=Object.entries(scripts).flatMap(([name,r])=>(r.particles??[]).filter(ps=>ps.c.find(c=>c.tag==="Emitter")?.a.attachment==="targetPos2").map(ps=>`${name}:${ps.a.name}`));
  assert.deepEqual(users.sort(),["GuardianCharm:PS124","GuardianCharm:ps_hit"]);
});
test("7.2 handspotRoot: the piece is attached to the front hand and its offset is hand-item space (no feet bias)", () => {
  const run=still({attachment:"handspotRoot"},[set("offset","16, 8")]);
  const [p]=run(0,{});
  assert.equal(p.attachment,"frontHand");approx(p.x,16,1e-6);approx(p.y,8,1e-6);
});
test("7.2 handspotRoot: without the attachment the same system stays on the body at feet-centre coordinates", () => {
  const [p]=still({}, [set("offset","16, 8")])(0,{});
  assert.equal(p.attachment,"body");approx(p.x,32,1e-6);approx(p.y,40,1e-6);
});
test("7.2 handspotRoot: the final draw call follows the rig's front hand (matrix differs when the arm moves)", () => {
  const frame=(ms,o={})=>({clockMs:ms,moveMs:ms,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",events:[],punch:null,...o});
  const callAt=(attrs,o)=>{const run=still(attrs,[set("offset","16, 8")]);const pl=new PlannerPlayer(catalog,[run.item]);
    pl.step(frame(0),16);return pl.step(frame(100,o),16).calls.find(c=>c.xmlParticle);};
  const idleHand=callAt({attachment:"handspotRoot"},{}),punchHand=callAt({attachment:"handspotRoot"},{punch:{ageMs:100,target:[64,16]}});
  const idleBody=callAt({},{}),punchBody=callAt({},{punch:{ageMs:100,target:[64,16]}});
  assert.equal(idleHand.attachment,"frontHand");
  assert.deepEqual(idleBody.matrix,punchBody.matrix,"body-attached particle does not move with the arm");
  assert.notDeepEqual(idleHand.matrix,punchHand.matrix,"hand-attached particle moves with the arm");
});
test("7.2 handspotRoot: real data AquaticVolcanicCannon ps_ember, ps_muzzleFlash and ps_punch all draw on the front hand", () => {
  const item=normalizeCatalogItem({id:9,name:"C",slot:5,script:"AquaticVolcanicCannon",gameIcon:[]},{renderers:{AquaticVolcanicCannon:scripts.AquaticVolcanicCannon}});
  const seen=new Map();
  for(let ms=0;ms<=1500;ms+=50){advanceCatalogItem(item,ms,{clockMs:ms,moveMs:ms,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",
    punch:ms>=500&&ms<760?{ageMs:ms-500,target:[64,16]}:null,events:ms===500?[{type:"punch",id:"p",at:500}]:[]});
    for(const p of item.pieces)if(p.xmlSystem)seen.set(p.xmlSystem,p.attachment);}
  for(const name of ["ps_ember","ps_muzzleFlash","ps_punch"])if(seen.has(name))assert.equal(seen.get(name),"frontHand",name);
  assert.ok(seen.size>0);
});
test("7.2 contextRotation: aim straight ahead (cell [64,18], shoulder [24,18]) leaves the motion and angle unrotated", () => {
  const run=still({attachment:"contextRotation"},[],[set("initialVelocity","10, 0")]);run(0,aim([64,18]));
  const [p]=run(1000,aim([64,18]));approx(p.x,16+10,1e-6);approx(p.y,32,1e-6);approx(p.r,0,1e-6);
});
test("7.2 contextRotation: aim straight down (cell [24,58]) turns velocity and sprite by +90 degrees", () => {
  const run=still({attachment:"contextRotation"},[],[set("initialVelocity","10, 0")]);run(0,aim([24,58]));
  const [p]=run(1000,aim([24,58]));approx(p.x,16,1e-6);approx(p.y,32+10,1e-6);approx(p.r,90,1e-6);
});
test("7.2 contextRotation: only particle-relative motion turns; the emitter offset stays put", () => {
  const run=still({attachment:"contextRotation"},[set("offset","14, 11")],[set("initialVelocity","10, 0")]);run(0,aim([24,58]));
  const [p]=run(1000,aim([24,58]));approx(p.x,16+14,1e-6);approx(p.y,32+11+10,1e-6);
});
test("7.2 contextRotation: without a punch target it uses the rig's default target [64,16] (CONTEXT_ROTATION_FALLBACK_TARGET)", () => {
  assert.deepEqual(CONTEXT_ROTATION_FALLBACK_TARGET,[64,16]);
  const run=still({attachment:"contextRotation"},[],[set("initialVelocity","10, 0")]);run(0,{});
  const [p]=run(1000,{});approx(p.r,Math.atan2(16-18,64-24)*180/Math.PI,1e-6);
});
test("7.2 absent attachment: behaviour unchanged (feet-centre origin, body attachment, no rotation)", () => {
  const run=still({},[],[set("initialVelocity","10, 0")]);run(0,{});const [p]=run(1000,{});
  assert.equal(p.attachment,"body");approx(p.x,26,1e-6);approx(p.y,32,1e-6);approx(p.r??0,0,1e-6);
});
test("7.2 xml-support: Emitter@attachment stays partial (not full) because the meanings are [HYP]", () => {
  assert.equal(SUPPORT["Emitter@attachment"],"partial");
});

test("7 sweep: all 256 particle scripts with an aimed punch (both facings, 6 s) draw only finite x, y, r, scale and alpha", () => {
  const bad=new Set();
  for(const [name,r] of Object.entries(scripts)) {
    if(!r.particles?.length)continue;
    for(const facing of [1,-1]) {
      const item=normalizeCatalogItem({id:7,name:"T",slot:9,script:name,gameIcon:[]},{renderers:{[name]:r}});
      for(let ms=0;ms<=6000;ms+=100) {
        const punching=(ms>=1000&&ms<1260)||(ms>=3000&&ms<3260);
        advanceCatalogItem(item,ms,{clockMs:ms,moveMs:ms,x:ms/20,y:0,vx:50,vy:0,facing,ground:true,locomotion:"walk",
          punch:punching?{ageMs:ms%1000,target:[64,16]}:null,events:(ms===1000||ms===3000)?[{type:"punch",id:"p"+ms,at:ms}]:[]});
        for(const p of item.pieces)for(const k of ["x","y","r","o"])if(p[k]!==undefined&&!Number.isFinite(p[k]))bad.add(`${name}.${k}`);
        for(const p of item.pieces)if(p.k&&!p.k.every(Number.isFinite))bad.add(`${name}.k`);
      }
    }
  }
  assert.deepEqual([...bad],[]);
});
