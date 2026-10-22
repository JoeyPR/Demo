import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {PlannerPlayer} from "../src/player.mjs";
import {normalizeCatalogItem} from "../src/catalog-adapter.mjs";
const fx=JSON.parse(fs.readFileSync(new URL("../demo/fx-data.json",import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL("../demo/catalog.json",import.meta.url)));
catalog.fxRenderers=fx.scripts??fx;
catalog.renderers=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url))).scripts;
const raw=(catalog.items??catalog).find(i=>i.script==="StudentHeroGloves");
const frame=(t,punch)=>({clockMs:t,moveMs:t,ground:true,locomotion:"idle",facing:1,vx:0,vy:0,events:[],punch});
test("XML particle layer emits world-space particle calls while punching",()=>{
  const item=normalizeCatalogItem(raw,catalog);
  const p=new PlannerPlayer(catalog,[item]);
  let n=0;
  for(let t=0;t<1500;t+=33)n+=p.step(frame(t,{target:[64,16]}),33).calls.filter(c=>c.fxEngine).length;
  assert.ok(n>0,"no particle calls emitted");
});
test("legacy particle path is skipped for items handled by the engine",()=>{
  const item=normalizeCatalogItem(raw,catalog);
  const p=new PlannerPlayer(catalog,[item]);
  p.step(frame(0),33);
  assert.equal(item.skipLegacyParticles,true);
});
test("xmlParticles:false disables the layer",()=>{
  const item=normalizeCatalogItem(raw,catalog);
  const p=new PlannerPlayer(catalog,[item]);
  let n=0;for(let t=0;t<1000;t+=33)n+=p.step(frame(t,{target:[64,16]}),33,{xmlParticles:false}).calls.filter(c=>c.fxEngine).length;
  assert.equal(n,0);
});
test("official punch_options drive face/arm pose and hide-item while punching",()=>{
  const punchData=JSON.parse(fs.readFileSync(new URL("../demo/punch-data.json",import.meta.url)));
  const id=Object.keys(punchData).find(k=>punchData[k].src==="official"&&punchData[k].hideItem&&punchData[k].face!==undefined);
  const r=(catalog.items??catalog).find(i=>String(i.id)===id);
  assert.ok(r,"item missing from catalog");
  const item=normalizeCatalogItem(r,catalog);
  const p=new PlannerPlayer({...catalog,punchData},[item]);
  const out=p.step(frame(500,{target:[64,16]}),33);
  assert.equal(out.punchPose.itemId,r.id);
  assert.equal(out.pose.face[0],punchData[id].face);
});
