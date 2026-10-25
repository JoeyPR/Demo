import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../engine/catalog-adapter.mjs";
import {resolveItemPose} from "../engine/pose-resolver.mjs";
import {PlannerPlayer} from "../engine/player.mjs";
import {resolveWear} from "../engine/render.mjs";
const catalog=JSON.parse(fs.readFileSync(new URL("../catalog.json",import.meta.url)));
const item=id=>normalizeCatalogItem(catalog.items.find(i=>i.id===id),catalog);
const frame=(o={})=>({x:0,y:0,facing:1,locomotion:"idle",clockMs:0,moveMs:0,ground:true,events:[],...o});
test("full public catalog: 4081 unique items in all ten slots",()=>{
  assert.equal(catalog.items.length,4081);
  assert.equal(new Set(catalog.items.map(i=>i.id)).size,4081);
  assert.equal(new Set(catalog.items.map(i=>i.slot)).size,10);
});
test("all public seated items retain every seat sprite",()=>{
  let count=0;
  for(const raw of catalog.items.filter(i=>i.slot===3&&i.gameIcon?.some(r=>r.seat))) {
    const i=normalizeCatalogItem(raw,catalog);count++;
    assert.equal(i.pieces.filter(p=>p.seat).length,raw.gameIcon.filter(r=>r.seat).length);
    assert.equal(i.seated,true);assert.equal(i.hideLegs,true);
    assert.ok(i.pieces.filter(p=>p.seat).every(p=>p.attachment==="mount"&&
      p.pass===(p.u>=10.25?"RenderSeat":"RenderShoes")));
  }
  assert.ok(count>100);
});
test("all catalog records have finite rendering geometry in four movement states",()=>{
  let calls=0;
  for(const raw of catalog.items) {
    const i=normalizeCatalogItem(raw,catalog);advanceCatalogItem(i,450);
    const player=new PlannerPlayer(catalog,[i]);
    for(const state of ["idle","walk","jump","fall"]) {
      const result=player.step(frame({locomotion:state,ground:!["jump","fall"].includes(state),moveMs:99}),1000/60);
      for(const c of result.calls) {
        assert.ok(c.matrix.every(Number.isFinite),`${raw.id} ${state} transform`);
        if(c.line){ // pet leash string: a line primitive, not an atlas blit
          assert.ok(c.line.from.every(Number.isFinite)&&c.line.to.every(Number.isFinite),
            `${raw.id} ${state} line ends`);
          assert.ok(Number.isFinite(c.line.width??1),`${raw.id} ${state} line width`);
          continue;
        }
        for(const k of ["sx","sy","sw","sh"])assert.ok(Number.isFinite(c[k]),`${raw.id} ${state} ${k}`);
        assert.ok(c.sw>0&&c.sh>0,`${raw.id} source area`);calls++;
      }
    }
  }
  console.log(`Catalog structural audit: ${catalog.items.length*4} cases; ${calls} calls`);
});
test("static hand pose does not override walking, airborne or punch arms",()=>{
  const i={slot:5,id:1,staticArmPose:{backAngle:-35,frontAngle:-35},pose:{backAngle:-35,frontAngle:-35}};
  assert.equal(resolveItemPose([i],frame()).override.backAngle,-35);
  for(const f of [frame({locomotion:"walk"}),frame({locomotion:"jump",ground:false}),frame({punch:{ageMs:100}})])
    assert.equal(resolveItemPose([i],f).override.backAngle,undefined);
});
test("items without authored angles do not erase an earlier neutral pose",()=>{
  const hand={slot:5,id:1,staticArmPose:{backAngle:-20,frontAngle:-30}};
  const hat={slot:0,id:2,staticArmPose:{backAngle:undefined,frontAngle:undefined}};
  assert.equal(resolveItemPose([hand,hat],frame()).override.frontAngle,-30);
});
test("ridingstill is explicit, public arm pose held, punch is not overwritten",()=>{
  const i=item(592),p=new PlannerPlayer(catalog,[i]);
  let r=p.step(frame(),16);
  assert.equal(r.poseResolution.state,"ridingstill");assert.equal(r.pose.backAngle,-35);
  r=p.step(frame({locomotion:"walk"}),16);
  assert.equal(r.poseResolution.state,"ridingmove");assert.equal(r.pose.frontFoot,0);
  assert.equal(r.pose.frontAngle,-35);
  r=p.step(frame({punch:{ageMs:100}}),16);
  assert.equal(r.poseResolution.state,"ridingpunch");assert.ok(r.pose.punch);
  assert.notEqual(r.pose.backAngle,-35);
});
test("mount state descriptor wins over held-item descriptor independent of equip order",()=>{
  const mount={...item(592),statePoses:{walk:{backAngle:-42,frontAngle:-43}}};
  const hand={...item(98),statePoses:{walk:{backAngle:99,frontAngle:100}}};
  for(const items of [[mount,hand],[hand,mount]])assert.equal(
    resolveItemPose(items,frame({locomotion:"walk"})).override.frontAngle,-43);
});
test("zero lift is retained and not replaced by unrelated floating face item",()=>{
  assert.equal(item(1950).riderLift,0);
  assert.equal(resolveWear([item(15698),item(1950)]).riderLift,0);
  assert.equal(item(46).riderLift,undefined);
  assert.equal(resolveWear([item(46),item(15698)]).riderLift,-3.09);
});
test("a floating face item is not a seated vehicle; scooter is not seated",()=>{
  assert.equal(item(15698).vehicle,false);assert.equal(item(15698).seated,false);
  assert.equal(item(15120).vehicle,true);assert.equal(item(15120).seated,false);
});
test("CyberCycle arm still is resolved once, not duplicated as body sprites",()=>{
  const i=item(14720);
  assert.equal(i.staticArmPose.backAngle,-45);assert.equal(i.staticArmPose.frontAngle,-45);
  assert.ok(i.pieces.every(p=>p.a!=="player_arm.png"));
});
test("held item reference angle and sleeve transform survive normalization",()=>{
  for(const raw of catalog.items.filter(i=>i.slot===5&&i.pose)) {
    const i=normalizeCatalogItem(raw,catalog);
    for(const p of i.pieces.filter(p=>p.attachment==="frontHand"))assert.equal(p.referenceAngle,raw.pose.arm2??0);
  }
});
test("mount sequences preserve row offsets, seat pixels and authored positions",()=>{
  const i=item(592),seats=i.pieces.filter(p=>p.seat).map(p=>({...p}));
  advanceCatalogItem(i,0,frame({locomotion:"walk"}));
  advanceCatalogItem(i,225,frame({locomotion:"walk"}));
  assert.equal(i.pieces[0].sx,224);assert.equal(i.pieces[0].sy,96);
  assert.equal(i.pieces[1].sy,64);
  assert.deepEqual(i.pieces.filter(p=>p.seat),seats);
});
test("representative mounts and floaters do not collapse into the same configuration",()=>{
  const ids=[592,1012,1320,1950,2048,2974,6040,14720,15120,15934,16366,15698];
  for(const id of ids) {
    const i=item(id),p=new PlannerPlayer(catalog,[i]);
    for(const f of [frame(),frame({locomotion:"walk"}),frame({ground:false,locomotion:"jump"}),frame({punch:{ageMs:100}})])
      assert.ok(p.step(f,16).calls.length>0);
  }
});
