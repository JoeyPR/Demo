import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {PreviewMotion} from "../src/motion.mjs";
import {resolveAbilities} from "../src/abilities.mjs";
import {PlayerRig,punchMatrix} from "../src/rig.mjs";
import {point} from "../src/math.mjs";
import {drawBounds} from "../src/draw-bounds.mjs";
import {resolvePlayerLift} from "../src/lift.mjs";
import {ItemEffects} from "../src/item-fx.mjs";
const registry=JSON.parse(fs.readFileSync(new URL("../evidence/ability-registry.json",import.meta.url)));
test("default controller has no air jump",()=>{
  const m=new PreviewMotion();m.step(16,{jump:true});m.step(16,{});
  assert.equal(m.step(16,{jump:true}).events.length,0);
});
test("sourced Soda/Fairy ability sets stay distinct",()=>{
  const fairy=resolveAbilities([{id:156}],registry),soda=resolveAbilities([{id:1762}],registry);
  assert.equal(fairy.doubleJump,true);assert.equal(fairy.highJump,false);assert.equal(fairy.slowFall,false);
  assert.equal(soda.doubleJump,false);assert.equal(soda.highJump,true);assert.equal(soda.slowFall,true);
});
test("equipping in air cannot refill a consumed jump",()=>{
  const m=new PreviewMotion({doubleJump:true});m.step(16,{jump:true});m.step(16,{});m.step(16,{jump:true});
  m.setAbilities({});m.setAbilities({doubleJump:true});m.step(16,{});
  assert.equal(m.step(16,{jump:true}).events.length,0);
});
test("held punch repeats and releases",()=>{
  const m=new PreviewMotion();let n=0;
  for(let i=0;i<90;i++)n+=m.step(16,{punch:true}).events.filter(e=>e.type==="punch").length;
  assert.ok(n>=5);for(let i=0;i<20;i++)m.step(16,{});
  assert.equal(m.punch,null);
});
test("near/far punch follows the planner expansion in shoulder space",()=>{
  for(const target of [[27,18],[170,0],[-30,-60]]){
    const p=new PlayerRig().update({clockMs:100,moveMs:0,ground:true,locomotion:"idle",punch:{ageMs:100,target}},16);
    const tip=point(punchMatrix(p.punch),[10,48]);
    const factor=48*.106*.1;
    const expected=[24+(target[0]-24)*factor,18+(target[1]-18)*factor];
    assert.ok(Math.hypot(tip[0]-expected[0],tip[1]-expected[1])<.001);
  }
});
test("far punch expands export beyond the old fixed surface",()=>{
  const p=new PlayerRig().update({clockMs:200,moveMs:0,ground:true,locomotion:"idle",punch:{ageMs:200,target:[190,10]}},16);
  const b=drawBounds([{sw:20,sh:48,matrix:punchMatrix(p.punch)}]);assert.ok(b.width>128);
});
test("known hover without curve uses an explicitly unverified shared bob",()=>{
  const item={id:3788,slot:3,vehicle:true,riderLift:-3};
  const a=resolvePlayerLift([item],0),b=resolvePlayerLift([item],250);
  // Rider bob tuning: raw source period, amplitude scaled 0.65x (lift.mjs
  // RIDE_BOB_AMPLITUDE_SCALE) so the ride does not slide as far down.
  const bob=0.65*Math.sin(2*Math.PI*250/1000);
  assert.ok(Math.abs(b.y-a.y-bob)<1e-6);assert.ok(Math.abs(b.vehicleY-a.vehicleY-bob)<1e-6);
  assert.equal(b.outfitInteractionsVerified,false);assert.ok(b.evidence.includes("reference"));
});
test("named reference FX keep finite transforms and expire",()=>{
  const system=new ItemEffects(),item={id:288};
  const f={clockMs:0,worldX:0,worldY:0,x:0,y:0,ground:true,facing:1,events:[]};
  assert.equal(system.step([item],f,[],{y:0}).length,1);
  const calls=system.step([item],{...f,clockMs:500},[],{y:0});
  assert.ok(calls.every(c=>c.matrix.every(Number.isFinite)));
  assert.equal(system.step([],{...f,clockMs:2000},[],{y:0}).length,0);
});
