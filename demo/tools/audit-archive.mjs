import fs from "node:fs";
import crypto from "node:crypto";
import {normalizeCatalogItem} from "../engine/catalog-adapter.mjs";
import {mountedGaitProfile} from "../engine/mounted-gait.mjs";
const root=new URL("../",import.meta.url);
const c=JSON.parse(fs.readFileSync(new URL("catalog.json",root)));
const r=JSON.parse(fs.readFileSync(new URL("renderer-data.json",root)));
c.renderers=r.scripts;
c.liftProfiles=Object.fromEntries(JSON.parse(fs.readFileSync(new URL("lift-profiles.json",root))).profiles.map(p=>[p.id,p]));
const archive=new URL("../../research/player-stuff.zip",import.meta.url);
const rows=c.items.map(raw=>{
  const i=normalizeCatalogItem(raw,c),g=mountedGaitProfile(i);
  const spriteNames=new Set(i.pieces.map(p=>p.xmlSprite).filter(Boolean));
  return {id:i.id,name:i.name,renderer:raw.script??null,xmlLoaded:!!i.renderer,
    boundSpritePieces:i.xmlBoundCount??0,
    boundAnimationTracks:i.renderer?.animations.filter(a=>spriteNames.has(a.a.sprite)).length??0,
    horseSitReferenceGait:!!g,
    petCells:!!raw.petCells,
    linkedPetCellFollower:!!raw.petCells&&!i.vehicle&&i.pieces.some(p=>p.attachment==="pet"),
    selectedAuraRules:["StarryAura","DirtAura","TwilightAura","InfinityAura","BeachAura"].includes(raw.script),
    status:i.renderer?"partial-XML-interpreter":raw.script?"missing-XML":"public-reference",
    officialClientVerified:false};
});
const result={provenance:r.source,
  archiveSha256:fs.existsSync(archive)?crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex"):null,
  parsedScripts:Object.keys(r.scripts).length,parseErrors:r.errors,identicalAttributeRepairs:r.repairs,
  mappedItems:rows.filter(i=>i.xmlLoaded).length,
  boundSpritePieces:rows.reduce((n,i)=>n+i.boundSpritePieces,0),
  itemsWithBoundTracks:rows.filter(i=>i.boundAnimationTracks>0).length,
  horseSitGaitItems:rows.filter(i=>i.horseSitReferenceGait).length,
  petCellItems:rows.filter(i=>i.petCells).length,
  linkedPetCellFollowers:rows.filter(i=>i.linkedPetCellFollower).length,
  remainingMissingXml:rows.filter(i=>i.renderer&&!i.xmlLoaded),
  limitations:["XML load is not full behavioral support","Gait and follower motion use reference tuning",
    "Particle emission history, general native transforms, pet AI, perching, combat and trails remain partial",
    "No official-client runtime equivalence was established"],items:rows};
console.log(JSON.stringify(result,null,2));
