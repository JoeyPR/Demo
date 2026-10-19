import test from "node:test";
import assert from "node:assert/strict";
import {PlayerRig} from "../src/rig.mjs";
import {PreviewMotion} from "../src/motion.mjs";
const frame=ageMs=>({clockMs:ageMs,moveMs:0,ground:true,locomotion:"idle",
  punch:{ageMs}});
test("default punch retains the earlier planner stretch and width at every sampled age",()=>{
  for(const age of [0,16,50,100,150,200,250]){
    const p=new PlayerRig().update(frame(age),16).punch;
    assert.ok(Math.abs(p.stretch-Math.hypot(40,-2)*age/1000*.106)<1e-12);
    assert.ok(Math.abs(p.width-Math.min(1.8,7.43*age/1000))<1e-12);
  }
});
test("front arm swings continuously from 90 toward 20 instead of resetting on each frame",()=>{
  const rig=new PlayerRig(),angles=[];
  for(const age of [10,20,30,40,50,60,70,80])angles.push(rig.update(frame(age),10).frontAngle);
  assert.deepEqual(angles,[81,72,63,54,45,36,27,20]);
});
test("holding punch retriggers every 200ms; a released punch retains its 260ms lifetime",()=>{
  const m=new PreviewMotion(),hits=[];
  for(let n=0;n<65;n++){
    for(const e of m.step(10,{punch:true}).events)if(e.type==="punch")hits.push(e.at);
  }
  assert.deepEqual(hits,[10,210,410,610]);
  const released=new PreviewMotion();released.step(10,{punch:true});
  for(let n=0;n<24;n++)released.step(10,{});
  assert.equal(released.punch.ageMs,250);
  released.step(10,{});assert.equal(released.punch,null);
});
test("60Hz cooldown does not acquire an extra frame from floating-point residue",()=>{
  const m=new PreviewMotion(),hits=[];
  for(let n=0;n<60;n++)for(const e of m.step(1000/60,{punch:true}).events)
    if(e.type==="punch")hits.push(e.at);
  for(let n=1;n<hits.length;n++)assert.ok(Math.abs(hits[n]-hits[n-1]-200)<1e-6);
});
