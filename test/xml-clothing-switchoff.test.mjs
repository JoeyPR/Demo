// Pairs of AddClothingParticles Update + SwitchOffClothingParticles Off: the Off side fires once, on unequip, never while worn.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildTriggerTable} from "../src/xml-triggers.mjs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {PlannerPlayer} from "../src/player.mjs";
import {unequipXmlItem,SWITCH_OFF_CLOTHING,UNRESOLVED_ITEM_SYMBOL_WORN,unresolvedWearingSymbols} from "../src/xml-renderer.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const catalog=JSON.parse(fs.readFileSync(new URL("../demo/catalog.json",import.meta.url),"utf8"));

const PAIRS=new Map(); // script -> system names that have both an AddClothingParticles Update and a SwitchOffClothingParticles Off
for(const [name,r] of Object.entries(scripts)) {
  if(!r.particles?.length)continue;
  const names=buildTriggerTable(r).systems.filter(s=>s.rule.some(x=>x.kind==="Update"&&x.hook==="AddClothingParticles")&&
    s.rule.some(x=>x.kind==="Off"&&x.hook==="SwitchOffClothingParticles")).map(s=>s.name);
  if(names.length)PAIRS.set(name,names);
}
// Every motion the planner can produce, plus "dance" (motion layer supports it; the planner UI has no dance button).
const SCENARIOS={
  idle:()=>({locomotion:"idle"}),
  walk:()=>({locomotion:"walk",vx:90}),
  jump:ms=>({locomotion:"jump",ground:false,vy:-200,events:ms%1000===0?[{type:"jump",id:"j"+ms,at:ms}]:[]}),
  fall:()=>({locomotion:"fall",ground:false,vy:200}),
  doubleJump:ms=>({locomotion:"jump",ground:false,vy:-200,events:ms%1000===0?[{type:"doubleJump",id:"d"+ms,at:ms}]:[]}),
  punch:ms=>({locomotion:"idle",punch:{ageMs:100},events:ms%500===0?[{type:"punch",id:"p"+ms,at:ms}]:[]}),
  dance:()=>({locomotion:"dance"})
};
const frame=(ms,over)=>({clockMs:ms,moveMs:ms,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[],...over});
const wear=(script,slot=9,r=scripts[script])=>normalizeCatalogItem({id:3,name:"T",slot,script,gameIcon:[]},{renderers:{[script]:r}});
// Wears a fresh copy under each scenario for 2.5 s; returns {system -> [scenarios in which it emitted]} and the last worn item per scenario.
function wearAll(script) {
  const emitted=new Map(),items={};
  for(const [sn,f] of Object.entries(SCENARIOS)) {
    const item=wear(script);items[sn]=item;
    for(let ms=0;ms<=2500;ms+=50) {
      advanceCatalogItem(item,ms,frame(ms,f(ms)));
      for(const p of item.pieces)if(p.xmlSystem)emitted.set(p.xmlSystem,new Set([...(emitted.get(p.xmlSystem)??[]),sn]));
    }
  }
  return {emitted,items};
}

test("SwitchOff pairs: shipped data has 92 systems in 24 scripts with both an AddClothingParticles Update and a SwitchOffClothingParticles Off", () => {
  assert.equal(PAIRS.size,24);
  assert.equal([...PAIRS.values()].reduce((a,l)=>a+l.length,0),92);
});
test("SWITCH_OFF_CLOTHING constant records: fires on unequip, once", () => assert.deepEqual(SWITCH_OFF_CLOTHING,{firesOn:"unequip",times:1}));

