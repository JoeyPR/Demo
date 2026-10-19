import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {PreviewMotion} from "../engine/motion.mjs";
import {PlayerRig,punchMatrix} from "../engine/rig.mjs";
import {point} from "../engine/math.mjs";
import {drawBounds} from "../engine/draw-bounds.mjs";
import {resolveAbilities} from "../engine/abilities.mjs";
import {normalizeCatalogItem} from "../engine/catalog-adapter.mjs";
import {mountedGaitProfile} from "../engine/mounted-gait.mjs";
import {isFloatingItem} from "../engine/motion-policy.mjs";
import {PlannerPlayer} from "../engine/player.mjs";
const catalog=JSON.parse(fs.readFileSync(new URL("../catalog.json",import.meta.url)));
catalog.renderers=JSON.parse(fs.readFileSync(new URL("../renderer-data.json",import.meta.url))).scripts;
const registry=JSON.parse(fs.readFileSync(new URL("../ability-registry.json",import.meta.url)));
const item=id=>normalizeCatalogItem(catalog.items.find(i=>i.id===id),catalog);
const frame=(time=0,extra={})=>({clockMs:time,moveMs:time,locomotion:"idle",ground:true,
  x:0,y:0,vx:0,vy:0,facing:1,events:[],...extra});
test("naked player has one jump, Fairy Wings add only double jump, Soda adds high jump + held slow fall",()=>{
  assert.deepEqual({...resolveAbilities([],registry),sources:[]},{doubleJump:false,highJump:false,slowFall:false,speedy:false,sources:[]});
  const fairy=resolveAbilities([item(156)],registry),soda=resolveAbilities([item(1762)],registry);
  assert.equal(fairy.doubleJump,true);assert.equal(fairy.highJump,false);assert.equal(fairy.slowFall,false);
  assert.equal(soda.doubleJump,false);assert.equal(soda.highJump,true);assert.equal(soda.slowFall,true);
  for(const [abilities,expected] of [[{},0],[fairy,1],[soda,0]]) {
    const m=new PreviewMotion();m.setAbilities(abilities);m.step(16,{jump:true});m.step(16,{});
    assert.equal(m.step(16,{jump:true}).events.filter(e=>e.type==="doubleJump").length,expected);
  }
});
test("equipment cannot refill an already-consumed air jump",()=>{
  const m=new PreviewMotion({doubleJump:true});m.step(16,{jump:true});m.step(16,{});
  m.step(16,{jump:true});m.setAbilities({doubleJump:false});m.setAbilities({doubleJump:true});
  m.step(16,{});assert.equal(m.step(16,{jump:true}).events.length,0);
});
test("high jump adds a tile of held height and slow fall requires holding Jump",()=>{
  const apex=abilities=>{let m=new PreviewMotion();m.setAbilities(abilities);let y=0;
    for(let n=0;n<100;n++)y=Math.min(y,m.step(8,{jump:true}).y);return -y;};
  assert.ok(Math.abs(apex({highJump:true})-apex({})-32)<2);
  const m=new PreviewMotion();m.setAbilities({slowFall:true});m.y=-200;m.ground=false;m.vy=400;m.lastJump=true;
  assert.equal(m.step(16,{jump:true}).locomotion,"glide");
  const slow=m.vy;m.step(16,{jump:false});assert.ok(m.vy>slow);
});
test("holding punch repeats with the planner cadence and ends after release",()=>{
  const m=new PreviewMotion();let count=0;
  for(let n=0;n<90;n++)count+=m.step(16,{punch:true,punchTarget:[170,10]}).events.filter(e=>e.type==="punch").length;
  assert.ok(count>=5);for(let n=0;n<20;n++)m.step(16,{});
  assert.equal(m.punch,null);
});
test("aimed punching can face right while travelling left; movement restores facing after release",()=>{
  const m=new PreviewMotion();m.facing=1;
  assert.equal(m.step(16,{left:true,punch:true,punchTarget:[150,18]}).facing,1);
  assert.equal(m.step(16,{left:true}).facing,-1);
});
test("Speedy increases travel speed only for an explicit registry match",()=>{
  const slow=new PreviewMotion(),fast=new PreviewMotion();fast.setAbilities(resolveAbilities([item(3788)],registry));
  for(let n=0;n<50;n++){slow.step(16,{right:true});fast.step(16,{right:true});}
  assert.ok(fast.vx>slow.vx);assert.equal(fast.vx,350);
});
test("hover flags without a recovered curve use an explicitly marked shared reference bob",()=>{
  for(const id of [3788,2048,2064,15934,15652]){
    const p=new PlannerPlayer(catalog,[item(id)]);
    const a=p.step(frame(0),16),b=p.step(frame(250),16);
    assert.equal(b.lift.floating,true);assert.notEqual(b.lift.y,a.lift.y);
    assert.ok(b.lift.evidence.includes("reference")||b.lift.evidence.includes("fallback"));
    assert.equal(b.lift.outfitInteractionsVerified,false);
    const draw=r=>r.calls.find(c=>c.owner===id&&!c.xmlParticle);
    assert.ok(Math.abs((draw(b).matrix[5]-draw(a).matrix[5])-(b.lift.y-a.lift.y))<.001);
  }
});
test("punch tip follows the planner expansion toward near/far targets in shoulder space",()=>{
  for(const target of [[27,18],[170,0],[-30,-60]]) {
    const r=new PlayerRig().update(frame(100,{punch:{ageMs:100,target}}),16);
    const tip=point(punchMatrix(r.punch),[10,48]);
    const factor=48*.106*.1;
    const expected=[24+(target[0]-24)*factor,18+(target[1]-18)*factor];
    assert.ok(Math.hypot(tip[0]-expected[0],tip[1]-expected[1])<.001);
  }
});
test("render/export bounds include a fist beyond the old tile-centered surface at all resolutions",()=>{
  const r=new PlayerRig().update(frame(200,{punch:{ageMs:200,target:[190,10]}}),16);
  const c={sw:20,sh:48,matrix:punchMatrix(r.punch)};
  const b=drawBounds([c]);assert.ok(b.x+b.width>190);assert.ok(b.width>128);
  for(const resolution of [32,64,128,256])assert.ok(b.width*resolution/32>4*resolution);
});
test("brooms/meteor/comet float without animal-half gait; Stick Horse has slower reference gait",()=>{
  for(const id of [3788,2048,2064]){assert.equal(isFloatingItem(item(id)),true);assert.equal(mountedGaitProfile(item(id)),null);}
  assert.equal(mountedGaitProfile(item(1012)).periodMs,460);
  for(const raw of catalog.items.filter(i=>/broomstick|car |cycle|comet|meteor/i.test(i.name)))
    assert.equal(mountedGaitProfile(normalizeCatalogItem(raw,catalog)),null,raw.name);
});
test("named passive and punch effects render through the shared draw list",()=>{
  for(const id of [1438,288,138,366,472]) {
    const p=new PlannerPlayer(catalog,[item(id)]);
    const result=p.step(frame(100,{punch:{ageMs:100,target:[170,10]},events:[{id:"hit1",type:"punch"}]}),16);
    const fx=result.calls.filter(c=>c.atlas==="reference-fx.png");
    assert.ok(fx.length,id);assert.ok(fx.every(c=>c.matrix.every(Number.isFinite)));
    if([138,366,472].includes(id))assert.equal(result.pose.punch,null);
  }
});
test("native XML emitter hooks are reachable outside the five-aura replacement list",()=>{
  const p=new PlannerPlayer(catalog,[item(15934)]);p.step(frame(0,{locomotion:"walk",vx:90}),16);
  const r=p.step(frame(500,{locomotion:"walk",vx:90}),16);
  assert.ok(p.items[0].pieces.some(c=>c.xmlParticle));
  assert.ok(r.calls.every(c=>c.matrix.every(Number.isFinite)));
});
