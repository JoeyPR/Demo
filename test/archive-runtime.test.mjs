import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {mountedGaitProfile} from "../src/mounted-gait.mjs";
import {sampleSpriteFrame,updateMachines,curveSample} from "../src/xml-renderer.mjs";
const renderers=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url))).scripts;
const frame=(clockMs,locomotion="idle")=>({clockMs,moveMs:clockMs,ground:true,
  locomotion,facing:1,vx:locomotion==="walk"?90:0,vy:0});
test("compiled renderer data preserves all 314 source definitions",()=>assert.equal(Object.keys(renderers).length,314));
test("Starry tuple-sized sprite binds and uses total duration",()=>{
  const i=normalizeCatalogItem({id:1,slot:6,script:"StarryAura",gameIcon:[
    {a:"particles_large16.png",sx:0,sy:512,sw:64,sh:64,x:16,y:32,ax:.5,ay:1,u:0}
  ]},{renderers});
  assert.equal(i.xmlBoundCount,1);
  advanceCatalogItem(i,400,frame(400));assert.equal(i.pieces[0].sx,128);
});
test("XML Cumulus motion transitions restart the owning clip",()=>{
  const r=renderers.Cumulus,i={};
  let states=updateMachines(r,i,0,frame(0));
  const idle=sampleSpriteFrame(r,"s_Left",400,states,frame(400));
  assert.ok(idle.track.includes("Idle"));assert.equal(idle.duration,1200);
  states=updateMachines(r,i,500,frame(500,"walk"));
  const moving=sampleSpriteFrame(r,"s_Left",800,states,frame(800,"walk"));
  assert.ok(moving.track.includes("Move"));assert.equal(moving.duration,600);
  assert.notDeepEqual(moving.cell,idle.cell);
});
test("curve interpolation clamps and linearly interpolates components",()=>{
  const c={c:[{tag:"KeyFrame",v:"0,1,2"},{tag:"KeyFrame",v:"1,3,4"}]};
  assert.deepEqual(curveSample(c,.5),[2,3]);assert.deepEqual(curveSample(c,9),[3,4]);
});
test("horse gait excludes complete 64px sprites and applies only during travel",()=>{
  const raw={id:1,name:"Stick Horse",slot:3,gameIcon:[
    {a:"player_sit.png",sx:64,sy:32,sw:32,sh:32,x:16,y:32,u:10.5,seat:1,skin:1},
    {a:"horse.png",sx:0,sy:0,sw:32,sh:32,x:16,y:32,u:10},
    {a:"horse.png",sx:0,sy:32,sw:32,sh:32,x:16,y:32,u:10}]};
  const i=normalizeCatalogItem(raw,{});assert.ok(mountedGaitProfile(i));
  advanceCatalogItem(i,0,frame(0,"walk"));advanceCatalogItem(i,115,frame(115,"walk"));
  // Rider bob tuning: the moving-hop period is the original 460 ms reference
  // (see mounted-gait.mjs), so the 115 ms sample hits the peak again.
  assert.equal(i.gait.bodyY,-1.5*Math.abs(Math.sin(2*Math.PI*115/460)));assert.ok(i.pieces[1].y!==i.pieces[2].y);
  advanceCatalogItem(i,100,frame(100));assert.equal(i.gait.active,false);
  const full=normalizeCatalogItem({...raw,gameIcon:[...raw.gameIcon,{a:"whole.png",sw:64,sh:64,x:16,y:32,u:10}]},{});
  assert.equal(mountedGaitProfile(full),null);
});
test("public pet frame duration is total and it is not arm-attached",()=>{
  const raw={id:1,slot:5,cell:[1,1,0],parts:[{pet:true,atlas:"pet.png"}],
    petCells:{move:{ms:400,cells:[[0,0],[1,0],[2,0],[3,0]]}},
    gameIcon:[{a:"pet.png",sx:0,sy:0,sw:32,sh:32,x:-16,y:32,pet:1,u:12}]};
  const i=normalizeCatalogItem(raw,{});
  // The source steps the pet on its own 60Hz tick clock and clamps frames to
  // 50ms; the pet chases a 20-tick-deep trail, so it only starts moving once
  // the trail flushes (~21 ticks of walking). t68 then reads 22/60 s (~367ms),
  // which samples move-row cell 3 at 400ms/4 frames.
  const walkFrame=k=>({clockMs:k*1000/60,moveMs:k*1000/60,ground:true,locomotion:"walk",
    facing:1,vx:90,vy:0,dtMs:1000/60,x:k*90/60,y:0});
  advanceCatalogItem(i,0,walkFrame(0));
  for(let k=1;k<=21;k++)advanceCatalogItem(i,k*1000/60,walkFrame(k));
  assert.equal(i.pieces[0].sx,96);assert.equal(i.pieces[0].attachment,"pet");
});
