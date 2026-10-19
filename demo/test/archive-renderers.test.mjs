import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../engine/catalog-adapter.mjs";
import {mountedGaitProfile} from "../engine/mounted-gait.mjs";
import {sampleSpriteFrame,curveSample} from "../engine/xml-renderer.mjs";
import {PlannerPlayer} from "../engine/player.mjs";
const catalog=JSON.parse(fs.readFileSync(new URL("../catalog.json",import.meta.url)));
catalog.renderers=JSON.parse(fs.readFileSync(new URL("../renderer-data.json",import.meta.url))).scripts;
catalog.liftProfiles=Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../lift-profiles.json",import.meta.url))).profiles.map(p=>[p.id,p]));
const item=id=>normalizeCatalogItem(catalog.items.find(i=>i.id===id),catalog);
const motion=(clockMs,state="idle",facing=1)=>({clockMs,moveMs:clockMs,locomotion:state,
  x:0,y:0,vx:state==="walk"?90*facing:0,vy:state==="jump"?-80:state==="fall"?80:0,
  facing,ground:!["jump","fall"].includes(state),events:[]});
const advance=(i,t,state="idle",facing=1)=>advanceCatalogItem(i,t,motion(t,state,facing));
test("archive compiles all 314 renderer files with only identical-attribute repairs",()=>{
  const data=JSON.parse(fs.readFileSync(new URL("../renderer-data.json",import.meta.url)));
  assert.equal(Object.keys(data.scripts).length,314);assert.deepEqual(data.errors,[]);
  assert.ok(data.repairs.length>=4);
});
test("Riding Cloud floats at idle, blinks on an ambient clock, and is not horse-gait driven",()=>{
  const i=item(11168),p=new PlannerPlayer(catalog,[i]);
  advance(i,0);const neutral=i.pieces[0].sx;
  advance(i,1400);assert.notEqual(i.pieces[0].sx,neutral);
  assert.ok(i.referencePieces.every(p=>!p.sequence||p.sequence.policy==="ambient"));
  assert.equal(mountedGaitProfile(i),null);
  const top=p.step(motion(250),16).lift.y,bottom=p.step(motion(750),16).lift.y;
  assert.equal(top,-7);assert.equal(bottom,-9);
});
test("split horse-sit mounts move rider and opposing halves, stop idle, and skip air",()=>{
  for(const id of [1012,592,1018,1978,2214])for(const facing of [-1,1]){
    const i=item(id),p=new PlannerPlayer(catalog,[i]);assert.ok(mountedGaitProfile(i),`${id} gait`);
    p.step(motion(0,"walk",facing),16);const result=p.step(motion(115,"walk",facing),16);
    assert.ok(result.lift.gait.active);assert.equal(result.lift.gait.bodyY,-1.5);
    const records=i.pieces.filter(p=>p.attachment==="mount"&&!p.seat);
    assert.ok(new Set(records.map(p=>p.y)).size>1,`${id} split sides slide`);
    assert.equal(p.step(motion(100,"idle",facing),16).lift.gait,undefined);
    p.step(motion(200,"jump",facing),16);assert.equal(i.gait.active,false);
  }
});
test("one-piece mounts never receive inferred opposing halves",()=>{
  for(const raw of catalog.items){
    const i=normalizeCatalogItem(raw,catalog);
    if((raw.gameIcon??[]).some(p=>!p.skin&&!p.seat&&(p.sw>32||p.sh>32)))
      assert.equal(mountedGaitProfile(i),null,raw.name);
  }
});
test("Cumulus and Royal Cumulus use authored 1200ms idle and 600ms movement clips",()=>{
  for(const id of [15934,15936]){
    const i=item(id);advance(i,0);advance(i,400);
    assert.ok(i.pieces.filter(p=>!p.xmlParticle).every(p=>p.xmlTrack?.includes("Idle")));
    const still=i.pieces[0].sx;advance(i,500,"walk");advance(i,800,"walk");
    assert.ok(i.pieces.filter(p=>!p.xmlParticle).every(p=>p.xmlTrack?.includes("Move")));
    assert.notEqual(i.pieces[0].sx,still);advance(i,900);
    assert.equal(i.animationState.xmlStates.Motion,"Idle");
    assert.equal(i.pieces[0].sx,19*32);
  }
});
test("Riding Bilby resolves XML Idle/Walk/Jump/Fall, retaining both sides",()=>{
  const i=item(15398);
  for(const state of ["idle","walk","jump","fall"]){
    advance(i,0,state);advance(i,300,state);
    assert.equal(i.animationState.xmlStates.Action,state[0].toUpperCase()+state.slice(1));
    assert.equal(i.pieces.filter(p=>p.xmlTrack).length,2);
  }
});
test("Starry Night Aura uses six 64px frames over 1200ms",()=>{
  const i=item(15654);advance(i,0);assert.equal(i.pieces[0].sx,0);
  advance(i,400);assert.equal(i.pieces[0].sx,128);assert.equal(i.pieces[0].sw,64);
  advance(i,1200);assert.equal(i.pieces[0].sx,0);
  assert.equal(i.pieces[0].noFacing,true);
  const p=new PlannerPlayer(catalog,[i]);
  const facing=p.step(motion(400,"idle",-1),16).calls.find(c=>c.owner===i.id);
  assert.ok(facing.matrix[0]>0,"XML SetFlip=false retains aura orientation in both facings");
});
test("Dirt, Twilight and Infinity aura particle-backed paths produce finite sprites",()=>{
  for(const id of [14420,14800,14086]){
    const i=item(id);advance(i,0,"walk");advance(i,750,"walk");
    assert.ok(i.pieces.some(p=>p.xmlParticle),`${id} particles`);
    assert.ok(i.pieces.every(p=>[p.sx,p.sy,p.x,p.y,...(p.k??[])].every(Number.isFinite)));
  }
});
test("petCells use total duration, switch motion row, and follower lags reversal",()=>{
  const i=item(870);advance(i,0);advance(i,150,"walk");
  const pet=()=>i.pieces.find(p=>p.attachment==="pet");
  const cells=i.raw.petCells.move;
  const expected=cells.cells[Math.floor(150/cells.ms*cells.cells.length)];
  assert.equal(pet().sx,expected[0]*32);assert.equal(pet().sy,expected[1]*32);
  advance(i,200,"walk");
  const x=i.petMotion.x;advance(i,216,"walk",-1);assert.ok(i.petMotion.x>x&&i.petMotion.x<56);
});
test("all catalog items remain finite with XML, pet and mount motion in twelve states/times",()=>{
  let count=0;
  for(const raw of catalog.items)for(const state of ["idle","walk","jump","fall"]){
    const i=normalizeCatalogItem(raw,catalog);
    for(const t of [0,400,1200]){
      advance(i,t,state);
      assert.ok(i.pieces.every(p=>[p.sx,p.sy,p.sw,p.sh,p.x,p.y,...(p.k??[])].every(Number.isFinite)),`${raw.id} ${state} ${t}`);
      count++;
    }
  }assert.equal(count,48972);
});
