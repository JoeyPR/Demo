import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {fidelityOf} from "../src/xml-badge.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const mk=(name,extra={})=>normalizeCatalogItem({id:1,name:"T",slot:9,script:name,gameIcon:[],...extra},{renderers:{[name]:scripts[name]}});
const motion=(t,o={})=>({clockMs:t,moveMs:0,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[],...o});

test("no item in the whole data set is NATIVE (no xml-support field is 'full' for every system)", () => {
  const levels={};
  for(const name of Object.keys(scripts)) {
    const item=mk(name);const f=fidelityOf(item);levels[f.level]=(levels[f.level]??0)+1;
  }
  assert.equal(levels.NATIVE??0,0);
  assert.ok(levels.UNRESOLVED>0&&levels.PARTIAL>=0);
});

test("a script that is not in the data is UNRESOLVED with the script name", () => {
  const item=normalizeCatalogItem({id:2,name:"X",slot:9,script:"NoSuchScript",gameIcon:[]},{renderers:{}});
  const f=fidelityOf(item);
  assert.equal(f.level,"UNRESOLVED");assert.match(f.reasons[0],/NoSuchScript/);
});

test("an fx flag with no XML is UNRESOLVED; a plain sprite item is REFERENCE (never NATIVE)", () => {
  const fx=normalizeCatalogItem({id:3,name:"F",slot:9,fx:true,gameIcon:[]},{renderers:{}});
  assert.equal(fidelityOf(fx).level,"UNRESOLVED");
  const plain=normalizeCatalogItem({id:4,name:"P",slot:9,gameIcon:[]},{renderers:{}});
  assert.equal(fidelityOf(plain).level,"REFERENCE");
});

test("a hook the planner can never raise makes the item UNRESOLVED and names the hook (CyberCycle OnDestroyedTile)", () => {
  const f=fidelityOf(mk("CyberCycle"));
  assert.equal(f.level,"UNRESOLVED");
  assert.ok(f.reasons.some(r=>/OnDestroyedTile.*no source in the planner/.test(r)),f.reasons.join("\n"));
});

test("runtime unresolved events and skipped systems surface as reasons after the item runs", () => {
  const item=mk("CaptainBark");
  for(let t=0;t<=300;t+=50)advanceCatalogItem(item,t,motion(t));
  const f=fidelityOf(item);
  assert.equal(f.level,"UNRESOLVED");
  assert.ok(f.reasons.some(r=>/ps_tileHit: needs world event: OnDamagedTile/.test(r)),f.reasons.join("\n"));
});
