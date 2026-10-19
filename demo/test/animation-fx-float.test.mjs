import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCatalogItem,advanceCatalogItem} from "../engine/catalog-adapter.mjs";
import {samplePublicParts} from "../engine/items.mjs";
import {sampleLiftProfile,resolvePlayerLift} from "../engine/lift.mjs";
import {PlannerPlayer} from "../engine/player.mjs";
import {extractSpritePixels} from "../engine/canvas-assets.mjs";
const catalog=JSON.parse(fs.readFileSync(new URL("../catalog.json",import.meta.url)));
const data=JSON.parse(fs.readFileSync(new URL("../lift-profiles.json",import.meta.url)));
catalog.liftProfiles=Object.fromEntries(data.profiles.map(p=>[p.id,p]));
const get=id=>normalizeCatalogItem(catalog.items.find(i=>i.id===id),catalog);
const frame={x:0,y:0,facing:1,ground:true,clockMs:250,moveMs:250,locomotion:"idle",events:[]};
test("64x64 Morty airborne sequences move both rows without changing pixel size",()=>{
  const i=get(7836),before=i.pieces.map(p=>({...p}));
  advanceCatalogItem(i,0,{ground:false,locomotion:"jump"});
  advanceCatalogItem(i,225,{ground:false,locomotion:"jump"});
  assert.equal(i.pieces[0].sx,before[0].sx+64);assert.equal(i.pieces[1].sx,before[1].sx+64);
  for(let p=0;p<2;p++){assert.equal(i.pieces[p].sy,before[p].sy);assert.equal(i.pieces[p].sw,64);assert.equal(i.pieces[p].sh,64);}
});
test("clockFrames changes 32px Golden Aura sprites from source cell sequence",()=>{
  const i=get(2722);advanceCatalogItem(i,0);const a=i.pieces.map(p=>p.sx);
  advanceCatalogItem(i,50);assert.notDeepEqual(i.pieces.map(p=>p.sx),a);
  for(const p of i.pieces)assert.equal(p.sw,32);
});
test("Golden Aura additive blending and flicker reach normalized draw calls",()=>{
  const i=get(2722);advanceCatalogItem(i,16);
  const first=i.pieces.map(p=>p.k);advanceCatalogItem(i,83);
  assert.notDeepEqual(i.pieces.map(p=>p.k),first);
  const r=new PlannerPlayer(catalog,[i]).step(frame,16);
  assert.ok(r.calls.some(c=>c.owner===2722&&c.add));
  assert.ok(r.calls.some(c=>c.owner===2722&&Math.abs(c.alpha-.5019607843)<1e-8));
});
test("dark aura uses normal blend even when its scale flickers",()=>{
  const i=get(3114);advanceCatalogItem(i,16);
  assert.ok(i.pieces.every(p=>!p.add));
});
test("public pulse uses independent x and y periods",()=>{
  const i=get(2970);advanceCatalogItem(i,250);
  const p=i.pieces.find(p=>p.pulse);assert.ok(p);assert.notEqual(p.k[0],p.k[1]);
});
test("known floating items bob automatically without the generic float override",()=>{
  for(const id of [1876,3074,5088,11168,14048]) {
    const i=get(id);const a=resolvePlayerLift([i],250),b=resolvePlayerLift([i],750);
    assert.notEqual(a.y,b.y,`${id} moves`);assert.equal(a.profile.periodMs,1000);
    assert.ok(Math.abs(resolvePlayerLift([i],1250).y-a.y)<1e-6);
  }
});
test("floating vehicle and seated pixels share the oscillatory delta",()=>{
  const i=get(11168),lift=resolvePlayerLift([i],250);
  assert.equal(lift.vehicleY,1);assert.equal(lift.y,-7);
  const p=new PlannerPlayer(catalog,[i]),a=p.step(frame,16),b=p.step({...frame,clockMs:750},16);
  const mountA=a.calls.find(c=>c.owner===i.id),mountB=b.calls.find(c=>c.owner===i.id);
  assert.ok(Math.abs(mountA.matrix[5]-mountB.matrix[5])>1);
});
test("disagreeing still versus source profiles are not silently enabled",()=>{
  const p=data.profiles.find(p=>!p.publicStillAgrees);assert.ok(p);
  assert.equal(sampleLiftProfile(p,250),null);
});
test("public fallback keeps top-left origin, full cell size and stacked rows separate",()=>{
  const i={raw:{slot:6,cell:[2,2,0],parts:[{atlas:"test.png",cell:[2,2,0],frames:[[1,2]],at:[-48,-16]}]}};
  const [r]=samplePublicParts(i,0,catalog);assert.deepEqual([r.x,r.y,r.sw,r.sh,r.ax,r.ay],[-48,-16,64,64,0,0]);
  i.raw.parts[0].cell=[1,2,1];const rows=samplePublicParts(i,0,catalog);
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.sh===32));assert.notEqual(rows[0].sy,rows[1].sy);
});
test("all eligible default-state profiles agree with changed-input source fixtures",()=>{
  const {fixtures}=JSON.parse(fs.readFileSync(new URL("../../evidence/lift-differential-fixtures.json",import.meta.url)));
  let samples=0;
  for(const f of fixtures) {
    const p=catalog.liftProfiles[f.id];if(!p.publicStillAgrees)continue;
    for(const s of f.samples){assert.ok(Math.abs(sampleLiftProfile(p,s.ms)-s.expected)<2e-5,`${f.id} ${s.ms}`);samples++;}
  }
  assert.ok(samples>2000);console.log(`${samples} changed-input lift comparisons`);
});
test("texture edge clamping and pet wrapping match isolated source pixels",()=>{
  const d=JSON.parse(fs.readFileSync(new URL("../../evidence/sampler-differential-fixtures.json",import.meta.url)));
  for(const f of d.fixtures)assert.deepEqual(Array.from(extractSpritePixels(
    new Uint8ClampedArray(d.pixels),d.width,d.height,f.rect)),f.expected);
});
test("Mage's Orb starts from its actual frame cell instead of adding the capture-phase offset",()=>{
  const i=get(7392);advanceCatalogItem(i,0);assert.equal(i.pieces[0].sx,0);
  advanceCatalogItem(i,225);assert.equal(i.pieces[0].sx,32);
  advanceCatalogItem(i,1575);assert.equal(i.pieces[0].sx,224);
});
test("Pineapple Chakram particles orbit in body space and change occlusion pass",()=>{
  const i=get(10886);advanceCatalogItem(i,250);
  const a=i.pieces.filter(p=>p.a==="particles7.png").map(p=>({...p}));
  advanceCatalogItem(i,1500);const b=i.pieces.filter(p=>p.a==="particles7.png");
  assert.equal(a.length,3);assert.equal(b.length,3);
  assert.ok(a.every(p=>p.attachment==="body"));
  assert.notDeepEqual(a.map(p=>[p.x,p.y,p.pass]),b.map(p=>[p.x,p.y,p.pass]));
});
