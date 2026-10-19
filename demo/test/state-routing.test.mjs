import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCatalogItem,advanceCatalogItem} from "../engine/catalog-adapter.mjs";
import {PlannerPlayer} from "../engine/player.mjs";
import {PlayerRig,armMatrix,playerRoot} from "../engine/rig.mjs";
import {compose,point,angleDelta} from "../engine/math.mjs";
import {resolveItemPose} from "../engine/pose-resolver.mjs";
import {resolvePlayerLift} from "../engine/lift.mjs";
const catalog=JSON.parse(fs.readFileSync(new URL("../catalog.json",import.meta.url)));
catalog.liftProfiles=Object.fromEntries(JSON.parse(fs.readFileSync(
  new URL("../lift-profiles.json",import.meta.url))).profiles.map(p=>[p.id,p]));
const item=id=>normalizeCatalogItem(catalog.items.find(i=>i.id===id),catalog);
const frame=(t=0,mode="idle",extra={})=>({clockMs:t,moveMs:t,locomotion:mode,
  ground:!["jump","fall","glide"].includes(mode),x:0,y:0,vx:mode==="walk"?90:0,vy:0,facing:1,events:[],...extra});
const cells=i=>i.pieces.map(p=>[p.sx,p.sy,p.sw,p.sh]);
function settle(player,mode,t=0,extra={}) {
  let result;
  for(let n=0;n<8;n++)result=player.step(frame(t+n*1000/60,mode,extra),1000/60);
  return result;
}
test("floating travel eases to opposite 45 degree arms and holds in either facing",()=>{
  for(const facing of [1,-1]) {
    const player=new PlannerPlayer(catalog,[item(1876)]);
    const start=player.step(frame(0,"walk",{facing,vx:facing*90}),1000/60);
    assert.ok(Math.abs(angleDelta(0,start.pose.backAngle))>0&&Math.abs(angleDelta(0,start.pose.backAngle))<45);
    const result=settle(player,"walk",20,{facing,vx:facing*90});
    assert.equal(angleDelta(0,result.pose.backAngle),-45);
    assert.equal(angleDelta(0,result.pose.frontAngle),45);
    const later=settle(player,"walk",1000,{facing,vx:facing*90});
    assert.equal(angleDelta(0,later.pose.backAngle),-45);assert.equal(angleDelta(0,later.pose.frontAngle),45);
    // Test screen-space direction, not just raw angle signs after mirroring.
    for(const [side,origin,angle] of [["back",[24,18],later.pose.backAngle],["front",[9,18],later.pose.frontAngle]]) {
      const root=playerRoot(frame(0,"walk",{facing}));
      const joint=point(root,origin);
      const end=point(compose(root,armMatrix(side,angle)),[origin[0],origin[1]+10]);
      assert.ok(joint[0]<16?end[0]<joint[0]:end[0]>joint[0],`${side} ${facing} points outward`);
    }
  }
});
test("stopping eases floating arms back to neutral instead of snapping or keeping spread",()=>{
  const p=new PlannerPlayer(catalog,[item(1876)]);settle(p,"walk");
  const start=p.step(frame(200,"idle"),1000/60);
  assert.ok(Math.abs(angleDelta(0,start.pose.backAngle))<45&&Math.abs(angleDelta(0,start.pose.backAngle))>0);
  const stopped=settle(p,"idle",220);
  assert.equal(angleDelta(0,stopped.pose.backAngle),0);assert.equal(angleDelta(0,stopped.pose.frontAngle),0);
  assert.equal(stopped.poseResolution.state,"floatingstill");
});
test("floating arm spread never suppresses a punch or an airborne pose",()=>{
  const p=new PlannerPlayer(catalog,[item(1876)]);settle(p,"walk");
  const hit=p.step(frame(200,"walk",{punch:{ageMs:100}}),1000/60);
  assert.ok(hit.pose.punch);assert.notEqual(angleDelta(0,hit.pose.backAngle),-45);
  assert.equal(resolveItemPose([item(1876)],frame(210,"jump")).override.floatArms,undefined);
});
test("ordinary nonfloating clothing does not receive the floating travel arm pose",()=>{
  const p=new PlannerPlayer(catalog,[item(36)]),r=settle(p,"walk");
  assert.equal(r.poseResolution.floating,false);assert.equal(r.poseResolution.override.floatArms,undefined);
});
test("all four Morty variants hold a neutral ground cell and flap only airborne",()=>{
  for(const id of [7836,7838,7840,7842]) {
    const i=item(id);advanceCatalogItem(i,0,frame());
    const neutral=cells(i);
    for(const [t,mode] of [[500,"idle"],[1800,"walk"],[2500,"walk"],[3800,"idle"]]) {
      advanceCatalogItem(i,t,frame(t,mode));assert.deepEqual(cells(i),neutral,`${id} grounded ${mode}`);
    }
    advanceCatalogItem(i,4000,frame(4000,"jump"));
    advanceCatalogItem(i,4225,frame(4225,"jump"));assert.notDeepEqual(cells(i),neutral,`${id} airborne`);
    const staticTrunk=i.pieces.find(p=>!p.sequence);
    advanceCatalogItem(i,4450,frame(4450,"fall"));assert.equal(i.animationState.elapsedMs,450);
    assert.deepEqual(i.pieces.find(p=>!p.sequence),staticTrunk);
    advanceCatalogItem(i,5000,frame(5000,"idle"));assert.deepEqual(cells(i),neutral,`${id} lands`);
  }
});
test("mounts have distinct stationary and moving clips, including raw still mounts",()=>{
  for(const id of [592,1320,1950,2048,2974,6040]) {
    const i=item(id);if(!i.referencePieces.some(p=>p.sequence?.policy==="travel"))continue;
    advanceCatalogItem(i,0,frame());const neutral=cells(i);
    advanceCatalogItem(i,5000,frame(5000));assert.deepEqual(cells(i),neutral,`${id} idle held`);
    let changed=false;
    for(let n=0;n<8;n++) {
      advanceCatalogItem(i,5100+n*225,frame(5100+n*225,"walk"));changed||=JSON.stringify(cells(i))!==JSON.stringify(neutral);
    }
    assert.ok(changed,`${id} walks`);
    advanceCatalogItem(i,8000,frame(8000));assert.deepEqual(cells(i),neutral,`${id} stops`);
  }
});
test("travel gating applies catalog-wide to every available mount travel sequence",()=>{
  let checked=0;
  for(const raw of catalog.items) {
    const i=normalizeCatalogItem(raw,catalog);
    if(!i.referencePieces.some(p=>p.sequence?.policy==="travel"))continue;
    checked++;
    advanceCatalogItem(i,0,frame());const neutral=cells(i);
    advanceCatalogItem(i,2900,frame(2900));assert.deepEqual(cells(i),neutral,`${raw.id} idle`);
    advanceCatalogItem(i,3000,frame(3000,"walk"));
    advanceCatalogItem(i,3225,frame(3225,"walk"));
    assert.equal(i.animationState.state,"walk");
    advanceCatalogItem(i,5000,frame(5000));assert.deepEqual(cells(i),neutral,`${raw.id} stops`);
  }
  assert.ok(checked>=30);console.log(`${checked} state-gated mount sequences checked`);
});
test("body and floating owner share total lift, not just the sine delta",()=>{
  for(const id of [11168,15934])for(const facing of [1,-1]) {
    const i=item(id),p=new PlannerPlayer(catalog,[i]);
    const r=p.step(frame(250,"idle",{facing}),16);
    const base=r.calls.find(c=>c.owner===undefined&&c.atlas==="player_body_only.png");
    const owned=r.calls.find(c=>c.owner===id);
    const raw=i.pieces.find(piece=>piece.a===owned.atlas&&piece.sx===owned.sx&&piece.sy===owned.sy);
    const expectedY=(raw.y??0)-(raw.ay??0)*raw.sh+(r.lift.y??0);
    assert.ok(Math.abs(owned.matrix[5]-expectedY)<1e-6,`${id} owner receives full lift`);
    assert.ok(Math.abs(base.matrix[5]-r.lift.y)<1e-6);
    const before=owned.matrix[5]-base.matrix[5];
    const b=p.step(frame(750,"idle",{facing}),16),bodyB=b.calls.find(c=>c.owner===undefined&&c.atlas==="player_body_only.png");
    const ownedB=b.calls.find(c=>c.owner===id);
    assert.ok(Math.abs(ownedB.matrix[5]-bodyB.matrix[5]-before)<1e-5,`${id} no relative drift`);
  }
});
test("the player entry point routes item frames and rig from the same motion frame",()=>{
  const i=item(1320),p=new PlannerPlayer(catalog,[i]);
  p.step(frame(0),16);const neutral=cells(i);
  p.step(frame(2000),16);assert.deepEqual(cells(i),neutral);
  p.step(frame(2100,"walk"),16);p.step(frame(2325,"walk"),16);
  assert.notDeepEqual(cells(i),neutral);
  p.step(frame(2500),16);assert.deepEqual(cells(i),neutral);
});
test("ambient FX clocks continue while grounded; idle is not a global freeze",()=>{
  const i=item(2722),p=new PlannerPlayer(catalog,[i]);
  p.step(frame(0),16);const a=cells(i);
  p.step(frame(50),16);assert.notDeepEqual(cells(i),a);
});
test("changing travel direction does not restart a mount cycle",()=>{
  const i=item(1320),p=new PlannerPlayer(catalog,[i]);
  p.step(frame(0,"walk"),16);p.step(frame(225,"walk"),16);
  const left=p.step(frame(250,"walk",{facing:-1,vx:-90}),16);
  assert.equal(i.animationState.elapsedMs,250);assert.equal(left.poseResolution.state,"ridingmove");
});
test("manual generic float replaces the item float instead of stacking a second lift",()=>{
  const i=item(11168);
  assert.equal(resolvePlayerLift([i],250).y,-7);
  const manual=resolvePlayerLift([i],250,{forceFloat:true});
  assert.equal(manual.y,-3);assert.equal(manual.evidence,"manual-generic-reference");
});
