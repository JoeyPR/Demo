import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {resolveItemPose} from "../src/pose-resolver.mjs";
import {resolveWear} from "../src/render.mjs";
const catalog={arm:{back:{x:24,y:18},front:{x:9,y:18}},frameMs:225};
const still={ground:true,locomotion:"idle"};
const mount=()=>normalizeCatalogItem({id:1,slot:3,name:"Synthetic seat fixture",
  pose:{arm1:-35,arm2:-35},parts:[{atlas:"vehicle.png",cell:[1,2,1],frames:[[6,1],[7,1]],ms:225}],
  gameIcon:[
    {a:"vehicle.png",sx:192,sy:96,sw:32,sh:32,x:16,y:32.5,u:10},
    {a:"vehicle.png",sx:192,sy:64,sw:32,sh:32,x:16,y:32.5,u:10.5},
    {a:"player_horsepants.png",sx:0,sy:0,sw:16,sh:16,x:16,y:31.5,u:10.5,seat:1,skin:1},
    {lift:[0,-.5]}]},catalog);
test("catalog adapter keeps captured seat and legacy lift",()=>{
  const i=mount();assert.equal(i.pieces.length,3);assert.equal(i.pieces[2].attachment,"mount");
  assert.equal(i.pieces[2].pass,"RenderSeat");assert.equal(i.riderLift,-.5);
  assert.equal(i.hideLegs,true);assert.equal(i.noPants,true);
});
test("public part animation does not overwrite seat or split-row coordinates",()=>{
  const i=mount();advanceCatalogItem(i,0,{ground:true,locomotion:"walk"});
  advanceCatalogItem(i,225,{ground:true,locomotion:"walk"});
  assert.equal(i.pieces[0].sx,224);assert.equal(i.pieces[0].sy,96);
  assert.equal(i.pieces[1].sy,64);assert.equal(i.pieces[2].sx,0);
});
test("static ordinary item pose only participates in neutral state",()=>{
  const i={slot:5,id:2,staticArmPose:{backAngle:-30,frontAngle:-30}};
  assert.equal(resolveItemPose([i],still).override.frontAngle,-30);
  for(const f of [{...still,locomotion:"walk"},{...still,ground:false,locomotion:"jump"},{...still,punch:{ageMs:100}}])
    assert.equal(resolveItemPose([i],f).override.frontAngle,undefined);
});
test("undefined neutral angles cannot clear previous authored pose",()=>{
  const a={id:2,slot:5,staticArmPose:{frontAngle:-30}},b={id:3,slot:0,staticArmPose:{frontAngle:undefined}};
  assert.equal(resolveItemPose([a,b],still).override.frontAngle,-30);
});
test("mount states distinguish neutral, travel, air and punching",()=>{
  const i=mount();
  assert.equal(resolveItemPose([i],still).state,"ridingstill");
  assert.equal(resolveItemPose([i],{...still,locomotion:"walk"}).state,"ridingmove");
  assert.equal(resolveItemPose([i],{...still,ground:false,locomotion:"fall"}).state,"ridingair");
  const punch=resolveItemPose([i],{...still,punch:{ageMs:100}});
  assert.equal(punch.state,"ridingpunch");assert.equal(punch.override.frontAngle,undefined);
  assert.equal(punch.override.disableWalk,true);
});
test("explicit feet descriptor outranks held-item descriptor",()=>{
  const i=mount();i.statePoses={walk:{frontAngle:-42}};
  const hand={id:2,slot:5,statePoses:{walk:{frontAngle:100}}};
  assert.equal(resolveItemPose([hand,i],{...still,locomotion:"walk"}).override.frontAngle,-42);
});
test("floating face is not a seated mount and cannot replace explicit zero vehicle lift",()=>{
  const face=normalizeCatalogItem({id:2,slot:4,riderLift:-10,gameIcon:[]},catalog);
  const vehicle=normalizeCatalogItem({id:3,slot:3,riderLift:0,gameIcon:[{lift:[0,0]}]},catalog);
  assert.equal(face.vehicle,false);assert.equal(face.seated,false);
  assert.equal(vehicle.vehicle,true);assert.equal(vehicle.seated,false);
  assert.equal(resolveWear([face,vehicle]).riderLift,0);
  const ordinary=normalizeCatalogItem({id:4,slot:0,gameIcon:[]},catalog);
  assert.equal(ordinary.riderLift,undefined);
  assert.equal(resolveWear([ordinary,face]).riderLift,-10);
});
test("captured arms become one pose instead of duplicate body arm sprites",()=>{
  const i=normalizeCatalogItem({id:2,slot:3,riderLift:-10,gameIcon:[
    {a:"player_arm.png",x:24,y:18,r:-45,skin:1},
    {a:"player_arm.png",x:9,y:18,r:-45,skin:1}]},catalog);
  assert.equal(i.pieces.length,0);assert.equal(i.staticArmPose.frontAngle,-45);
  assert.equal(i.staticArmPose.backAngle,-45);
});
