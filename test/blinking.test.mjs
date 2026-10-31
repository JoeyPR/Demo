import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sampleBlink,BLINK_LID} from "../src/blink.mjs";
import {buildDrawList} from "../src/render.mjs";
import {PlannerPlayer} from "../src/player.mjs";
const pose={frontFoot:0,backFoot:0,frontAngle:0,backAngle:0,face:[0,0]};
const motion={x:0,y:0,facing:1,clockMs:0,ground:true,locomotion:"idle",events:[]};
const calls=(visual={},items=[],face=[0,0])=>buildDrawList({catalog:{},pose:{...pose,face},motion,visual,items});

test("a blink closes, briefly holds, reopens and returns to the original face",()=>{
  const samples=Array.from({length:1400},(_,i)=>sampleBlink(i*5));
  const start=samples.findIndex(blink=>blink.phase==="closing");
  assert.ok(start>0);
  assert.ok(samples.slice(start).some(blink=>blink.phase==="closed"&&blink.closure===1));
  assert.ok(samples.slice(start).some(blink=>blink.phase==="opening"&&blink.closure>0&&blink.closure<1));
  assert.deepEqual(samples[start+50],{phase:"open",closure:0});
});
test("blink timing depends on simulation time, not sampling rate or previous frames",()=>{
  for(const time of [0,4000,4500,9250,31000,1e12]) {
    const expected=sampleBlink(time);
    for(let t=0;t<time&&t<10000;t+=16.667)sampleBlink(t);
    assert.deepEqual(sampleBlink(time),expected);
  }
  const a=Array.from({length:1000},(_,i)=>sampleBlink(i*10).closure);
  const b=Array.from({length:1000},(_,i)=>sampleBlink(i*10,{seed:2}).closure);
  assert.notDeepEqual(a,b);
  assert.deepEqual(sampleBlink(NaN),{phase:"open",closure:0});
});
test("the actual skin-tinted lid crop closes the eyes without replacing the mouth or expression",()=>{
  const open=calls(),shut=calls({blink:1,skin:[100,150,200,255]});
  const lid=shut.find(call=>call.tag==="blinkLids");
  assert.deepEqual([lid.atlas,lid.sx,lid.sy,lid.sw,lid.sh],
    ["player_eyes.png",160,99,32,5]);
  assert.deepEqual(lid.tint,[100,150,200]);assert.equal(lid.matrix[5],3);
  assert.equal(open.some(call=>call.tag==="blinkLids"),false);
  assert.deepEqual(shut.find(call=>call.tag==="eyes").sy,open.find(call=>call.tag==="eyes").sy);
  const half=calls({blink:.5}).find(call=>call.tag==="blinkLids");
  assert.equal(half.sh,3);
  for(const x of [1,2,4])assert.ok(calls({blink:1},[],[x,0]).some(call=>call.tag==="blinkLids"));
  assert.equal(calls({blink:1},[],[5,3]).some(call=>call.tag==="blinkLids"),false);
});
test("face hiding, headless transformations, invisibility and an explicit blink disable suppress the mask",()=>{
  for(const item of [{hideFace:true},{headless:true},{invisible:true},{hide:["eyes"]},{hide:["eyelids"]}]) {
    const result=calls({blink:1},[{id:1,slot:0,raw:{},pieces:[],...item}]);
    assert.equal(result.some(call=>call.tag==="blinkLids"),false);
  }
  assert.equal(calls({blink:1,blinking:false}).some(call=>call.tag==="blinkLids"),false);
});
test("PlannerPlayer publishes its sampled blink and keeps authored punch expressions",()=>{
  const player=new PlannerPlayer({});
  const out=player.step({...motion,punch:{ageMs:50}},16,{blink:1});
  assert.equal(out.pose.blink.closure,1);assert.deepEqual(out.pose.face,[4,0]);
  assert.ok(out.calls.some(call=>call.tag==="blinkLids"));
});
test("browser blink implementation mirrors the tested engine",()=>{
  for(const file of ["blink.mjs","render.mjs","player.mjs"])
    assert.equal(readFileSync(new URL("../src/"+file,import.meta.url),"utf8"),
      readFileSync(new URL("../demo/engine/"+file,import.meta.url),"utf8"));
});