for(const [script,names] of PAIRS) {
  test(`SwitchOff pair (a): ${script} still emits while worn: ${names.join(", ")}`, () => {
    const {emitted,items}=wearAll(script);
    const silent=names.filter(n=>!emitted.has(n));
    assert.deepEqual(silent,[],`never emitted under idle/walk/jump/fall/doubleJump/punch/dance: ${silent}`);
    for(const item of Object.values(items)) {
      assert.equal(item.xmlSwitchOffAt,undefined,"SwitchOff must not fire while the item is worn");
      assert.equal(item.xmlSwitchOffCount,undefined);
    }
  });
  test(`SwitchOff pair (a): ${script} SwitchOff fires once, on unequip, and resets every open emitter of its systems`, () => {
    const {emitted,items}=wearAll(script);
    for(const sn of ["idle","walk","jump","fall","punch","dance"]) {
      const item=items[sn],openBefore=item.xmlParticleRuns.filter(r=>names.includes(r.node.a.name)&&r.stopMs===undefined);
      if(!openBefore.length)continue;
      assert.equal(unequipXmlItem(item,2600,frame(2600,SCENARIOS[sn](2600))),true);
      for(const run of openBefore) {
        assert.equal(run.stopMs,2600,`${run.node.a.name} stopped on unequip`);
        assert.deepEqual(run.emitter,{running:false,emitted:0,delayMs:0});
      }
      assert.equal(item.xmlSwitchOffCount,1);
      assert.equal(unequipXmlItem(item,2700,frame(2700,{})),false,"second unequip is a no-op");
      assert.equal(item.xmlSwitchOffCount,1,"fired exactly once");
      return;
    }
    assert.ok(emitted.size>0,"at least one scenario must leave an open emitter to unequip");
  });
}

test("SwitchOff pair (a): PlannerPlayer.equip fires SwitchOff once per removed item, not for kept items, and not on repeated equips", () => {
  const A=wear("AquaticVolcanicCrown",1),B=wear("DirtAura",2);A.id=1;B.id=2;
  const player=new PlannerPlayer(catalog,[A,B]);
  for(let ms=0;ms<=500;ms+=50)player.step(frame(ms,{}),50);
  player.equip([B],frame(550,{}));
  assert.equal(A.xmlSwitchOffCount,1,"removed item fires once");
  assert.equal(B.xmlSwitchOffCount,undefined,"kept item untouched");
  player.equip([B],frame(600,{}));player.equip([B],frame(650,{}));
  assert.equal(A.xmlSwitchOffCount,1,"still once");
  assert.equal(B.xmlSwitchOffCount,undefined);
});
test("SwitchOff pair (a): a re-equipped item is re-armed, emits again, and fires SwitchOff once more on its next unequip", () => {
  const A=wear("AquaticVolcanicCrown");A.id=1;
  const player=new PlannerPlayer(catalog,[A]);
  for(let ms=0;ms<=500;ms+=50)player.step(frame(ms,{}),50);
  player.equip([],frame(550,{}));assert.equal(A.xmlSwitchOffCount,1);
  player.equip([A],frame(600,{}));assert.equal(A.xmlSwitchOffAt,undefined);
  let drawn=0;for(let ms=0;ms<=500;ms+=50){advanceCatalogItem(A,ms,frame(ms,{}));drawn+=A.pieces.filter(p=>p.xmlSystem).length;}
  assert.ok(drawn>0,"particles start again after re-equip");
  player.equip([],frame(700,{}));assert.equal(A.xmlSwitchOffCount,2);
});

// ---- a StopIf that names an item symbol the table does not know must not halt the hook ----------------------------------
test("SwitchOff pair (a): an unresolvable IsWearing item symbol counts as not worn (UNRESOLVED_ITEM_SYMBOL_WORN=false), so PearlTreasuredOctopus TrailParticle emits on GroundMove", () => {
  assert.equal(UNRESOLVED_ITEM_SYMBOL_WORN,false);
  const {emitted}=wearAll("PearlTreasuredOctopus");
  assert.deepEqual([...emitted.get("TrailParticle")],["walk"]);
});
test("SwitchOff pair (a): unresolvedWearingSymbols reports ITEM_ID_HAUNTED for PearlTreasuredOctopus and nothing for scripts using only known symbols", () => {
  assert.ok(unresolvedWearingSymbols(scripts.PearlTreasuredOctopus).includes("ITEM_ID_HAUNTED"));
  assert.deepEqual(unresolvedWearingSymbols(scripts.AquaticVolcanicCrown),[]);
});
