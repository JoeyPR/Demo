import fs from "node:fs";
import {normalizeCatalogItem} from "../src/catalog-adapter.mjs";
const catalog=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const revisionFile=new URL("../evidence/input-abilities-fx-coverage.json",import.meta.url);
const revision=fs.existsSync(revisionFile)?
  new Map(JSON.parse(fs.readFileSync(revisionFile)).items.map(i=>[i.id,i])):new Map();
const lifts=Object.fromEntries(JSON.parse(fs.readFileSync(
  new URL("../evidence/lift-profiles.json",import.meta.url),"utf8")).profiles.map(p=>[p.id,p]));
catalog.liftProfiles=lifts;
const rendererPath=new URL("../evidence/renderer-data.json",import.meta.url);
if(fs.existsSync(rendererPath))catalog.renderers=JSON.parse(fs.readFileSync(rendererPath)).scripts;
const archivePath=new URL("../evidence/archive-coverage.json",import.meta.url);
const archive=fs.existsSync(archivePath)?new Map(JSON.parse(fs.readFileSync(archivePath)).items.map(i=>[i.id,i])):new Map();
const native=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3],"utf8")).items:{};
const fields=["id","name","slot","slotName","renderer","punchSleeveMappings","airJumpFxFlag",
  "riderLift","publicParts","externalFxFlag","completeness","capturedSeatPieces",
  "inferredVehicle","effectiveStaticLift","staticBackArm","staticFrontArm","drawPieces",
  "frame64OrLarger","clockFrameDescriptors","spriteFlicker","spritePulse","explicitChakramOrbit",
  "floatProfileEnabled","floatAmplitude","floatPeriodMs","nativeRendererReference","catalogSource",
  "floatingClassified","sequencePolicies","xmlLoaded","xmlBoundSprites","boundAnimationTracks",
  "horseSitReferenceGait","petCellsMetadata","linkedPetCellFollower"];
const esc=x=>'"'+String(x??"").replaceAll('"','""')+'"';
const rows=catalog.items.map(raw=>{
  const i=normalizeCatalogItem(raw,catalog);
  const r=revision.get(i.id)??{};
  return [i.id,i.name,i.slot,catalog.slots[i.slot],raw.script??"",raw.punchSleeves?.length??0,
    raw.airJumpFx?1:0,raw.riderLift??"",raw.parts?.length??0,raw.fx?1:0,
    i.renderer?"partial-XML-interpreter":raw.script?"missing-renderer-script":raw.fx||raw.airJumpFx||raw.punchFx?"missing-external-fx":"reference-only",
    i.pieces.filter(p=>p.seat).length,i.vehicle?1:0,i.riderLift,
    i.staticArmPose.backAngle,i.staticArmPose.frontAngle,i.pieces.length,
    i.pieces.some(p=>p.sw>=64||p.sh>=64)?1:0,[].concat(raw.clockFrames??[]).length,
    raw.parts?.some(p=>p.flicker)?1:0,raw.parts?.some(p=>p.pulse)?1:0,raw.chakrams?1:0,
    i.liftProfile?.publicStillAgrees?1:0,i.liftProfile?.publicStillAgrees?i.liftProfile.amplitude:"",
    i.liftProfile?.publicStillAgrees?i.liftProfile.periodMs:"",native[raw.id]?.rendererReference??"",
    "https://setplannergt.com/items.17c8f97f87.dat",i.floating?1:0,
    [...new Set(i.referencePieces.map(p=>p.sequence?.policy).filter(Boolean))].join("|"),
    i.renderer?1:0,i.xmlBoundCount??0,archive.get(i.id)?.boundAnimationTracks??0,
    archive.get(i.id)?.horseSitReferenceGait?1:0,raw.petCells?1:0,
    archive.get(i.id)?.linkedPetCellFollower?1:0,
    r.nativeFieldsPreserved?1:0,r.doubleJump?1:0,r.highJump?1:0,r.slowFall?1:0,r.speedy?1:0,
    r.abilitySources?.join("|")??"",r.animalReferenceGait?1:0,r.gaitPeriodMs??"",
    r.xmlParticleMaximumObserved??0,r.unsupportedParticleExpressions?.join("|")??"",
    r.referenceFx??"",r.referenceFxSource??"",
    r.fxFlag&&!r.xmlParticleMaximumObserved&&!r.referenceFx?1:0];
});
fields.push("nativeFieldsPreserved","doubleJump","highJump","slowFall","speedy",
  "abilitySources","animalReferenceGait","gaitPeriodMs","xmlParticleMaximumObserved",
  "unsupportedParticleExpressions","referenceFx","referenceFxSource","unresolvedFxFlag");
process.stdout.write([fields,...rows].map(r=>r.map(esc).join(",")).join("\n")+"\n");
