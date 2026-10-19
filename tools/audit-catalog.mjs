// Structural smoke audit only. No images are compared and no parity claim is made.
import fs from "node:fs";
import {requirePlannerCatalog} from "../src/items.mjs";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {PlannerPlayer} from "../src/player.mjs";
const input=process.argv[2];
if(!input) throw Error("Usage: node tools/audit-catalog.mjs decoded-catalog.json");
const catalog=requirePlannerCatalog(JSON.parse(fs.readFileSync(input,"utf8")));
const failures=[],missing=[];let draws=0;
for(const raw of catalog.items)for(const state of ["idle","walk","jump","fall"]) {
  try {
    const item=normalizeCatalogItem(raw,catalog);
    advanceCatalogItem(item,450);
    const motion={x:0,y:0,facing:1,locomotion:state==="punch"?"idle":state,
      moveMs:99,clockMs:200,ground:!["jump","fall"].includes(state),events:[],punch:null};
    const {calls}=new PlannerPlayer(catalog,[item]).step(motion,1000/60);
    draws+=calls.length;
    if(!calls.some(c=>c.owner===item.id)) missing.push({id:item.id,name:item.name,state});
    for(const c of calls)
      if(!c.atlas||!c.matrix.every(Number.isFinite)||
        ![c.sx,c.sy,c.sw,c.sh].every(Number.isFinite)||c.sw<=0||c.sh<=0)
        throw Error("Invalid draw geometry");
  }catch(error){failures.push({id:raw.id,name:raw.name,state,error:String(error)});}
}
console.log(JSON.stringify({
  status:"structural-only; not visual or official-client verification",
  wearables:catalog.items.length,stateCases:catalog.items.length*4,drawCalls:draws,
  invalidGeometryCases:failures.length,missingItemDrawCases:missing.length,
  missingItemIds:[...new Set(missing.map(x=>x.id))],missing,failures
},null,2));
if(failures.length)process.exitCode=1;
