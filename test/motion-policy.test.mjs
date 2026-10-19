import test from "node:test";
import assert from "node:assert/strict";
import {sequencePolicy,sequenceTime,sampleSequenceIndex,isFloatingItem} from "../src/motion-policy.mjs";
import {PlannerPlayer} from "../src/player.mjs";
import {angleDelta} from "../src/math.mjs";
import {normalizeCatalogItem} from "../src/catalog-adapter.mjs";
const frame=(clockMs,locomotion="idle",extra={})=>({clockMs,moveMs:clockMs,x:0,y:0,
  facing:1,ground:!["jump","fall","glide"].includes(locomotion),locomotion,
  vx:locomotion==="walk"?90:0,events:[],...extra});
test("Morty family is airborne, vehicles travel, and authored policies override",()=>{
  for(const id of [7836,7838,7840,7842])assert.equal(sequencePolicy({id},{}),"air");
  assert.equal(sequencePolicy({vehicle:true},{}),"travel");
  assert.equal(sequencePolicy({vehicle:true},{animationPolicy:"ambient"}),"ambient");
});
test("neutral cells hold on ground and air clock survives jump to fall",()=>{
  const item={},seq={policy:"air",ms:225,frames:[0,1,2]};
  assert.equal(sampleSequenceIndex(seq,sequenceTime(item,0,frame(0)),0),0);
  sequenceTime(item,100,frame(100,"jump"));
  const air=sequenceTime(item,325,frame(325,"fall"));
  assert.equal(air.elapsedMs,225);assert.equal(sampleSequenceIndex(seq,air,325),1);
  assert.equal(sampleSequenceIndex(seq,sequenceTime(item,500,frame(500)),500),0);
});
test("travel clock restarts on entry but not direction reversal",()=>{
  const item={};
  sequenceTime(item,0,frame(0));
  sequenceTime(item,100,frame(100,"walk"));
  assert.equal(sequenceTime(item,325,frame(325,"walk",{facing:-1,vx:-90})).elapsedMs,225);
  assert.equal(sequenceTime(item,400,frame(400)).elapsedMs,0);
});
test("floating inference is not merely a negative rider offset",()=>{
  assert.equal(isFloatingItem({riderLift:-9}),false);
  assert.equal(isFloatingItem({raw:{gameOptions:{ShouldHover:true}}}),true);
  assert.equal(isFloatingItem({floatBehavior:{enabled:false},raw:{script:"Cumulus"}}),false);
});
test("floating movement and stop share the rig transition path",()=>{
  const catalog={frameMs:225};
  const item=normalizeCatalogItem({id:1,slot:5,parts:[],gameIcon:[],floatBehavior:{enabled:true}},catalog);
  const player=new PlannerPlayer(catalog,[item]);
  let result;
  for(let n=0;n<8;n++)result=player.step(frame(n*16.667,"walk"),16.667);
  assert.equal(angleDelta(0,result.pose.backAngle),-45);
  assert.equal(angleDelta(0,result.pose.frontAngle),45);
  for(let n=8;n<16;n++)result=player.step(frame(n*16.667),16.667);
  assert.equal(angleDelta(0,result.pose.backAngle),0);
  assert.equal(angleDelta(0,result.pose.frontAngle),0);
});
