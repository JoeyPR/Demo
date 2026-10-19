import fs from "node:fs";
import {normalizeCatalogItem,advanceCatalogItem} from "../engine/catalog-adapter.mjs";
import {mountedGaitProfile} from "../engine/mounted-gait.mjs";
import {ITEM_FX_RECIPES} from "../engine/item-fx.mjs";
import {isFloatingItem} from "../engine/motion-policy.mjs";
const root=new URL("../",import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL("catalog.json",root)));
catalog.renderers=JSON.parse(fs.readFileSync(new URL("renderer-data.json",root))).scripts;
catalog.liftProfiles=Object.fromEntries(JSON.parse(fs.readFileSync(new URL("lift-profiles.json",root))).profiles.map(p=>[p.id,p]));
const abilities=JSON.parse(fs.readFileSync(new URL("ability-registry.json",root)));
const native=JSON.parse(fs.readFileSync(new URL("native-metadata.json",root)));
const items=catalog.items.map(raw=>{
  const i=normalizeCatalogItem(raw,catalog);
  let particles=0;
  for(const [n,state] of ["idle","walk","jump","doubleJump","fall","punch","idle"].entries()){
    const frame={clockMs:n*250,moveMs:n*250,x:0,y:0,worldX:0,worldY:0,
      locomotion:state==="punch"?"idle":state==="doubleJump"?"jump":state,
      ground:!["jump","doubleJump","fall"].includes(state),
      facing:1,vx:state==="walk"?90:0,vy:["jump","doubleJump"].includes(state)?-100:state==="fall"?100:0,
      punch:state==="punch"?{ageMs:100,target:[160,0]}:null,
      renderContext:{equippedIds:[i.id]},
      events:["jump","doubleJump","punch"].includes(state)?[{id:`${i.id}:${state}`,type:state}]:[]};
    advanceCatalogItem(i,frame.clockMs,frame);
    particles=Math.max(particles,i.pieces.filter(p=>p.xmlParticle).length);
  }
  const a=abilities.items[i.id],g=mountedGaitProfile(i);
  return {id:i.id,name:i.name,nativeFieldsPreserved:!!native.items[i.id]?.sourceFields,
    doubleJump:!!a?.doubleJump,highJump:!!a?.highJump,slowFall:!!a?.slowFall,speedy:!!a?.speedy,
    abilitySources:a?.sources??[],animalReferenceGait:!!g,gaitPeriodMs:g?.periodMs??null,
    floating:isFloatingItem(i),xmlLoaded:!!i.renderer,xmlParticleMaximumObserved:particles,
    unsupportedParticleExpressions:[...(i.xmlUnsupportedParticleExpressions??[])],
    referenceFx:ITEM_FX_RECIPES[i.id]?.kind??null,referenceFxSource:ITEM_FX_RECIPES[i.id]?.source??null,
    fxFlag:!!(raw.fx||raw.punchFx||raw.airJumpFx),petCells:!!raw.petCells,
    status:"partial-reference-not-native-parity"};
});
const report={schema:1,summary:{catalogItems:items.length,nativeFieldRows:items.filter(i=>i.nativeFieldsPreserved).length,
  abilityRegistry:abilities.summary,animalReferenceGaits:items.filter(i=>i.animalReferenceGait).length,
  nativeXmlParticleItemsObserved:items.filter(i=>i.xmlParticleMaximumObserved>0).length,
  itemsWithSkippedParticleExpressions:items.filter(i=>i.unsupportedParticleExpressions.length).length,
  explicitReferenceFxRecipes:Object.keys(ITEM_FX_RECIPES).length,
  flaggedItemsWithoutObservedXmlOrReferenceRecipe:items.filter(i=>i.fxFlag&&!i.xmlParticleMaximumObserved&&!i.referenceFx).length},
    interpretation:"Seven sampled states/actions are evidence of reachable emitters, not complete per-item behavior. Unknown FX flags are unresolved; reference FX use procedural art and tuned coefficients.",
  items};
fs.writeFileSync(new URL("input-abilities-fx-coverage.json",root),JSON.stringify(report,null,2)+"\n");
const columns=Object.keys(items[0]),escape=v=>`"${String(Array.isArray(v)?v.join("; "):v??"").replaceAll('"','""')}"`;
fs.writeFileSync(new URL("input-abilities-fx-coverage.csv",root),
  columns.join(",")+"\n"+items.map(i=>columns.map(k=>escape(i[k])).join(",")).join("\n")+"\n");
console.log(report.summary);
