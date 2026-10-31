import { compose, translate, scale, rotate, around, IDENTITY, clamp } from "./math.mjs";
import { PLANNER_PROFILE } from "./planner-profile.mjs";
import { armMatrix, heldMatrix, punchMatrix, playerRoot } from "./rig.mjs";
import { sampleFrames } from "./animation.mjs";
import { spriteMatrix, samplePublicParts } from "./items.mjs";
import { resolveLook } from "./look.mjs";

// Semantic hide tags in our API. Never equate these with native numeric flags.
const slotPass={0:"RenderHat",1:"RenderShirt",2:"RenderPants",3:"RenderShoes",4:"RenderFaceItem",
  5:"RenderHandItem",6:"RenderBackpack",7:"RenderHair",8:"RenderChestItem",9:"RenderAura"};
const blank=()=>({alpha:1,tint:null,add:false});
function rawCall(record,pass,local=IDENTITY) {
  return {...blank(),atlas:record.a,sx:record.sx,sy:record.sy,sw:record.sw,sh:record.sh,
    matrix:compose(local,spriteMatrix(record)),alpha:record.o??1,pass,tint:record.t??null,
    sourcePixelsPerUnit:record.pixelsPerUnit??1,add:!!record.add,blend:record.blend,
    renderOrder:record.renderOrder,pet:!!record.pet,smooth:!!record.sm};
}
export function resolveWear(items,baseSkin=[255,206,180,255]) {
  // Priority is deterministic but not claimed to be official for conflicting items.
  // A calibrated resolver can supply a different items order before calling this.
  const skin=items.find(i=>i.skin)?.skin??baseSkin;
  return {skin,alpha:items.reduce((a,i)=>a*(i.bodyAlpha??1),((skin[3]??255)/255)),
    hide:new Set(items.flatMap(i=>[...(i.hide??[]),...(i.headless?["head","eyes","eyelids"]:[])])),invisible:items.some(i=>i.invisible),
    hideLegs:items.some(i=>i.hideLegs),hideFace:items.some(i=>i.hideFace),
    noPants:items.some(i=>i.noPants),
    riderLift:(items.find(i=>i.slot===3&&i.vehicle)??items.find(i=>i.riderLift!==undefined))?.riderLift??0,
    riderShiftX:items.find(i=>i.slot===3&&i.vehicle)?.riderShiftX??0};
}
function baseCalls(pose,wear,profile) {
  const out=[];
  const body=(tag,atlas,sx,sy,sw,sh,matrix,pass="BODY",tint=wear.skin.slice(0,3),alpha=wear.alpha)=>{
    if(wear.invisible||wear.hide.has(tag)) return;
    if(wear.hideLegs&&["backFoot","frontFoot","backLeg","frontLeg"].includes(tag)) return;
    out.push({...blank(),tag,atlas,sx,sy,sw,sh,matrix,pass,tint,alpha});
  };
  body("body","player_body_only.png",0,0,32,32,IDENTITY);
  body("head","player_head.png",0,0,32,32,IDENTITY);
  // Feet are two stacked source rows, not a 32x64 sprite stretched onto one foot.
  body("backFoot","player_feet.png",0,32,32,32,translate(0,pose.backFoot));
  body("frontFoot","player_feet.png",0,0,32,32,translate(0,pose.frontFoot));
  for(const [tag,x,offset] of [["frontLeg",8,pose.frontFoot],["backLeg",16,pose.backFoot]]) {
    const h=2+offset;
    if(h>0.01) body(tag,"player_extraleg.png",x-8,0,8,1,compose(translate(x,28),scale(1,h)));
  }
  if(!wear.hideFace) {
    const [x,y]=pose.face??[0,0];
    body("eyes","player_eyes.png",x*32,y*32,32,32,IDENTITY,"BODY",null,1);
    body("eyelids","player_eyes.png",x*32,(y+4)*32,32,32,IDENTITY,"BODY",wear.skin.slice(0,3),1);
  }
  for(const side of ["back","front"]) {
    if(side==="back"&&pose.punch) {
      body("backArm","player_puncharm.png",180,0,20,48,punchMatrix(pose.punch,profile),"RenderBackArm");
    } else {
      const at=profile.arm[side];
      const matrix=compose(
        around([at[0]+profile.arm.w/2,at[1]+1],rotate(pose[`${side}Angle`])),
        translate(...at));
      body(`${side}Arm`,profile.arm.atlas,0,0,profile.arm.w,profile.arm.h,matrix,
        side==="back"?"RenderBackArm":"RenderFrontArm");
    }
  }
  return out;
}
function fallbackPiecePass(record,item) {
  // gameIcon's u is a planner-recording draw band, NOT a native clothing slot.
  if(record.u===0) return "RenderBehind";
  if(record.u===1) return record.a==="player_sleeve.png"?"RenderBackArm":"BODY";
  if(record.u===11) return "RenderFrontArm";
  return slotPass[item.slot]??"RenderInFront";
}
function attachmentMatrix(name,pose,profile,referenceAngle=0) {
  if(name==="backArm") return armMatrix("back",pose.backAngle,profile);
  if(name==="frontArm") return armMatrix("front",pose.frontAngle,profile);
  if(name==="backHand") return heldMatrix("back",pose.backAngle,referenceAngle,profile);
  if(name==="frontHand") return heldMatrix("front",pose.frontAngle,referenceAngle,profile);
  if(name==="backFoot") return translate(0,pose.backFoot);
  if(name==="frontFoot") return translate(0,pose.frontFoot);
  return IDENTITY;
}
function sampleItem(item,motion,pose,catalog,profile) {
  const clip=item.clips?.[motion.punch?"punch":motion.locomotion]??item.clips?.idle;
  // Fully supplied descriptors always outrank approximate public-catalog fallbacks.
  const explicit=clip ? sampleFrames(clip,motion.punch?.ageMs??motion.moveMs) : item.pieces;
  // An intentionally empty clip frame hides the item; it must not revive the icon fallback.
  let records=clip?(explicit??[]):explicit?.length?explicit:null;
  if(!records) {
    records=samplePublicParts(item,motion.clockMs,catalog);
    // parts alone can miss sleeves; preserve static icon sleeves only.
    const sleeves=(item.raw?.gameIcon??[]).filter(p=>p.a==="player_sleeve.png");
    if(records.length) records=[...records,...sleeves];
    else records=(item.raw?.gameIcon??[]).filter(p=>p.a);
  }
  const out=[];
  for(const record of records) {
    // Pet leash string: a line primitive, not an atlas blit. from/to are rig
    // coordinates authored by the pet step; it composes through the same
    // root/attachment path as the pet pieces.
    if(record.line) {
      out.push({...blank(),line:record.line,matrix:IDENTITY,pass:record.pass??"RenderBehind",
        owner:item.id,attachment:record.attachment??"pet",unlifted:!!record.unlifted,pet:!!record.pet});
      continue;
    }
    const side=record.a==="player_sleeve.png"?(record.x===24?"back":record.x===9?"front":null):null;
    if(side==="back"&&pose.punch) {
      const index=Math.round(record.sx/record.sw);
      const tint=item.punchSleeves.find(s=>s[0]===index)?.[1];
      out.push({...blank(),atlas:"player_puncharm.png",sx:index*20,sy:0,sw:20,sh:48,
        matrix:punchMatrix(pose.punch,profile),pass:"RenderBackArm",alpha:record.o??1,
        tint:record.skin?"SKIN":record.t??tint?.slice(0,3)??null,owner:item.id});
      continue;
    }
    const attachment=record.attachment??(side?`${side}Arm`:item.slot===5?"frontHand":"body");
    let local=attachmentMatrix(attachment,pose,profile,record.referenceAngle??0);
    if(record.noFacing&&motion.facing<0)local=compose(local,translate(32,0),scale(-1,1));
    const call=rawCall(record,record.pass??fallbackPiecePass(record,item),local);
    call.renderOrder ??= item.renderOrder;
    if(record.skin) call.tint="SKIN";
    call.owner=item.id;
    call.xmlParticle=!!record.xmlParticle;call.fxEngine=!!record.fxEngine;
    call.attachment=attachment;
    call.world=attachment==="world";
    call.unlifted=attachment==="mount"||attachment==="world";
    out.push(call);
  }
  return out;
}
export function buildDrawList({motion,pose,items=[],catalog,profile=PLANNER_PROFILE,visual={},extraPieces=[]}) {
  if(!catalog) throw Error("Provide base catalog; assets are intentionally not bundled");
  const slots=new Set();
  for(const item of items) {
    if(slots.has(item.slot)) throw Error(`Conflicting equipped slot ${item.slot}`);
    slots.add(item.slot);
  }
  // Basic slot hiding only; planner-specific raptor/mermaid/wornWith/wrapped
  // substitutions require an authored equipment resolver and are not guessed.
  const visibleItems=resolveLook(items).displayed;
  const contributors=visual.contributors??items;
  const contributions=resolveWear(contributors,visual.skin);
  const wear={...resolveWear(visibleItems,visual.skin),skin:contributions.skin,
    alpha:contributions.alpha,invisible:contributions.invisible};
  if(visibleItems.some(item=>item.slot===3)&&!visual.renderBareFeetWithShoes) {wear.hide.add("backFoot");wear.hide.add("frontFoot");}
  let calls=baseCalls(pose,wear,profile);
  for(const item of visibleItems) {
    if(wear.noPants&&item.slot===2) continue;
    calls.push(...sampleItem(item,motion,pose,catalog,profile));
  }
  calls.push(...extraPieces);
  const root=playerRoot(motion,visual,profile);
  const lift=translate((visual.playerLift?.x??wear.riderShiftX)+(visual.liftX??0),
    (visual.playerLift?.y??wear.riderLift)+(visual.liftY??0));
  const order=[...profile.passOrder];
  const face=items.find(i=>i.slot===4),hair=items.find(i=>i.slot===7);
  const faceMode=face?.raw?.faceEarly?"early":face?.raw?.overHat?"overHat":hair?.raw?.hood?"overHair":"normal";
  const relocate=(name,after)=>{
    order.splice(order.indexOf(name),1);order.splice(order.indexOf(after)+1,0,name);
  };
  if(faceMode==="early") {order.splice(order.indexOf("RenderFaceItem"),1);order.splice(order.indexOf("RenderShirt"),0,"RenderFaceItem");}
  if(faceMode==="overHat") relocate("RenderFaceItem","RenderHat");
  if(faceMode==="overHair") relocate("RenderFaceItem","RenderHair");
  if(items.find(i=>i.slot===8)?.raw?.overHat) relocate("RenderChestItem",faceMode==="overHat"?"RenderFaceItem":"RenderHat");
  return calls.filter(call=>visual.effects!==false||!call.xmlParticle).map((call,index)=>({
    ...call,alpha:clamp(call.alpha??1,0,1),
    tint:call.tint==="SKIN"?wear.skin.slice(0,3):call.tint,
    matrix:call.world?call.matrix:compose(root,call.unlifted&&!visual.playerLift?.floating?
      translate(0,visual.playerLift?.vehicleY??0):lift,call.matrix),
    _index:index
  })).sort((a,b)=>compareDrawCalls(a,b,order));
}

