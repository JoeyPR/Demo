import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {buildTriggerTable} from "../src/xml-triggers.mjs";
import {stageActive,STAGE_MAP,STATE_MAP} from "../src/xml-renderer.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const mk=name=>normalizeCatalogItem({id:1,name:"T",slot:9,script:name,gameIcon:[]},{renderers:{[name]:scripts[name]}});
const motion=(t,o={})=>({clockMs:t,moveMs:0,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[],...o});
const bySystem=item=>{const by={};for(const p of item.pieces.filter(p=>p.xmlParticle))by[p.xmlSystem]=(by[p.xmlSystem]??0)+1;return by;};
const system=(script,name)=>buildTriggerTable(scripts[script]).systems.find(s=>s.name===name);

test("AddClothingParticles-staged system emits with no Update hook present (AtomConstructs ps_godrays)", () => {
  const s=system("AtomConstructs","ps_godrays");
  assert.equal(s.rule.length,0,"no <ParticleSystemUpdate> names this system");
  assert.equal(s.stage.updateStage,"AddClothingParticles");
  const item=mk("AtomConstructs");
  for(let t=0;t<=600;t+=50)advanceCatalogItem(item,t,motion(t));
  assert.ok(bySystem(item).ps_godrays>0,"emits while the item is worn");
});

test("OnDamagedTile-staged system emits nothing and is reported as unresolved (CaptainBark ps_tileHit)", () => {
  const s=system("CaptainBark","ps_tileHit");
  assert.equal(s.rule.length,0);assert.equal(s.stage.updateStage,"OnDamagedTile");
  const item=mk("CaptainBark");
  for(let t=0;t<=600;t+=50)advanceCatalogItem(item,t,motion(t,{punch:t>=200?{}:null}));
  assert.equal(bySystem(item).ps_tileHit??0,0);
  assert.match(item.xmlUnresolvedEvents.ps_tileHit,/needs world event: OnDamagedTile/);
});

test("OnPunchStart-staged system emits only after a punch event, not before (CyberCycle ps_MuzzleFlash)", () => {
  const s=system("CyberCycle","ps_MuzzleFlash");
  assert.equal(s.rule.length,0);assert.equal(s.stage.updateStage,"OnPunchStart");
  const item=mk("CyberCycle");
  for(let t=0;t<300;t+=50){advanceCatalogItem(item,t,motion(t));assert.equal(bySystem(item).ps_MuzzleFlash??0,0,`before punch @${t}`);}
  advanceCatalogItem(item,300,motion(300,{events:[{type:"punch",id:"punch:300",at:300}],punch:{}}));
  advanceCatalogItem(item,350,motion(350,{punch:{}}));
  assert.ok(bySystem(item).ps_MuzzleFlash>0,"particle alive after the punch event frame");
});

test("a pulse does not restart on every frame while the same event id persists", () => {
  const item=mk("CyberCycle"),ev=[{type:"punch",id:"punch:300",at:300}];
  advanceCatalogItem(item,0,motion(0));
  for(const t of [300,316,332])advanceCatalogItem(item,t,motion(t,{events:ev}));
  assert.equal(item.xmlParticleRuns.filter(r=>r.node.a.name==="ps_MuzzleFlash").length,1);
});

test("unmapped updateState values are unresolved, never always-on", () => {
  assert.deepEqual(stageActive({updateStage:"AddClothingParticles",updateState:"DoDoubleJump.Yes"},motion(0)),{unresolved:"unmapped updateState: DoDoubleJump.Yes"});
  assert.deepEqual(stageActive({updateStage:"OnBogus"},motion(0)),{unresolved:"unmapped updateStage: OnBogus"});
  assert.equal(stageActive({updateStage:"AddClothingParticles",updateState:"Punch.True"},motion(0)).on,false);
  assert.equal(stageActive({updateStage:"AddClothingParticles",updateState:"Punch.True"},motion(0,{punch:{}})).on,true);
  assert.equal(stageActive({renderStage:"RenderHandItem"},motion(0)).on,true);
  assert.ok(STAGE_MAP.OnPunchUpdate&&STATE_MAP["Motion.Move"]);
});

test("stage-driven starts do not change trigger classification (no-trigger stays 27)", () => {
  let none=0;for(const r of Object.values(scripts)){if(!r.particles?.length)continue;
    none+=buildTriggerTable(r).systems.filter(s=>s.category==="no-trigger").length;}
  assert.equal(none,27);
});
