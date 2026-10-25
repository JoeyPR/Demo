import {importPlannerItem, samplePublicParts} from "./items.mjs";
import {sequencePolicy,sequenceTime,sampleSequenceIndex,isFloatingItem} from "./motion-policy.mjs";
import {bindXmlRenderer,advanceXmlRenderer} from "./xml-renderer.mjs";
import {applyMountedGait} from "./mounted-gait.mjs";
import {advancePet} from "./pet-system.mjs";

// Public reference adapter. gameIcon supplies an authored still, not native clips.
export function normalizeCatalogItem(raw,catalog) {
  const item=importPlannerItem(raw);
  const records=raw.gameIcon??[];
  const lift=records.find(r=>Array.isArray(r.lift))?.lift;
  const arms=records.filter(r=>r.a==="player_arm.png"&&r.skin);
  // Preserve absence. An ordinary hat must not mask a later floating cosmetic.
  item.riderLift=raw.riderLift??lift?.[1];
  item.riderShiftX=lift?.[0]??0;
  item.liftProfile=catalog.liftProfiles?.[raw.id]??null;
  item.floatBehavior=raw.floatBehavior;
  item.floating=isFloatingItem(item);
  item.seated=raw.slot===3&&records.some(r=>r.seat);
  // A lift is not, by itself, evidence of a seated vehicle.
  item.vehicle=raw.slot===3&&(item.seated||raw.riderLift!==undefined||!!lift);
  item.hideLegs=!!raw.hideLegs||item.seated;
  item.noPants=!!raw.noPants||item.seated;
  item.staticArmPose={...item.pose};
  for(const arm of arms) {
    const key=arm.x===24?"backAngle":arm.x===9?"frontAngle":null;
    if(key&&item.staticArmPose[key]===undefined)item.staticArmPose[key]=arm.r??0;
  }
  item.pose={...item.staticArmPose};
  let source=records.some(r=>r.a)?records.filter(r=>r.a):samplePublicParts(item,0,catalog);
  // Machine pets (kind 200) can ship without a gameIcon: their whole draw is a
  // single rect part flagged pet:1. The live client expands that rect into a
  // 64x64 piece reading the cell at (rect.x, rect.y-32) — the bottom half of
  // the rect's 64x64 cell — center-anchored at the part's authored at. Verified
  // against the live setplannergt.com canvas: the Royal Alpha Wolf piece draws
  // from (0,704,64,64) for rect [0,736,64,32].
  if(!source.some(r=>r.pet)&&raw.parts?.some(p=>p.pet&&p.rect)) {
    for(const part of raw.parts.filter(p=>p.pet&&p.rect)) {
      source.push({a:part.atlas,sx:part.rect[0],sy:part.rect[1]-32,sw:64,sh:64,
        x:part.at?.[0]??0,y:part.at?.[1]??0,ax:.5,ay:.5,u:part.front?12:0,pet:true});
    }
  }
  // Pet sprites are captured once per planner draw band, so one pet's gameIcon
  // can list the same sprite twice — behind (u=0) and in front (u=12). The pet
  // engine animates only its main piece, so an identical duplicate stays frozen
  // on the captured idle cell and draws over the animation. Keep one record per
  // distinct pet sprite: equality is every authored field except the draw band.
  const seenPet=new Set();
  source=source.filter(r=>{
    if(!r.pet)return true;
    const {u:band,...rest}=r;
    // Canonical key: sort the top-level fields into a fresh object and stringify
    // without a replacer — a key whitelist would also strip nested arrays (f/k)
    // and merge records that differ only by flip.
    const key=JSON.stringify(Object.fromEntries(Object.keys(rest).sort().map(k=>[k,rest[k]])));
    if(seenPet.has(key))return false;
    seenPet.add(key);return true;
  });
  item.pieces=source.filter(r=>!(r.a==="player_arm.png"&&r.skin)).map(record=>{
    let attachment="body";
    let pass=({0:"RenderHat",1:"RenderShirt",2:"RenderPants",3:"RenderShoes",4:"RenderFaceItem",
      5:"RenderHandItem",6:"RenderBackpack",7:"RenderHair",8:"RenderChestItem",9:"RenderAura"})[raw.slot];
    const sleeve=record.a==="player_sleeve.png";
    if(sleeve) {
      const back=record.x===24;
      attachment=back?"backArm":"frontArm";pass=back?"RenderBackArm":"RenderFrontArm";
    } else if(record.pet||!item.vehicle&&raw.parts?.some(p=>p.pet&&p.atlas===record.a)) {
      attachment="pet";pass="RenderPet";
    } else if(item.vehicle) {
      // Captured mount and seat geometry stays in the unlifted vehicle root.
      attachment="mount";
      pass=record.u>=10.25?"RenderSeat":"RenderShoes";
    } else if(raw.slot===5&&!record.pet&&!record.ride&&
      !raw.unturned?.includes(record.a+":"+Math.floor(record.sy/32)))attachment="frontHand";
    else if(raw.slot===3)attachment=record.sy%64>=32?"backFoot":"frontFoot";
    if(!sleeve&&attachment!=="pet"&&record.u===0)pass=raw.slot===7?"RenderBackHair":"RenderBehind";
    if(!sleeve&&attachment!=="pet"&&record.u===12)pass="RenderInFront";
    const referenceAngle=raw.slot===5?(raw.pose?.arm2??0):0;
    return {...record,pass,attachment,referenceAngle};
  });
  // Only bind a public part sequence when its complete source cell contains the
  // captured sprite. Never animate every piece using the first part's frames.
  for(const piece of item.pieces) {
    if(piece.seat||piece.a==="player_sleeve.png")continue;
    // Static rect artwork must not accidentally inherit a neighboring sequence.
    const fixed=raw.parts?.some(p=>p.atlas===piece.a&&p.rect&&
      p.rect[0]===piece.sx&&p.rect[1]===piece.sy&&p.rect[2]===piece.sw&&p.rect[3]===piece.sh);
    if(fixed)continue;
    let candidates=raw.parts?.filter(p=>{
      const cell=p.cell??raw.cell??[1,1,0],frame=p.frames?.[0];
      if(!frame||p.rect||p.pet||p.atlas!==piece.a)return false;
      return piece.sw<=cell[0]*32&&piece.sh<=(cell[2]?1:cell[1])*32;
    })??[];
    // Icon captures can be at a different cycle frame, or in a split back/front
    // row. Bind by same-atlas source-cell proximity, retaining capture offsets.
    const nearest=p=>{
      const cell=p.cell??raw.cell??[1,1,0];
      return [...p.frames].sort((a,b)=>
        (Math.abs(piece.sx-a[0]*cell[0]*32)*4+Math.abs(piece.sy-a[1]*cell[1]*32))-
        (Math.abs(piece.sx-b[0]*cell[0]*32)*4+Math.abs(piece.sy-b[1]*cell[1]*32)))[0];
    };
    const distance=p=>{
      const cell=p.cell??raw.cell??[1,1,0],f=nearest(p);
      return Math.abs(piece.sx-f[0]*cell[0]*32)+Math.abs(piece.sy-f[1]*cell[1]*32);
    };
    candidates.sort((a,b)=>distance(a)-distance(b));
    const part=candidates[0];
    if(part?.frames?.length>1) {
      const cell=part.cell??raw.cell??[1,1,0],capturedFrame=nearest(part);
      piece.sequence={frames:part.frames,ms:part.ms??catalog.frameMs,
        policy:sequencePolicy(item,part),
        stride:[cell[0]*32,cell[1]*32],offset:[piece.sx-capturedFrame[0]*cell[0]*32,piece.sy-capturedFrame[1]*cell[1]*32]};
    }
    if(part?.flicker)piece.flicker=part.flicker;
    if(part?.pulse)piece.pulse=part.pulse;
  }
  bindXmlRenderer(item,catalog);
  item.floating=isFloatingItem(item);
  item.referencePieces=item.pieces.map(p=>({...p,...(p.k?{k:p.k.slice()}:{})}));
  item.coverage=raw.script?"External script missing":item.vehicle?"Public mount still + fallback motion":
    raw.fx||raw.punchFx||raw.airJumpFx?"Public sprites; external FX missing":"Public sprite reference";
  if(item.renderer)item.coverage=`XML ${raw.script}: ${item.xmlBoundCount} sprite bindings; partial rules`;
  return item;
}

