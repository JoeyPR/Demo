import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {sampleLiftProfile,resolvePlayerLift} from "../src/lift.mjs";
import {extractSpritePixels} from "../src/canvas-assets.mjs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
const read=name=>JSON.parse(fs.readFileSync(new URL("../evidence/"+name,import.meta.url)));
test("148 eligible profiles match 2072 changed-input source results",()=>{
  const profiles=Object.fromEntries(read("lift-profiles.json").profiles.map(p=>[p.id,p]));
  let count=0;
  for(const f of read("lift-differential-fixtures.json").fixtures) {
    const p=profiles[f.id];if(!p.publicStillAgrees)continue;
    for(const s of f.samples){assert.ok(Math.abs(sampleLiftProfile(p,s.ms)-s.expected)<2e-5);count++;}
  }
  assert.equal(count,2072);
});
test("disputed float profile stays disabled",()=>{
  assert.equal(sampleLiftProfile({base:-8,amplitude:2,periodMs:1000,publicStillAgrees:false},250),null);
});
test("vehicle and seat keep their shared dynamic float delta",()=>{
  const i={slot:3,id:1,vehicle:true,riderLift:-8,liftProfile:{base:-8,amplitude:1,periodMs:1000,publicStillAgrees:true}};
  const a=resolvePlayerLift([i],250),b=resolvePlayerLift([i],750);
  assert.equal(a.y,-7);assert.equal(a.vehicleY,1);assert.equal(b.y,-9);assert.equal(b.vehicleY,-1);
});
test("pixel sampler matches five isolated source crop fixtures",()=>{
  const d=read("sampler-differential-fixtures.json");
  for(const f of d.fixtures)assert.deepEqual(Array.from(extractSpritePixels(
    new Uint8ClampedArray(d.pixels),d.width,d.height,f.rect)),f.expected);
});
test("a captured later frame normalizes to a local offset, not a permanent phase",()=>{
  const c={frameMs:225},i=normalizeCatalogItem({id:1,slot:6,atlas:"test.png",
    parts:[{atlas:"test.png",cell:[1,1,0],frames:[[0,1],[1,1],[2,1],[3,1]]}],
    gameIcon:[{a:"test.png",sx:96,sy:32,sw:32,sh:32,x:16,y:32}]},c);
  advanceCatalogItem(i,0);assert.equal(i.pieces[0].sx,0);
  advanceCatalogItem(i,225);assert.equal(i.pieces[0].sx,32);
});
test("sprite clock, pulse and additive flag survive independent sampling",()=>{
  const i=normalizeCatalogItem({id:1,slot:6,clockFrames:{a:"test.png",size:32,cells:[[0,0],[1,0]],ms:50,pulse:1000},
    gameIcon:[{a:"test.png",sx:0,sy:0,sw:32,sh:32,x:0,y:0,add:1}]},{frameMs:175});
  advanceCatalogItem(i,250);assert.equal(i.pieces[0].sx,32);assert.equal(i.pieces[0].o,1);assert.equal(i.pieces[0].add,1);
});
