import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {petKindFor,petConfigFor} from "../src/pet-system.mjs";
const catalog=JSON.parse(fs.readFileSync(new URL("../demo/catalog.json",import.meta.url)));
catalog.renderers=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url))).scripts;
catalog.liftProfiles=Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../demo/lift-profiles.json",import.meta.url))).profiles.map(p=>[p.id,p]));
const item=id=>normalizeCatalogItem(catalog.items.find(i=>i.id===id),catalog);
// The source steps pets on their own tick clock (60Hz, frames clamped to 50ms)
// and hosts them at the rig's top-left edge: the 32x32 rig's feet line sits at
// hostY+32. Frames below run at the source's step rate; walking hosts move in
// world space so the pet's trail has somewhere to follow.
const frame=(k,state="idle",facing=1,x=0)=>({clockMs:k*1000/60,moveMs:k*1000/60,ground:true,
  locomotion:state,facing,vx:state==="walk"?90*facing:0,vy:0,dtMs:1000/60,x,y:0,events:[]});
const run=(id,n,state="idle",facing=1)=>{
  const i=item(id);let m,hx=0;
  for(let k=0;k<n;k++){if(state==="walk")hx+=90/60*facing;m=frame(k,state,facing,hx);
    advanceCatalogItem(i,k*1000/60,m);}
  return [i,m];
};

test("pet kind lookup follows the source item tables",()=>{
  assert.equal(petKindFor(870),0); // Calf Leash: plain trail follower
  assert.equal(petKindFor(882),1); // Butterfly Leash: flyer
  assert.equal(petKindFor(11704),200); // Alpha Wolf: kind-200 machine
  assert.equal(petKindFor(12350),100); // Personal Storm Cloud: hidden pet
  assert.equal(petKindFor(15336),38); // Captain Bark: flyWalk script pet
  assert.deepEqual(petConfigFor(11704).machine,{off:[-36,-32],speed:[350,340],snap:320,trail:20,
    lerp:[1,1],machine:"wolf",row:13});
  assert.deepEqual(petConfigFor(870).offset,[0,0]);
});

test("trail pet spawns behind the player and only moves once its trail flushes",()=>{
  const [i,m]=run(870,1); // spawn frame
  // Behind = BEHIND(16) left of the rig center (hostX+16); the host sits at
  // x=0, so the spawn point is exactly the host's left edge (0, feet line).
  assert.ok(Math.abs(m.pet.x)<2&&Math.abs(m.pet.y)<2,`spawn ${m.pet.x},${m.pet.y}`);
  assert.ok(m.pet.x<16,"the pet spawns left of the rig center");
  const still=run(870,10)[1];
  assert.ok(Math.abs(still.pet.x-m.pet.x)<0.01,"idle host keeps the pet at the spawn point");
  // 21 walking frames flush the 20-tick trail; the pet then chases the trail.
  const [i2,m2]=run(870,22,"walk");
  const pet=()=>i2.pieces.find(p=>p.pet&&!p.petLine);
  assert.ok(m2.pet.x>m.pet.x,"pet follows a walking host");
  assert.equal(pet().pass,"RenderPet");
  assert.equal(pet().attachment,"pet");
  assert.ok(pet().unlifted,"pet pieces ignore the player lift");
});

test("machine pets read 64x64 cells straight off their sheets and animate",()=>{
  const [wolf,mw]=run(11704,40);
  const w=wolf.pieces.filter(p=>p.pet);
  assert.equal(w.length,1);
  assert.equal(w[0].a,"tf_page1.png");
  assert.deepEqual([w[0].sw,w[0].sh],[64,64]);
  // Resting cell (0,13) is rect-relative to the part rect [0,736,64,32]:
  // the piece reads (rect.x, rect.y-32) absolute, i.e. (0,704) on the sheet.
  assert.deepEqual(mw.pet.cell,[3,13]); // 40 ticks ~ 667ms of the 200ms idle row
  assert.equal(w[0].sx,3*64);assert.equal(w[0].sy,13*64);
  const early=run(11704,10)[1];
  assert.deepEqual(early.pet.cell,[0,13],"idle row starts at cell 0");
  const [dragon]=run(11562,40).map(x=>x);
  const d=dragon.pieces.filter(p=>p.pet);
  assert.equal(d[0].sx,3*64);assert.equal(d[0].sy,8*64); // dragon row 8
  const [mask,mm]=run(13116,40);
  assert.equal(mm.pet.cell[1],14); // mask idle row 14 on particles_large8
  assert.equal(mask.pieces.filter(p=>p.pet)[0].a,"particles_large8.png");
});

test("fly pets stay near the player while the host walks",()=>{
  const [,m]=run(882,40,"walk");
  assert.ok(m.pet.dist<120,`butterfly distance ${m.pet.dist}`);
  assert.ok(Math.abs(m.pet.x)<80&&Math.abs(m.pet.y)<40,`butterfly position ${m.pet.x},${m.pet.y}`);
});

test("punch events set PunchDelay to 1 and it decays on the pet clock",()=>{
  const i=item(870);
  let m=frame(0);advanceCatalogItem(i,0,m);
  m=frame(1);m.punch={ageMs:0,target:[16,16]};m.events=[{type:"punch",id:"punch:1"}];
  advanceCatalogItem(i,1000/60,m);
  assert.equal(m.petVars.PunchDelay,1);
  m=frame(2);m.punch={ageMs:1000/60,target:[16,16]};
  advanceCatalogItem(i,2000/60,m);
  assert.ok(m.petVars.PunchDelay<1,"PunchDelay decays after the punch frame");
});

test("flyWalk pets publish the PetFlyWalk variables the XML states read",()=>{
  const [,m]=run(15336,30,"walk");
  assert.equal(m.petVars["PetFlyWalk.IsFlying"],false);
  assert.equal(m.petVars["PetFlyWalk.IsWalking"],true);
  assert.ok("PetFlyWalk.landingSpeed" in m.petVars||"PetFlyWalk.timer" in m.petVars,
    "PetFlyWalk state keys are published flat for CompareCustomVariable");
});

test("hidden pets draw their authored piece without a pet transform",()=>{
  const [i,m]=run(12350,30);
  assert.equal(m.pet,null);
  const piece=i.pieces.find(p=>p.pet);
  assert.ok(piece,"the storm cloud piece still renders");
  assert.equal(piece.k,undefined,"no pet transform is applied");
});

test("the Legendary Owl ships no pet records, so no pet engine runs for it",()=>{
  // Source-shared data gap: item 11142's parts record lacks pet:1 and it has no
  // gameIcon pet pieces; the live client gates the pet engine the same way.
  const [i,m]=run(11142,30);
  assert.equal(i.pieces.filter(p=>p.pet).length,0);
  assert.equal(i.petEngine,undefined);
  assert.equal(m.pet,undefined);
});

test("pet pieces and leash lines stay bounded across long runs",()=>{
  // Kind-4 kite pets (Yeonnalligi) draw the leash string from the pet to the
  // arm-anchored hand point; the calf is a plain trail pet with no string.
  const i=item(1376);
  const counts=new Set();
  let m;
  for(let k=0;k<120;k++){m=frame(k,"walk");advanceCatalogItem(i,k*1000/60,m);counts.add(i.pieces.length);}
  assert.equal(counts.size,1,`piece count stable at ${[...counts]}`);
  const line=i.pieces.find(p=>p.petLine);
  assert.ok(line,"the leash string is a line piece");
  assert.ok([...line.line.from,...line.line.to,line.line.width??1].every(Number.isFinite),
    "leash string geometry stays finite");
});