export function advanceCatalogItem(item,timeMs,motion={}) {
  const playback=sequenceTime(item,timeMs,motion);
  item.animationState={...playback,
    policies:[...new Set(item.referencePieces?.filter(p=>p.sequence).map(p=>p.sequence.policy))]};
  const references=item.referencePieces??item.pieces;
  item.pieces=references.map(base=>{
    const piece={...base};
    if(base.k)piece.k=base.k.slice();
    if(piece.sequence) {
      const s=piece.sequence,f=s.frames[sampleSequenceIndex(s,playback,timeMs,item.raw.still)];
      piece.sx=f[0]*s.stride[0]+s.offset[0];piece.sy=f[1]*s.stride[1]+s.offset[1];
    }
    for(const clock of [].concat(item.raw.clockFrames??[])) {
      if(clock.a!==base.a||!clock.cells.some(([x,y])=>x*clock.size===base.sx&&y*clock.size===base.sy))continue;
      if(clock.ms) {
        const [x,y]=clock.cells[Math.floor(timeMs/clock.ms)%clock.cells.length];
        piece.sx=x*clock.size;piece.sy=y*clock.size;
      }
      if(clock.pulse)piece.o=(Math.sin(2*Math.PI*((timeMs%clock.pulse+clock.pulse)%clock.pulse)/clock.pulse)+1)/2;
    }
    if(piece.flicker) {
      const frame=Math.floor(timeMs/1000*60);
      const random=salt=>{
        let x=(frame*0x9e3779b1+salt*0x9e37+item.id*0x61)>>>0;
        x^=x>>>15;x=Math.imul(x,0x85ebca77)>>>0;x^=x>>>13;return (x>>>0)/0x100000000;
      };
      const [lo,hi]=piece.flicker.scale;
      piece.k=[lo+(hi-lo)*random(1),lo+(hi-lo)*random(2)];
      piece.o=piece.flicker.alpha;piece.add=piece.flicker.add;
    }
    if(piece.pulse) {
      const p=piece.pulse,[kx,ky]=base.k??[1,1];
      piece.k=[kx*(1+p.amp*Math.sin(timeMs/p.ms*2*Math.PI)),
        ky*(1+p.amp*Math.sin(timeMs/(p.msY??p.ms)*2*Math.PI))];
    }
    return piece;
  });
  const chak=item.raw.chakrams;
  if(chak) {
    item.pieces=item.pieces.filter(p=>!(p.a===chak.a&&p.sy===chak.row*32));
    for(const orbit of chak.list) {
      const t=((timeMs+orbit.phase)%0x100000000+0x100000000)%0x100000000;
      const angle=2*Math.PI*(t%2500)/2500,sine=Math.sin(angle),cosine=Math.cos(angle);
      if(sine===0)continue;
      const scale=orbit.k[0]+(orbit.k[1]-orbit.k[0])*(sine+1)/2;
      const x=16-orbit.r[0]*cosine;
      item.pieces.push({a:chak.a,sx:orbit.cells[Math.floor(t/200)%4]*32,sy:chak.row*32,sw:32,sh:32,
        x:motion.facing<0?32-x:x,y:32+orbit.off[1]-orbit.r[1]*cosine,ax:.5,ay:.5,k:[scale,scale],
        u:sine<0?0:12,pass:sine<0?"RenderBehind":"RenderInFront",attachment:"body",sm:1});
    }
  }
  // Pet state must exist before the scripted renderer steps: the Captain Bark
  // XML states read PetFlyWalk/PunchDelay from motion.petVars, which advancePet
  // publishes for the equipped pet each frame.
  advancePet(item,timeMs,motion);
  advanceXmlRenderer(item,timeMs,motion);
  applyMountedGait(item,motion);
  return item.pieces;
}
