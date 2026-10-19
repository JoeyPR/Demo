import { sampleFrames } from "./animation.mjs";
import { compose, translate, rotate, scale } from "./math.mjs";

// The two slot domains intentionally have separate names.
export const PLANNER_SLOTS=Object.freeze(["Hat","Shirt","Pants","Feet","Face","Hand","Back","Hair","Chest","Ancestral"]);
export function requirePlannerCatalog(data) {
  // Packed planner .dat is decoded JSON, NOT the official binary items.dat schema.
  if(!Array.isArray(data.items)||data.tile!==32||!data.arm)
    throw Error("Expected decoded Set Planner catalog, not native items.dat");
  return data;
}
export function spriteMatrix(piece) {
  const density=piece.pixelsPerUnit??1;
  if(!Number.isFinite(density)||density<=0) throw Error("Invalid piece density");
  const w=piece.sw/density,h=piece.sh/density,[sx,sy]=piece.k??[1,1],pivot=piece.rp??[0,0];
  let m=compose(translate(piece.x??0,piece.y??0),
    translate(...pivot),rotate(piece.r??0),translate(-pivot[0],-pivot[1]),
    scale(sx,sy),translate(-(piece.ax??0)*w,-(piece.ay??0)*h));
  if(piece.f?.[0]) m=compose(m,[-1,0,0,1,w,0]);
  if(piece.f?.[1]) m=compose(m,[1,0,0,-1,0,h]);
  return m;
}
export function catalogCoverage(catalog) {
  return catalog.items.map(item=>({
    id:item.id,name:item.name,slot:item.slot,slotName:PLANNER_SLOTS[item.slot],
    renderer:item.script??null,
    parts:item.parts?.length??0,
    punchSleeves:!!item.punchSleeves,
    doubleJumpFx:!!item.airJumpFx,riderLift:item.riderLift??null,
    completeness:item.script?"requires-external-script":item.fx||item.punchFx||item.airJumpFx
      ?"requires-external-fx":"static-or-parts-only"
  }));
}
export function importPlannerItem(item) {
  if(!Number.isInteger(item.id)||!PLANNER_SLOTS[item.slot]) throw Error("Bad item identity");
  const warnings=["Public-catalog playback is reference-only; full movement/scripts may be missing"];
  if(item.script) warnings.push(`Renderer ${item.script} unavailable until explicitly supplied`);
  if(item.fx||item.punchFx||item.airJumpFx) warnings.push("External FX descriptor required");
  if(item.gameIcon?.length) warnings.push("gameIcon is a static reference, not a complete movement clip");
  return {
    id:item.id,name:item.name,slot:item.slot,provenance:"set-planner-catalog",
    warnings,raw:item,
    skin:item.playmod?.skin??null,bodyAlpha:item.playmod?.alpha??1,
    invisible:!!item.playmod?.invisible,
    pose:item.pose?{backAngle:item.pose.arm1,frontAngle:item.pose.arm2}:{},
    riderLift:item.riderLift,hideLegs:!!item.hideLegs,
    noPants:!!item.noPants,hideFace:!!item.hideFace,headless:!!item.headless,
    punchSleeves:item.punchSleeves??[],
    // Planner hides/hidesWrapped use planner clothing slots; native bodyPart bytes
    // remain a separate, unverified domain.
    hideSlots:item.hides??[],wrappedSlots:item.hidesWrapped??[],
    hide:[], // Semantic body tags, separate from clothing slots.
    pieces:[],clips:{},hooks:{},emitters:[],
    completeness:"reference-only"
  };
}
// Fallback animations use explicit public parts, not complete sealed renderer scripts.
export function samplePublicParts(item,timeMs,catalog) {
  const raw=item.raw,parts=raw.parts?.length?raw.parts:raw.atlas?[{atlas:raw.atlas,frames:[[raw.x??0,raw.y??0]]}]:[];
  return parts.filter(p=>!p.pet&&!p.orbit).flatMap(part=>{
    const cell=part.cell??raw.cell??[1,1,0];
    const frame=sampleFrames({frames:part.frames??[[raw.x,raw.y]],frameMs:part.ms??catalog.frameMs},timeMs);
    const tile=catalog.tile, sw=part.w??cell[0]*tile;
    const [ox,oy]=part.at??catalog.slotOffset[raw.slot]??[0,0];
    const [rx,ry,rw,rh]=part.rect??[frame[0]*cell[0]*tile,frame[1]*cell[1]*tile,sw,cell[1]*tile];
    const record={a:part.atlas??raw.atlas,sx:rx,sy:ry,sw:rw,sh:rh,
      x:ox,y:oy,ax:0,ay:0,u:part.front?12:10,o:part.alpha??1,
      t:part.tint,k:[part.scale??1,part.scale??1],attachment:raw.slot===5?"frontHand":"body",approximate:true};
    const records=cell[2]&&!part.rect?Array.from({length:cell[1]},(_,i)=>{
      const row=cell[1]-1-i;
      return {...record,sy:(frame[1]*cell[1]+row)*tile,sh:tile,sourceRow:row};
    }):[record];
    if(part.flip)for(const r of records)r.k=[-r.k[0],r.k[1]],r.x+=r.sw*r.k[1];
    if(part.mirror!==undefined)records.push(...records.map(r=>({...r,x:part.mirror+1-ox,k:[-r.k[0],r.k[1]]})));
    return records;
  });
}