export function compareDrawCalls(a,b,order=PLANNER_PROFILE.passOrder) {
  const ai=order.indexOf(a.pass),bi=order.indexOf(b.pass);
  if(ai<0||bi<0) throw Error("Unknown render pass");
  return ai-bi||(a.renderOrder??0)-(b.renderOrder??0)||(a._index??0)-(b._index??0);
}

// Atlas registry stores source pixels per logical pixel independently per atlas.
// A 64px source frame covering 32 logical units has pixelsPerUnit=2.
export function drawCanvas(ctx,calls,atlases,{tilePixels=32,camera=[0,0],dpr=1}={}) {
  if(![32,64,128,256].includes(tilePixels)) throw Error("tilePixels must be 32/64/128/256");
  const viewport=compose(scale(tilePixels/32*dpr),translate(-camera[0],-camera[1]));
  ctx.save();
  try {
    ctx.imageSmoothingEnabled=false;
    for(const call of calls) {
      ctx.globalAlpha=call.alpha??1;
      ctx.globalCompositeOperation=call.add||call.blend==="add"?"lighter":call.blend==="screen"?"screen":"source-over";
      if(call.line) {
        const m=compose(viewport,call.matrix);
        ctx.setTransform(...m);
        ctx.globalAlpha=call.alpha;
        ctx.strokeStyle=`rgb(${(call.line.rgb??[180,180,180]).join(",")})`;
        ctx.lineWidth=call.line.width??1;
        ctx.lineCap="round";
        ctx.beginPath();
        ctx.moveTo(call.line.from[0],call.line.from[1]);
        ctx.lineTo(call.line.to[0],call.line.to[1]);
        ctx.stroke();
        continue;
      }
      const atlas=atlases.get(call.atlas);
      if(!atlas) throw Error(`Missing atlas ${call.atlas}`);
      const ppu=atlas.pixelsPerUnit??1;
      if(ppu<=0) throw Error("Invalid atlas density");
      if(call.sourcePixelsPerUnit!==undefined&&call.sourcePixelsPerUnit!==ppu)
        throw Error(`Descriptor/atlas density mismatch for ${call.atlas}`);
      const m=compose(viewport,call.matrix,scale(1/ppu));
      ctx.setTransform(...m);ctx.globalAlpha=call.alpha;
      ctx.imageSmoothingEnabled=!!call.smooth;
      // Tint must multiply RGB and preserve source alpha. Adapter can cache tinted crops.
      if(call.tint) {
        if(!atlas.tintedCrop) throw Error(`Tint adapter required for ${call.atlas}`);
        const crop=atlas.tintedCrop(call);
        ctx.drawImage(crop,0,0,call.sw,call.sh);
      } else {
        const width=atlas.image.naturalWidth??atlas.image.width,height=atlas.image.naturalHeight??atlas.image.height;
        const edge=call.sx<0||call.sy<0||call.sx+call.sw>width||call.sy+call.sh>height;
        if(edge&&atlas.sampleCrop)ctx.drawImage(atlas.sampleCrop(call),0,0,call.sw,call.sh);
        else ctx.drawImage(atlas.image,call.sx,call.sy,call.sw,call.sh,0,0,call.sw,call.sh);
      }
    }
  } finally {ctx.restore();}
}
