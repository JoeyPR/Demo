// Inert XML IR interpreter. Only the operations implemented here execute.
// Unknown conditions fail closed. Parsing a script is NOT complete support.
import {locomotionState} from "./motion-policy.mjs";
import {PLANNER_PROFILE} from "./planner-profile.mjs";
import {resolveProperties,makeRng} from "./xml-expr.mjs";
import {buildTriggerTable} from "./xml-triggers.mjs";
const children=(n,tag)=>(n?.c??[]).filter(c=>!tag||c.tag===tag);
const walk=n=>n?[n,...children(n).flatMap(walk)]:[];
export const numbers=s=>String(s??"").split(",").map(Number);
const truth=s=>s===true||s==="true";
const first=(n,t)=>children(n,t)[0];
const value=(n,k)=>children(n).find(c=>c.a?.name===k);
const random=n=>{let x=Math.imul(n+1,0x45d9f3b);x^=x>>>16;return(x>>>0)/4294967296;};
const ITEM_SYMBOL_IDS={
  ITEM_ID_RAPTOR_LEGS:6294,ITEM_ID_MERMAID_TAIL:3464,ITEM_ID_WINGS_OF_INFINITY:15826,
  ITEM_ID_TACTICAL_STEALTH_DEVICE:10048,ITEM_ID_STAR_FIGHTER_REBEL_RAIDER:9136,
  ITEM_ID_STAR_FIGHTER_IMPERIAL_ENFORCER:9138
};
export function variable(name,motion) {
  const state=locomotionState(motion),vx=motion.vx||(state.moving?90:0),vy=motion.vy??0;
  return {"speed.x":vx,"speed.y":vy,"speed.length":Math.hypot(vx,vy),
    onGround:!state.airborne,punchInProgress:!!motion.punch,punching:!!motion.punch,
    isFacingLeft:motion.facing<0}[name];
}
export const UNRESOLVED_ITEM_SYMBOL_WORN=false;
export function unresolvedWearingSymbols(renderer) {
  return [...new Set(walk(renderer.rules).filter(n=>n.tag==="IsWearing"&&!/^\d+$/.test(n.v)&&ITEM_SYMBOL_IDS[n.v]===undefined).map(n=>n.v))];
}
export function condition(n,motion,states={}) {
  if(!n)return false;
  const a=n.a??{},v=n.v;
  if(["Condition","StopIf","IsTrue"].includes(n.tag)) {
    const checks=children(n).map(c=>condition(c,motion,states));
    if(!checks.length)return undefined;
    if(a.type==="and"){
      if(checks.includes(false))return false;
      return checks.includes(undefined)?undefined:true;
    }
    if(checks.includes(true))return true;
    return checks.includes(undefined)?undefined:false;
  }
  if(n.tag==="IsVariableFloat") {
    let x=variable(a.name,motion);if(x===undefined)return undefined;if(truth(a.abs))x=Math.abs(x);
    const y=Number(v);
    return ({Less:x<y,Greater:x>y,LessOrEqual:x<=y,GreaterOrEqual:x>=y,Equal:x===y,NotEqual:x!==y})[a.operator]??false;
  }
  if(n.tag==="IsVariableBool"){
    const x=variable(a.name,motion);return x===undefined?undefined:x===truth(v);
  }
  const context=motion.renderContext??{};
  const contextual={
    IsZombified:!!context.zombified,IsTrnsformed:!!context.transformed,
    IsSitting:!!context.sitting,IsSleepingOnaBed:!!context.sleepingOnBed,
    IsItemTransformed:!!context.itemTransformed,IsFacingLeft:motion.facing<0,
    IsDancing:motion.locomotion==="dance"
  };
  if(n.tag in contextual)return contextual[n.tag]===truth(v);
  if(n.tag==="IsRenderMod")return (context.renderMods??[]).includes(v);
  if(n.tag==="IsRenderObjectFlag")return (context.renderObjectFlags??[]).includes(v);
  if(n.tag==="IsWearing"){
    const id=/^\d+$/.test(v)?Number(v):ITEM_SYMBOL_IDS[v];
    // A symbolic id the table does not know (ITEM_ID_HAUNTED, ITEM_ID_ENCHANTED_ROBE) cannot be matched to an equipped item. Returning
    // undefined used to halt the whole hook (StopIf treats undefined as "stop"), which silently removed every particle of a worn item.
    // It now counts as "not worn" and is listed by unresolvedWearingSymbols() so the fidelity badge can say so. [HYP]
    return id===undefined?UNRESOLVED_ITEM_SYMBOL_WORN:(context.equippedIds??[]).includes(id);
  }
  if(n.tag==="IsInState"){
    const [machine,state]=String(a.name).split(".");
    return (states[machine]?.state===state)===truth(v);
  }
  if(n.tag==="IsState")return Object.values(states).some(s=>s.state===v);
  if(n.tag==="IsAction")return (motion.punch?["PUNCH","BUILD"]:
    locomotionState(motion).airborne?[locomotionState(motion).state==="jump"?"JUMP":"FALL"]:
    [locomotionState(motion).moving?"WALK":"IDLE"]).includes(v);
  return undefined;
}
export function curveSample(n,time) {
  const frames=children(n,"KeyFrame").map(k=>numbers(k.v)).sort((a,b)=>a[0]-b[0]);
  if(!frames.length)return [0];
  if(time<=frames[0][0])return frames[0].slice(1);
  if(time>=frames.at(-1)[0])return frames.at(-1).slice(1);
  const b=frames.findIndex(f=>f[0]>time),a=frames[b-1],z=frames[b],t=(time-a[0])/(z[0]-a[0]);
  return a.slice(1).map((v,i)=>v+(z[i+1]-v)*t);
}
function property(n,motion,time,seed=1) {
  if(!n)return undefined;
  if(n.tag==="Set")return /^-?[\d.]+(?:\s*,\s*-?[\d.]+)*$/.test(n.v)?numbers(n.v):n.v.replaceAll('"',"");
  if(n.tag==="Curve")return curveSample(n,time);
  if(n.tag==="Random") {
    const lo=numbers(n.a.min),hi=numbers(n.a.max);
    return lo.map((x,i)=>x+(hi[i]-x)*random(seed+i*17));
  }
  if(n.tag==="Select") {
    const nodes=children(n,"Item");return nodes.length?property({tag:"Set",v:nodes[seed%nodes.length].v},motion,time,seed):undefined;
  }
  if(n.tag==="Sin"||n.tag==="Cos") {
    const amp=numbers(n.a.amp??1),base=numbers(n.a.base??0);
    const arg=n.a.input?variable(n.a.input,motion)??0:time;
    const f=Math[n.tag==="Sin"?"sin":"cos"](arg*Number(n.a.speed??1)+Number(n.a.shift??0));
    return amp.map((x,i)=>x*f+(base[i]??base[0]??0));
  }
}
function active(a,states,motion) {
  if(!a.playOnState)return true;
  return a.playOnState.split("|").some(p=>{
    const [machine,state]=p.split(".");return states[machine]?.state===state;
  });
}
export function updateMachines(renderer,item,timeMs,motion) {
  const states=item.xmlStates??={};
  for(const machine of renderer.machines??[]) {
    const name=machine.a.name;
    const state=states[name]??={state:first(first(machine,"States"),"State")?.a.name,since:timeMs};
    if(timeMs<(item.xmlLastMs??timeMs)){state.state=first(first(machine,"States"),"State")?.a.name;state.since=timeMs;}
    for(const t of children(first(machine,"Transitions"),"Transition")) {
      if(!t.a.from?.split("|").includes(state.state))continue;
      if(condition(first(t,"Condition"),motion,states)){state.state=t.a.to;state.since=timeMs;break;}
    }
  }
  item.xmlLastMs=timeMs;return states;
}
export function sampleSpriteFrame(renderer,name,timeMs,states,motion) {
  const tracks=renderer.animations.filter(n=>n.tag==="SpriteAnimation"&&n.a.sprite===name&&active(n.a,states,motion));
  // Stateful tracks win over autoplay; one animation owns one sprite.
  tracks.sort((a,b)=>Number(!!b.a.playOnState)-Number(!!a.a.playOnState));
  const track=tracks[0];if(!track)return null;
  const frames=children(track,"Frame").map(n=>numbers(n.v));
  if(!frames.length)return null;
  const stateName=track.a.playOnState?.split(".")[0];
  const elapsed=Math.max(0,timeMs-(stateName?states[stateName]?.since??0:0));
  const duration=Number(track.a.animTime)||frames.length*175;
  const fraction=truth(track.a.isLoop)?(elapsed%duration)/duration:Math.min(.999999,elapsed/duration);
  return {cell:frames[Math.floor(fraction*frames.length)],track:track.a.name,duration};
}
export function bindXmlRenderer(item,catalog) {
  const renderer=catalog.renderers?.[item.raw.script];if(!renderer)return;
  item.renderer=renderer;
  for(const p of item.pieces) {
    const candidates=Object.entries(renderer.sprites).filter(([name,s])=>{
      const [width,height]=numbers(s.textureSize??"32,32"),size=width;
      if(s.atlas!==p.a||size!==p.sw||(height??width)!==p.sh)return false;
      const frames=[...(s.frame?[numbers(s.frame)]:[]),
        ...renderer.animations.filter(a=>a.tag==="SpriteAnimation"&&a.a.sprite===name)
          .flatMap(a=>children(a,"Frame").map(f=>numbers(f.v)))];
      return frames.some(([x,y])=>x*size===p.sx&&y*size===p.sy);
    });
    if(candidates.length===1){p.xmlSprite=candidates[0][0];delete p.sequence;}
  }
  item.xmlBoundCount=item.pieces.filter(p=>p.xmlSprite).length;
  item.warnings=item.warnings.filter(w=>!w.includes("native renderer"));
  item.warnings.push(`XML ${item.raw.script}: partial interpreter; native FX/complex rules may remain unsupported`);
  item.coverage=`XML loaded; ${item.xmlBoundCount} sprite bindings; partial rules`;
}
// ---- Owner decisions, each in ONE place (work order step 3 follow-up) -----------------------------------------------
// ParticleSystemOff: stop emitting, reset the emitter, let live particles finish. NOT a latch: a later Update starts it again.
//   running -> false; emitted count -> 0 and delay timer -> cleared (the next run is a fresh emitter); live particles keep their life.
//   If an Off and an Update name the same system on the same frame the Off wins (it is applied after the frame's Updates).
export const PARTICLE_OFF={stopsEmission:true,resetsEmitterState:true,latches:false,liveParticlesFinish:true,winsSameFrame:true};
// AddClothingParticles: continuous while the item is worn. Every frame the hook's own conditions (onState / onAction / StopIf)
// are re-evaluated; a false condition ends the run (live particles finish) and a true one starts a fresh run.
export const ADD_CLOTHING_PARTICLES={mode:"continuous-while-worn",conditionGatedPerFrame:true};
// SwitchOffClothingParticles fires ONCE, when the item is unequipped (never while worn). It applies its ParticleSystemOff nodes with
// PARTICLE_OFF semantics; live particles finish. Idempotent per equip: a second call is a no-op until the item is equipped again.
export const SWITCH_OFF_CLOTHING={firesOn:"unequip",times:1};
// OnPunchBegin / OnPunchStop are kept as evidence-backed aliases. DATA: ArcaneArmor punch_start_particle = Update@OnPunchBegin +
// Off@OnPunchStop, punch_end_particle = Update@OnPunchStop + Off@OnPunchBegin (same pairs in BlackCrystalBallHead, CrystalBallHead,
// UnhelpfulHand ...). Begin == the planner's punch event; Stop == the frame the punch ends.
export const PUNCH_HOOK_EVIDENCE={
  OnPunchBegin:{alias:"OnPunchStart",source:"punch event"},
  OnPunchStop:{alias:"punch end",source:"frame motion.punch goes from set to null"},
  pairs:[{script:"ArcaneArmor",system:"punch_start_particle",update:"OnPunchBegin",off:"OnPunchStop"},
         {script:"ArcaneArmor",system:"punch_end_particle",update:"OnPunchStop",off:"OnPunchBegin"}]
};
// Event hooks fire on an event, not continuously. A predicate returns the event stamp (truthy) while the event is live.
// The planner has a punch source only; tile damage/destruction, death, respawn and world entry have none, so those hooks are
// never live (their content is not run as always-on). OnPunchBegin == OnPunchStart and OnPunchStop == the frame the punch ended
// are [HYP] from the paired Update/Off usage in ArcaneArmor / CrystalBallHead. SwitchOffClothingParticles is the unequip side.
export const EVENT_HOOKS={
  AddClothingParticles:()=>ADD_CLOTHING_PARTICLES.mode==="continuous-while-worn",
  OnPunchStart:m=>m.events?.find(e=>e.type==="punch")?.id??false,
  OnPunchBegin:m=>m.events?.find(e=>e.type==="punch")?.id??false,
  OnPunchStop:(m,ctx)=>ctx?.punchEnd??false,
  OnPunchUpdate:m=>!!m.punch,
  OnDamagedTile:()=>false,OnDestroyedTile:()=>false,OnKilled:()=>false,OnRespawned:()=>false,OnEnteredToWorld:()=>false,
  // SwitchOffClothingParticles is the unequip side: live only on the unequip pass (unequipXmlItem), never while the item is worn.
  SwitchOffClothingParticles:(m,ctx)=>ctx?.unequip===true
};
const PULSE_HOOKS=new Set(["OnPunchStart","OnPunchBegin","OnPunchStop"]);
function visibleRules(renderer,motion,states,ctx={}) {
  const output=[],stops=[];
  function visit(nodes,pass,offset=[0,0],hook,pulse) {
    let position=offset.slice();
    for(const n of nodes) {
      if(n.tag==="StopIf"){
        const decision=condition(n,motion,states);
        if(decision===true||decision===undefined)break;
      }
      if(n.a?.onState&&!n.a.onState.split("|").some(s=>{const [m,v]=s.split(".");return states[m]?.state===v;}))continue;
      if(n.tag==="Group"){visit(children(n),pass,position,hook,pulse);continue;}
      if(n.tag==="Translate"){const v=numbers(n.v);position=[position[0]+(v[0]??0),position[1]+(v[1]??0)];continue;}
      // Off is a stop request, never drawn: the run stops emitting and live particles finish their life.
      if(n.tag==="ParticleSystemOff"){stops.push({name:n.a.name,hook,onAction:n.a.onAction,onState:n.a.onState});continue;}
      if(["SpriteRender","ParticleSystemRender","ParticleSystemUpdate"].includes(n.tag))
        output.push({node:n,pass:PLANNER_PROFILE.passOrder.includes(pass)?pass:"PARTICLES",offset:position.slice(),pulse});
    }
  }
  for(const hook of children(renderer.rules)) {
    if(ctx.onlyHook&&hook.tag!==ctx.onlyHook)continue;
    const live=hook.tag in EVENT_HOOKS?EVENT_HOOKS[hook.tag](motion,ctx):true;
    if(!live)continue;
    visit(children(hook),hook.tag,[0,0],hook.tag,PULSE_HOOKS.has(hook.tag)?live:undefined);
  }
  output.stops=stops;
  return output;
}
// These aura render hooks are simple enough to replace their public stills.
// Other scripts retain their authored captures plus strictly matched tracks.
const AURA_RULES=new Set(["StarryAura","DirtAura","TwilightAura","InfinityAura","BeachAura"]);
function spritePiece(renderer,name,offset,pass) {
  const s=renderer.sprites[name];if(!s)return null;
  const [width,height]=numbers(s.textureSize??"32,32"),size=width,h=height??width;
  const [sx,sy]=numbers(s.frame??"0,0");
  return {a:s.atlas,sx:sx*size,sy:sy*h,sw:size,sh:h,
    x:16+offset[0],y:32+offset[1],ax:.5,ay:.5,pass,attachment:"body",xmlSprite:name};
}
function spriteProperties(p,node,motion,time) {
  const a=node.a;
  const alpha=value(node,"alpha"),scale=value(node,"scale"),rotation=value(node,"rotation");
  p.o=Number(a.alpha??p.o??1);
  if(alpha)p.o=property(alpha,motion,time)?.[0]??p.o;
  if(a.scale)p.k=numbers(a.scale);
  if(scale)p.k=property(scale,motion,time);
  if(a.rotation)p.r=Number(a.rotation);
  if(rotation)p.r=property(rotation,motion,time)?.[0]??0;
  p.add=a.blend==="ADDITIVE"||a.blendingMode==="ADDITIVE";
}
function actionActive(spec,motion) {
  if(!spec)return true;
  const events=motion.events??[],state=locomotionState(motion);
  return spec.split("|").some(action=>{
    if(action==="JUMPSTART")return events.some(e=>e.type==="jump");
    if(action==="JUMPDOUBLE")return events.some(e=>e.type==="doubleJump");
    if(action==="PUNCH")return !!motion.punch;
    return action===(state.airborne?(state.state==="jump"?"JUMP":"FALL"):
      motion.locomotion==="dance"?"DANCE":state.moving?"WALK":"IDLE");
  });
}
function particleEntryActive(renderer,entry,states,motion) {
  const updates=walk(renderer.rules).filter(n=>n.tag==="ParticleSystemUpdate"&&n.a.name===entry.node.a.name);
  return actionActive(entry.node.a.onAction,motion)&&(!updates.length||updates.some(n=>
    actionActive(n.a.onAction,motion)&&(!n.a.onState||n.a.onState.split("|").some(s=>{
    const [machine,state]=s.split(".");return states[machine]?.state===state;
  }))));
}
// ---- Stage-driven particle starts (work order step 2) ----------------------------------------------------------------
// 298 systems have no <ParticleSystemUpdate> rule; they start from attributes ON the <ParticleSystem> element.
// The vocabulary is [DATA]; every mapping below is [HYP] until a user capture confirms it. ONE place to change them.
const TRIGGERS=new WeakMap();
const triggersOf=r=>TRIGGERS.get(r)??(TRIGGERS.set(r,buildTriggerTable(r)),TRIGGERS.get(r));
const ON={on:true},OFF={on:false};
const worldEvent=name=>({unresolved:`needs world event: ${name}`});
export const STAGE_MAP={
  // updateStage -> (motion)=>{on}|{unresolved}|{pulse:eventType, on}
  AddClothingParticles:()=>({on:ADD_CLOTHING_PARTICLES.mode==="continuous-while-worn"}),
  SwitchOffClothingParticles:()=>OFF,           // the Off side; see ParticleSystemOff handling
  OnPunchStart:m=>({pulse:"punch",on:!!m.events?.some(e=>e.type==="punch")}),
  OnPunchBegin:m=>({pulse:"punch",on:!!m.events?.some(e=>e.type==="punch")}),   // [HYP] == OnPunchStart
  OnPunchUpdate:m=>({on:!!m.punch}),
  OnDamagedTile:()=>worldEvent("OnDamagedTile"),
  OnDestroyedTile:()=>worldEvent("OnDestroyedTile"),
  OnKilled:()=>worldEvent("OnKilled"),
  OnRespawned:()=>worldEvent("OnRespawned"),
  OnEnteredToWorld:()=>worldEvent("OnEnteredToWorld"),
  OnItemEquipped:()=>worldEvent("OnItemEquipped"),
  // render hooks used as updateStage are treated like Update in that draw pass
  ...Object.fromEntries(["RenderHandItem","RenderBackHandItem","RenderBehind","RenderBackpack","RenderShoes","RenderChestItem","RenderInFront"]
    .map(k=>[k,()=>ON]))
};
export const STATE_MAP={
  "Action.Punch":m=>({on:!!m.punch}),
  "Punch.True":m=>({on:!!m.punch}),
  "Motion.Move":m=>({on:locomotionState(m).moving}),
  "Motion.Idle":m=>({on:!locomotionState(m).moving&&!locomotionState(m).airborne})
};
export function stageActive(stage,motion) {
  const parts=[];
  if(stage.updateStage)parts.push(STAGE_MAP[stage.updateStage]?.(motion)??{unresolved:`unmapped updateStage: ${stage.updateStage}`});
  if(stage.updateState)parts.push(STATE_MAP[stage.updateState]?.(motion)??{unresolved:`unmapped updateState: ${stage.updateState}`});
  if(parts.some(x=>!x.unresolved&&!x.on))return {on:false};
  const bad=parts.find(x=>x.unresolved);if(bad)return {unresolved:bad.unresolved};
  return {on:true,pulse:parts.find(x=>x.pulse)?.pulse};
}
const passFor=renderStage=>PLANNER_PROFILE.passOrder.includes(renderStage)?renderStage:"PARTICLES";
function emitterDelayMs(renderer,name) {
  const em=first(renderer.particles.find(n=>n.a.name===name),"Emitter");
  return Math.max(0,Number(property(value(em,"delayTimer"),{},0)?.[0]??0))*1000;
}
// [HYP] A particle with no relativeToEmitter property follows the emitter (the behaviour before this flag was read).
export const RELATIVE_TO_EMITTER_DEFAULT=true;
// 5.4 renderAlignment: which point of the sprite sits on the particle position. (ax,ay) are fractions of the sprite size, y down.
// Rotation and scale pivot on that point (spriteMatrix). Absent -> CENTER, the previous behaviour. Unknown values -> CENTER, reported.
export const RENDER_ALIGNMENT={CENTER:[.5,.5],DOWN_CENTER:[.5,1],UPPER_CENTER:[.5,0],LEFT_CENTER:[0,.5],RIGHT_CENTER:[1,.5]};
// 5.6 interpolate*/final*: values come ONLY from the evaluator (pr.values). The legacy property() fallback picks a random Select
// item when its input is unavailable, which would silently invent a colour/angle/velocity.
// 5.6 interpolate*/final*: [HYP] linear initial -> final over age/lifeTime. A final value the evaluator cannot resolve is ignored
// (never zeroed) and listed in item.xmlIgnoredValues so the fidelity badge can say so.
export const INTERPOLATION_EASING="linear";
const lerp=(a,b,u)=>a+(b-a)*u;
const finiteList=v=>Array.isArray(v)&&v.length&&v.every(x=>Number.isFinite(Number(x)))?v.map(Number):null;
const ignoreValue=(item,system,name,why)=>{(item.xmlIgnoredValues??={})[`${system}.${name}`]=why;};
// 5.8 randomizeInterval: with the flag on, every emission waits a fresh interval in [intervalMin,intervalMax], drawn from the RUN's
// seeded RNG (so replay is deterministic). Emission e happens at the sum of the first e intervals.
const MAX_RANDOM_EMISSIONS=20000;
function emissionClock(entry,item,name,interval,range) {
  if(!range)return {at:e=>e*interval,indexAt:t=>Math.floor(t/interval)};
  const [lo,hi]=range,rng=makeRng(((item.id*2654435761)^Math.trunc(entry.startMs??0)^[...name].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7))>>>0);
  const times=[0],grow=()=>times.push(times[times.length-1]+Math.max(.016,lo+(hi-lo)*rng()));
  const upToCount=e=>{while(times.length<=e&&times.length<MAX_RANDOM_EMISSIONS)grow();};
  const upToTime=t=>{while(times[times.length-1]<=t&&times.length<MAX_RANDOM_EMISSIONS)grow();};
  return {at:e=>{upToCount(e);return times[Math.min(e,times.length-1)];},
    indexAt:t=>{upToTime(t);let i=0;while(i+1<times.length&&times[i+1]<=t)i++;return i;}};
}
// 5.6 RGB: the shipped XML spells it "initalRGB" (sic); "initialRGB" is accepted too. Values are 0..1 floats, the draw list tints 0..255.
export const RGB_INITIAL_KEYS=["initalRGB","initialRGB"];
const toTint=rgb=>rgb.slice(0,3).map(v=>Math.round(Math.min(1,Math.max(0,v))*255));
// 5.5 isBackgroundParticle: true draws the particle in the first pass, behind the whole player, instead of the item's own pass.
export const BACKGROUND_PARTICLE_PASS="RenderBehind";
// 5.3 Facing. The whole player (every draw call) is already mirrored by the rig's facing matrix when facing<0, so a particle is
// "player-facing" (mirrored once) by default. A flag set to false must therefore counter-mirror, which keeps the NET effect at
// one mirror for true and none for false. Absent flags keep the existing behaviour (mirrored with the player). [HYP]
export const USE_PLAYER_FACING_DEFAULT=true,OFFSET_FACING_DEFAULT=true;
function particlesFor(renderer,entry,timeMs,motion,item,states) {
  const sys=renderer.particles.find(n=>n.a.name===entry.node.a.name);if(!sys)return [];
  const em=first(sys,"Emitter"),pt=first(sys,"Particle");if(!em||!pt)return [];
  const get=(n,key,fallback,seed=1,t=0)=>property(value(n,key),motion,t,seed)??fallback;
  if(!truth(get(em,"enable","true")))return [];
  const intervalNode=value(em,"emissionInterval");
  const interval=Math.max(.016,intervalNode?Number(get(em,"emissionInterval",[.2])[0]):
    (Number(get(em,"intervalMin",[.2])[0])+Number(get(em,"intervalMax",[.2])[0]))/2);
  // 5.8 randomizeInterval
  let range=null;
  if(truth(get(em,"randomizeInterval","false"))) {
    const lo=value(em,"intervalMin")&&Number(get(em,"intervalMin",[.2])[0]),hi=value(em,"intervalMax")&&Number(get(em,"intervalMax",[.2])[0]);
    if(Number.isFinite(lo)&&Number.isFinite(hi)&&value(em,"intervalMin")&&value(em,"intervalMax"))range=[Math.min(lo,hi),Math.max(lo,hi)];
    else ignoreValue(item,sys.a.name,"randomizeInterval","intervalMin/intervalMax missing");
  }
  const count=Math.max(0,Math.min(32,Math.trunc(Number(get(em,"particlesPerEmission",[1])[0]))));
  if(!count)return [];
  const lifetime=Math.max(.016,Number(get(pt,"lifeTime",[1])[0]));
  const delay=Math.max(0,Number(get(em,"delayTimer",[0])[0]));
  const now=(timeMs-(entry.startMs??0))/1000-delay,facingLeft=motion.facing<0;
  const authoredOffset=get(em,"offset",[0,0]);
  // 5.3 Emitter.offsetFacing=false: the emitter offset does not follow the player's facing -> cancel the rig mirror on x.
  const offset=facingLeft&&!truth(get(em,"offsetFacing",String(OFFSET_FACING_DEFAULT)))?[-authoredOffset[0],...authoredOffset.slice(1)]:authoredOffset;
  if(now<0)return [];
  const authoredTotal=Math.max(0,Math.trunc(Number(get(em,"particlesToEmit",[count])[0])));
  const total=truth(get(em,"infParticles","true"))?Infinity:
    authoredTotal||(!truth(get(em,"checkParticleNumToEmit","true"))?count:0);
  const emissionLife=truth(get(em,"infLifeTime","true"))?Infinity:
    Math.max(0,Number(get(em,"lifeTime",[0])[0]));
  const stop=entry.stopMs===undefined?Infinity:(entry.stopMs-entry.startMs)/1000-delay;
  const emissionEnd=Math.min(now,stop,emissionLife);
  if(emissionEnd<0)return [];
  // Deterministic replay within a bounded run avoids duplicate repaint births.
  const clock=emissionClock(entry,item,sys.a.name,interval,range),T=clock.at;
  const out=[],last=Math.min(clock.indexAt(emissionEnd),Math.ceil(total/count)-1);
  const firstIndex=Math.max(0,last-96,clock.indexAt(now-lifetime));
  for(let emission=firstIndex;emission<=last;emission++)for(let k=0;k<count;k++) {
    if(emission*count+k>=total)break;
    const seed=(emission*31+k*17+item.id)>>>0,age=now-T(emission);
    const life=Math.max(.016,Number(get(pt,"lifeTime",[1],seed)[0]));
    if(age<0||age>=life)continue;
    const name=get(pt,"sprite","",seed),spriteName=Array.isArray(name)?name[0]:name;
    // Native operators (RandomRadial, Multiply, Increment, Select-by-input, ...) come from xml-expr.mjs. A property it cannot
    // resolve is reported in item.xmlUnsupportedParticleExpressions (with reason) and the particle is skipped - never zeroed.
    const pr=resolveProperties(pt,{rng:makeRng(seed),t:0,
      inputs:{particleIndex:emission*count+k,particleCounter:emission*count+k,punchCount:punchCountAt(entry,(entry.startMs??0)+(delay+T(emission))*1000),intervalMS:(range?T(emission+1)-T(emission):interval)*1000},
      env:{lifeTime:life}});
    const interpolateVelocity=truth(get(pt,"interpolateVelocity","false",seed));
    // finalVelocity only changes the path when interpolateVelocity is on; then it is required like initialVelocity.
    const needed=pr.unsupported.filter(u=>["offset","initialVelocity",...(interpolateVelocity?["finalVelocity"]:[])].includes(u.name));
    if(needed.length){
      item.xmlUnsupportedParticleExpressions??=new Set();item.xmlUnsupportedParticleExpressions.add(sys.a.name);
      (item.xmlUnsupportedReasons??={})[sys.a.name]=needed.map(u=>`${u.name}: ${u.reason}`);continue;
    }
    // 5.3 usePlayerFacing=false: this particle ignores the player's facing -> cancel the rig mirror on its offset, velocity, gravity and sprite.
    const unmirror=facingLeft&&!truth(pt.a.usePlayerFacing??String(USE_PLAYER_FACING_DEFAULT));
    const fx=v=>unmirror?[-v[0],...v.slice(1)]:v;
    const delta=fx(pr.values.get("offset")??get(pt,"offset",[0,0],seed)),ownVelocity=fx(pr.values.get("initialVelocity")??get(pt,"initialVelocity",[0,0],seed));
    // 5.9 velocityRelativeToPlayerSpeed: add the player's velocity at spawn to the particle's initial velocity. It is a WORLD vector, and
    // the rig mirrors facing=-1 draw calls, so x is negated in player space to come out right after that mirror.
    const spawnMs=(entry.startMs??0)+(delay+T(emission))*1000,[speedX,speedY]=playerSpeedAt(entry,spawnMs);
    const playerVector=[facingLeft?-speedX:speedX,speedY];
    const velocity=truth(pt.a.velocityRelativeToPlayerSpeed??"false")?[(ownVelocity[0]??0)+playerVector[0],(ownVelocity[1]??0)+playerVector[1]]:ownVelocity;
    const gravity=truth(get(pt,"useGravity","false"))?fx(get(pt,"gravityVector",[0,0],seed)):[0,0];
    // 5.6 interpolateVelocity + finalVelocity: v(a)=lerp(v0,vF,a/life), so travel(a)=v0*a+(vF-v0)*a^2/(2*life) per axis.
    const authoredFinal=interpolateVelocity?pr.values.get("finalVelocity"):null;
    const finalVelocity=authoredFinal?finiteList(fx(authoredFinal)):null;
    if(interpolateVelocity&&!finalVelocity)ignoreValue(item,sys.a.name,"finalVelocity",authoredFinal?"not numeric":"missing");
    const accel=[0,1].map(i=>finalVelocity?((finalVelocity[i]??0)-(velocity[i]??0))/life:0);   // d(velocity)/d(age) from interpolation
    const velocityAt=(i,a)=>(velocity[i]??0)+accel[i]*a+(gravity[i]??0)*a;
    const travel=(i,a)=>(velocity[i]??0)*a+.5*accel[i]*a*a+.5*(gravity[i]??0)*a*a;
    // An unsupported expression is not a valid zero-valued emitter parameter.
    // Skip it instead of injecting NaN transforms into the entire player.
    if(![...offset,...delta,...velocity,...gravity,...(entry.offset??[])].every(Number.isFinite)){
      item.xmlUnsupportedParticleExpressions??=new Set();
      item.xmlUnsupportedParticleExpressions.add(sys.a.name);continue;
    }
    // 5.1 relativeToEmitter: true follows the player; false stays where the emitter was at spawn (player space = spawn - now).
    let anchor=[0,0];
    if(!truth(get(pt,"relativeToEmitter",String(RELATIVE_TO_EMITTER_DEFAULT),seed))) {
      const spawnMs=(entry.startMs??0)+(delay+T(emission))*1000,at=emitterPosAt(entry,spawnMs,[motion.x??0,motion.y??0]);
      anchor=[at[0]-(motion.x??0),at[1]-(motion.y??0)];
    }
    const p=spritePiece(renderer,spriteName,[
      anchor[0]+(entry.offset?.[0]??0)+(offset[0]??0)+(delta[0]??0)+travel(0,age),
      anchor[1]+(entry.offset?.[1]??0)+(offset[1]??0)+(delta[1]??0)+travel(1,age)],entry.pass);if(!p)continue;
    if(truth(get(pt,"isBackgroundParticle","false",seed)))p.pass=BACKGROUND_PARTICLE_PASS;
    // 5.6 initalRGB / interpolateRGB / finalRGB
    const initialKey=RGB_INITIAL_KEYS.find(k=>value(pt,k));
    if(initialKey) {
      const start=finiteList(pr.values.get(initialKey));
      if(!start||start.length<3)ignoreValue(item,sys.a.name,initialKey,"not three numbers (unresolved expression)");
      else {
        let rgb=start;
        if(truth(get(pt,"interpolateRGB","false",seed))) {
          const end=finiteList(pr.values.get("finalRGB"));
          if(end&&end.length>=3)rgb=start.map((v,i)=>lerp(v,end[i],age/life));
          else ignoreValue(item,sys.a.name,"finalRGB",end?"not three numbers":"missing or unresolved");
        }
        if(rgb.slice(0,3).some(v=>v!==1))p.t=toTint(rgb);
      }
    }
    const alignment=String(get(pt,"renderAlignment","CENTER",seed));
    if(RENDER_ALIGNMENT[alignment])[p.ax,p.ay]=RENDER_ALIGNMENT[alignment];
    else (item.xmlUnsupportedValues??={})[`${sys.a.name}.renderAlignment`]=alignment;
    const alpha=get(pt,"initialAlpha",[1],seed,age/life);
    // 5.6 interpolateAlpha + finalAlpha
    if(truth(get(pt,"interpolateAlpha","false",seed))) {
      const end=finiteList(pr.values.get("finalAlpha")),start=finiteList(get(pt,"initialAlpha",[1],seed,0));
      if(end&&start)alpha[0]=lerp(start[0],end[0],age/life);
      else ignoreValue(item,sys.a.name,"finalAlpha",end?"initialAlpha unresolved":"finalAlpha missing or unresolved");
    }
    const initial=get(pt,"initialScale",[1,1],seed,age/life);
    p.o=alpha[0];p.k=[initial[0],initial[1]??initial[0]];
    if(truth(get(pt,"flipX","false",seed))!==unmirror)p.k[0]*=-1;
    if(truth(get(pt,"flipY","false",seed)))p.k[1]*=-1;
    const final=get(pt,"finalScale",null,seed);
    if(final&&truth(get(pt,"interpolateScale","false")))p.k=p.k.map((v,i)=>v+((final[i]??final[0])-v)*age/life);
    // An angle/rate the runtime cannot resolve (source="boomerangAngle", a Curve rate, ...) must not poison the matrix with NaN:
    // use 0 and say so in item.xmlIgnoredValues.
    const rawAngle=Number(get(pt,"initialAngle",[0],seed)[0]),rawRate=Number(get(pt,"initialRotationRate",[0],seed)[0]);
    if(!Number.isFinite(rawAngle))ignoreValue(item,sys.a.name,"initialAngle","value comes from an unsupported source or expression");
    if(!Number.isFinite(rawRate))ignoreValue(item,sys.a.name,"initialRotationRate","unsupported expression (Curve/source)");
    const angle0=Number.isFinite(rawAngle)?rawAngle:0,rate0=Number.isFinite(rawRate)?rawRate:0;
    p.r=angle0+rate0*age;
    // 5.6 interpolateAngle + finalAngle: [HYP] angle = lerp(initialAngle, finalAngle, age/life), still plus the constant rotation rate.
    if(truth(get(pt,"interpolateAngle","false",seed))) {
      const end=finiteList(pr.values.get("finalAngle"));
      if(end)p.r=lerp(angle0,end[0],age/life)+rate0*age;
      else ignoreValue(item,sys.a.name,"finalAngle","finalAngle missing or unresolved");
    }
    // 5.9 angleRelativeToPlayerSpeed [HYP]: the base angle is turned by the heading of the player's velocity at spawn (same piece-space
    // vector as above, so it reads correctly after the rig mirror). A player standing still has no heading, so no rotation.
    if(truth(pt.a.angleRelativeToPlayerSpeed??"false")&&(playerVector[0]||playerVector[1]))
      p.r+=Math.atan2(playerVector[1],playerVector[0])*180/Math.PI;
    // 5.2 rotateWithVelocity [HYP]: sprite art points along +x, so heading = atan2(vy,vx) in degrees, from the instantaneous velocity.
    if(truth(get(pt,"rotateWithVelocity","false",seed))) {
      const vx=velocityAt(0,age),vy=velocityAt(1,age);
      if(vx||vy)p.r+=Math.atan2(vy,vx)*180/Math.PI;
    }
    p.xmlSprite=spriteName;p.xmlParticle=true;p.xmlParticleAge=age*1000;p.xmlSystem=sys.a.name;
    p.add=get(pt,"blendingMode","")==="ADDITIVE";
    const track=renderer.animations.find(n=>n.tag==="SpriteAnimation"&&n.a.sprite===spriteName);
    // 5.7 sprite frame choice. randomSpriteFrame picks a frame from the sprite's animation track; [HYP] inSpecificOrder=true makes
    // that pick cycle in emission order (particleIndex % frameCount) instead of random (seed % frameCount, the previous behaviour).
    const frames=track?children(track,"Frame"):[];
    let pick=null;
    const particleIndex=emission*count+k;
    if(frames.length&&truth(pt.a.randomSpriteFrame))
      pick=truth(get(pt,"inSpecificOrder","false",seed))?particleIndex%frames.length:seed%frames.length;
    // alternateSpriteFrameWithPunch [HYP]: frame parity follows the number of punches the item had when the particle was born.
    // Precedence: particleIndexSpriteFrame > alternateSpriteFrameWithPunch > randomSpriteFrame.
    if(frames.length&&truth(pt.a.alternateSpriteFrameWithPunch))
      pick=(punchCountAt(entry,(entry.startMs??0)+(delay+T(emission))*1000)%2)%frames.length;
    // particleIndexSpriteFrame: the frame IS the particle's emission index (wrapping), and outranks the random pick.
    if(frames.length&&truth(pt.a.particleIndexSpriteFrame))pick=particleIndex%frames.length;
    if(pick!==null) {
      const cell=numbers(frames[pick].v);
      p.sx=cell[0]*p.sw;p.sy=cell[1]*p.sh;p.xmlSprite=null;p.xmlFrameIndex=pick;
    }
    out.push(p);
    if(out.length>=256)return out;
  }
  return out;
}
// Every run owns its emitter state and a short history of the emitter's (player's) position. The history is what lets a
// stateless seed-replay know where the emitter WAS when a given particle was born (flags that freeze or inherit spawn state).
const TRAIL_LIMIT=720;
const newRun=(entry,timeMs,extra={})=>({...entry,...extra,startMs:timeMs,emitter:{running:true,emitted:0,delayMs:0},trail:[]});
export function emitterPosAt(run,ms,fallback=[0,0]) {
  const trail=run.trail??[];if(!trail.length)return fallback;
  let best=trail[0];
  for(const point of trail){if(point[0]>ms)break;best=point;}
  return [best[1],best[2]];
}
// The player's velocity vector (world axes, +x right, +y down) when a given moment happened.
export function playerSpeedAt(run,ms) {
  const trail=run.trail??[];let best=trail[0];
  for(const point of trail){if(point[0]>ms)break;best=point;}
  return [best?.[4]??0,best?.[5]??0];
}
// The punch count the item had when a given moment happened (last trail sample at or before it).
export function punchCountAt(run,ms) {
  const trail=run.trail??[];let best=trail[0];
  for(const point of trail){if(point[0]>ms)break;best=point;}
  return best?.[3]??0;
}
export function unequipXmlItem(item,timeMs,motion={}) {
  const renderer=item.renderer;
  if(!renderer?.particles?.length||item.xmlSwitchOffAt!==undefined)return false;
  const states=item.xmlStates??{},rules=visibleRules(renderer,motion,states,{unequip:true,onlyHook:"SwitchOffClothingParticles"});
  for(const stop of rules.stops??[])
    for(const run of item.xmlParticleRuns??[])
      if(run.node.a.name===stop.name&&(run.stopMs===undefined||run.stopMs>timeMs))resetEmitter(run,timeMs);
  item.xmlSwitchOffAt=timeMs;item.xmlSwitchOffCount=(item.xmlSwitchOffCount??0)+1;
  return true;
}
// Equipping (again) re-arms SwitchOff and starts the item's particles from scratch.
export function equipXmlItem(item) {
  delete item.xmlSwitchOffAt;item.xmlParticleRuns=[];item.xmlParticleTime=0;
}
function resetEmitter(run,timeMs) {
  run.stopMs=timeMs;
  run.emitter={running:false,emitted:0,delayMs:0};
}
function particleRuns(renderer,rules,timeMs,motion,item,states) {
  if(timeMs<(item.xmlParticleTime??0)){item.xmlParticleRuns=[];item.xmlPunchIds=new Set();item.xmlPunchCount=0;}
  item.xmlParticleTime=timeMs;
  // The planner's motion has no punch counter, so the item counts the distinct punch events it has seen.
  const punchIds=item.xmlPunchIds??=new Set();
  for(const e of motion.events??[])if(e.type==="punch"&&!punchIds.has(e.id)){punchIds.add(e.id);item.xmlPunchCount=(item.xmlPunchCount??0)+1;}
  const punchCount=motion.punchCount??item.xmlPunchCount??0;
  const current=new Map(rules.filter(e=>e.node.tag.startsWith("ParticleSystem")&&
    particleEntryActive(renderer,e,states,motion)).map(e=>[e.node.a.name,e]));
  // Systems with no Update/Render rule start from their own stage attributes. Systems governed by a rule keep the rule;
  // secondary systems and OnFinish children are started only by their parent (step 6), never from here.
  for(const s of triggersOf(renderer).systems) {
    if(current.has(s.name)||s.secondary||s.onFinish.length||s.rule.some(r=>r.kind!=="Off"))continue;
    if(!s.stage.updateStage&&!s.stage.updateState&&!s.stage.renderStage)continue;
    const why=stageActive(s.stage,motion);
    if(why.unresolved){(item.xmlUnresolvedEvents??={})[s.name]=why.unresolved;continue;}
    if(why.on)current.set(s.name,{node:{tag:"ParticleSystemUpdate",a:{name:s.name}},pass:passFor(s.stage.renderStage),offset:[0,0],
      pulse:why.pulse?(motion.events??[]).find(e=>e.type===why.pulse)?.id:undefined});
  }
  const runs=item.xmlParticleRuns??=[];
  // ParticleSystemOff (PARTICLE_OFF): end the running emitter now and clear its state. The next Update opens a fresh run, so its
  // emitted count starts at 0 and its delay timer restarts. Particles already alive finish their own lifetime.
  for(const stop of rules.stops??[]) {
    if(!PARTICLE_OFF.stopsEmission||!actionActive(stop.onAction,motion))continue;
    if(PARTICLE_OFF.winsSameFrame)current.delete(stop.name);
    for(const run of runs)
      if(run.node.a.name===stop.name&&(run.stopMs===undefined||run.stopMs>timeMs))resetEmitter(run,timeMs);
  }
  for(const run of runs)
    if(run.stopMs===undefined&&!current.has(run.node.a.name))run.stopMs=timeMs;
  for(const [name,entry] of current) {
    const ongoing=runs.find(r=>r.node.a.name===name&&r.stopMs===undefined);
    const trigger=walk(renderer.rules).some(n=>n.tag==="ParticleSystemUpdate"&&n.a.name===name&&n.a.onAction);
    const stamp=entry.pulse?entry.pulse:
      trigger?(motion.events??[]).find(e=>["punch","jump","doubleJump"].includes(e.type))?.id:undefined;
    if(entry.pulse) {
      // One-shot start: the run lasts one frame plus the emitter's own delay, then existing particles finish their life.
      if(runs.some(r=>r.node.a.name===name&&r.pulseStamp===stamp))continue;
      runs.push(newRun(entry,timeMs,{stamp,pulseStamp:stamp,stopMs:timeMs+16+emitterDelayMs(renderer,name)}));continue;
    }
    if(ongoing&&stamp!==undefined&&ongoing.stamp!==stamp)ongoing.stopMs=timeMs;
    if(!ongoing||ongoing.stopMs!==undefined)runs.push(newRun(entry,timeMs,{stamp}));
    else {ongoing.offset=entry.offset;ongoing.pass=entry.pass;}
  }
  for(const run of runs) {
    if(run.stopMs!==undefined&&run.stopMs<=timeMs&&run.trail.length)continue;
    run.trail.push([timeMs,motion.x??0,motion.y??0,punchCount,variable("speed.x",motion)??0,variable("speed.y",motion)??0]);
    if(run.trail.length>TRAIL_LIMIT)run.trail.shift();
  }
  // Retain finite-life particles across action changes. Native world-position
  // capture and systems living beyond this bounded window remain partial.
  item.xmlParticleRuns=runs.filter(r=>r.stopMs===undefined||timeMs-r.stopMs<10000).slice(-128);
  return item.xmlParticleRuns.flatMap(r=>particlesFor(renderer,r,timeMs,motion,item,states));
}
export function advanceXmlRenderer(item,timeMs,motion) {
  const renderer=item.renderer;if(!renderer)return;
  const states=updateMachines(renderer,item,timeMs,motion);
  const punching=!!motion.punch,ctx={punchEnd:item.xmlWasPunching&&!punching?`punchEnd:${timeMs}`:null};
  item.xmlWasPunching=punching;
  if(AURA_RULES.has(item.raw.script)) {
    const rules=visibleRules(renderer,motion,states,ctx);item.pieces=[];
    for(const e of rules) {
      if(e.node.tag.startsWith("ParticleSystem"))continue;
      const offset=numbers(e.node.a.offset??"0,0").map((v,i)=>v+(e.offset?.[i]??0));
      const p=spritePiece(renderer,e.node.a.name,offset,e.pass);
      if(p){
        if((e.node.a.alignment??"").startsWith("DOWN"))p.ay=1;
        spriteProperties(p,e.node,motion,timeMs/1000);item.pieces.push(p);
      }
    }
    const noFacing=walk(renderer.rules).some(n=>n.tag==="ContextUpdate"&&n.a.type==="SetFlip"&&
      children(n,"Set").some(c=>c.a.name==="flip"&&c.v==="false"));
    if(noFacing)for(const p of item.pieces)p.noFacing=true;
  }
  if(renderer.particles?.length)
    item.pieces.push(...particleRuns(renderer,visibleRules(renderer,motion,states,ctx),timeMs,motion,item,states));
  for(const p of item.pieces) {
    if(!p.xmlSprite)continue;
    const spriteStates=p.xmlParticle?
      Object.fromEntries(Object.entries(states).map(([key,state])=>[key,{...state,since:0}])):states;
    const spriteTime=p.xmlParticleAge??timeMs;
    const frame=sampleSpriteFrame(renderer,p.xmlSprite,spriteTime,spriteStates,motion);
    if(frame){p.sx=frame.cell[0]*p.sw;p.sy=frame.cell[1]*p.sh;p.xmlTrack=frame.track;}
    for(const track of renderer.animations.filter(n=>n.a.sprite===p.xmlSprite&&active(n.a,states,motion))) {
      const state=track.a.playOnState?.split(".")[0],elapsed=Math.max(0,spriteTime-(spriteStates[state]?.since??0));
      const duration=Number(track.a.animTime)||1000;
      const t=(truth(track.a.isLoop)?elapsed%duration:Math.min(elapsed,duration))/1000;
      const scale=value(track,"scale"),pos=value(track,"offset");
      if(track.tag==="SpriteScaleAnimation"&&scale)p.k=property(scale,motion,t);
      if(track.tag==="SpritePositionAnimation"&&pos) {
        const current=property(pos,motion,t),initial=property(pos,motion,0);
        if(current&&initial){p.x+=current[0]-initial[0];p.y+=(current[1]??0)-(initial[1]??0);}
      }
    }
  }
  item.animationState.xmlStates=Object.fromEntries(Object.entries(states).map(([k,v])=>[k,v.state]));
  item.animationState.xmlBoundCount=item.xmlBoundCount;
}
