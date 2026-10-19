// Inert XML IR interpreter. Only the operations implemented here execute.
// Unknown conditions fail closed. Parsing a script is NOT complete support.
import {locomotionState} from "./motion-policy.mjs";
import {PLANNER_PROFILE} from "./planner-profile.mjs";
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
    return id===undefined?undefined:(context.equippedIds??[]).includes(id);
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
function visibleRules(renderer,motion,states) {
  const output=[];
  function visit(nodes,pass,offset=[0,0]) {
    let position=offset.slice();
    for(const n of nodes) {
      if(n.tag==="StopIf"){
        const decision=condition(n,motion,states);
        if(decision===true||decision===undefined)break;
      }
      if(n.a?.onState&&!n.a.onState.split("|").some(s=>{const [m,v]=s.split(".");return states[m]?.state===v;}))continue;
      if(n.tag==="Group"){visit(children(n),pass,position);continue;}
      if(n.tag==="Translate"){const v=numbers(n.v);position=[position[0]+(v[0]??0),position[1]+(v[1]??0)];continue;}
      if(["SpriteRender","ParticleSystemRender","ParticleSystemUpdate"].includes(n.tag))
        output.push({node:n,pass:PLANNER_PROFILE.passOrder.includes(pass)?pass:"PARTICLES",offset:position.slice()});
    }
  }
  for(const hook of children(renderer.rules))visit(children(hook),hook.tag);
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
function particlesFor(renderer,entry,timeMs,motion,item,states) {
  const sys=renderer.particles.find(n=>n.a.name===entry.node.a.name);if(!sys)return [];
  const em=first(sys,"Emitter"),pt=first(sys,"Particle");if(!em||!pt)return [];
  const get=(n,key,fallback,seed=1,t=0)=>property(value(n,key),motion,t,seed)??fallback;
  if(!truth(get(em,"enable","true")))return [];
  const intervalNode=value(em,"emissionInterval");
  const interval=Math.max(.016,intervalNode?Number(get(em,"emissionInterval",[.2])[0]):
    (Number(get(em,"intervalMin",[.2])[0])+Number(get(em,"intervalMax",[.2])[0]))/2);
  const count=Math.max(0,Math.min(32,Math.trunc(Number(get(em,"particlesPerEmission",[1])[0]))));
  if(!count)return [];
  const lifetime=Math.max(.016,Number(get(pt,"lifeTime",[1])[0]));
  const delay=Math.max(0,Number(get(em,"delayTimer",[0])[0]));
  const now=(timeMs-(entry.startMs??0))/1000-delay,offset=get(em,"offset",[0,0]);
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
  const out=[],last=Math.min(Math.floor(emissionEnd/interval),Math.ceil(total/count)-1);
  const firstIndex=Math.max(0,last-96,Math.floor((now-lifetime)/interval));
  for(let emission=firstIndex;emission<=last;emission++)for(let k=0;k<count;k++) {
    if(emission*count+k>=total)break;
    const seed=(emission*31+k*17+item.id)>>>0,age=now-emission*interval;
    const life=Math.max(.016,Number(get(pt,"lifeTime",[1],seed)[0]));
    if(age<0||age>=life)continue;
    const name=get(pt,"sprite","",seed),spriteName=Array.isArray(name)?name[0]:name;
    const delta=get(pt,"offset",[0,0],seed),velocity=get(pt,"initialVelocity",[0,0],seed);
    const gravity=truth(get(pt,"useGravity","false"))?get(pt,"gravityVector",[0,0],seed):[0,0];
    // An unsupported expression is not a valid zero-valued emitter parameter.
    // Skip it instead of injecting NaN transforms into the entire player.
    if(![...offset,...delta,...velocity,...gravity,...(entry.offset??[])].every(Number.isFinite)){
      item.xmlUnsupportedParticleExpressions??=new Set();
      item.xmlUnsupportedParticleExpressions.add(sys.a.name);continue;
    }
    const p=spritePiece(renderer,spriteName,[
      (entry.offset?.[0]??0)+(offset[0]??0)+(delta[0]??0)+(velocity[0]??0)*age+.5*(gravity[0]??0)*age*age,
      (entry.offset?.[1]??0)+(offset[1]??0)+(delta[1]??0)+(velocity[1]??0)*age+.5*(gravity[1]??0)*age*age],entry.pass);if(!p)continue;
    const alpha=get(pt,"initialAlpha",[1],seed,age/life);
    const initial=get(pt,"initialScale",[1,1],seed,age/life);
    p.o=alpha[0];p.k=[initial[0],initial[1]??initial[0]];
    if(truth(get(pt,"flipX","false",seed)))p.k[0]*=-1;
    if(truth(get(pt,"flipY","false",seed)))p.k[1]*=-1;
    const final=get(pt,"finalScale",null,seed);
    if(final&&truth(get(pt,"interpolateScale","false")))p.k=p.k.map((v,i)=>v+((final[i]??final[0])-v)*age/life);
    p.r=Number(get(pt,"initialAngle",[0],seed)[0])+Number(get(pt,"initialRotationRate",[0],seed)[0])*age;
    p.xmlSprite=spriteName;p.xmlParticle=true;p.xmlParticleAge=age*1000;
    p.add=get(pt,"blendingMode","")==="ADDITIVE";
    const track=renderer.animations.find(n=>n.tag==="SpriteAnimation"&&n.a.sprite===spriteName);
    if(truth(pt.a.randomSpriteFrame)&&track) {
      const frames=children(track,"Frame");
      if(frames.length){const cell=numbers(frames[seed%frames.length].v);
        p.sx=cell[0]*p.sw;p.sy=cell[1]*p.sh;p.xmlSprite=null;}
    }
    out.push(p);
    if(out.length>=256)return out;
  }
  return out;
}
function particleRuns(renderer,rules,timeMs,motion,item,states) {
  if(timeMs<(item.xmlParticleTime??0))item.xmlParticleRuns=[];
  item.xmlParticleTime=timeMs;
  const current=new Map(rules.filter(e=>e.node.tag.startsWith("ParticleSystem")&&
    particleEntryActive(renderer,e,states,motion)).map(e=>[e.node.a.name,e]));
  const runs=item.xmlParticleRuns??=[];
  for(const run of runs)
    if(run.stopMs===undefined&&!current.has(run.node.a.name))run.stopMs=timeMs;
  for(const [name,entry] of current) {
    const ongoing=runs.find(r=>r.node.a.name===name&&r.stopMs===undefined);
    const trigger=walk(renderer.rules).some(n=>n.tag==="ParticleSystemUpdate"&&n.a.name===name&&n.a.onAction);
    const stamp=trigger?(motion.events??[]).find(e=>["punch","jump","doubleJump"].includes(e.type))?.id:undefined;
    if(ongoing&&stamp!==undefined&&ongoing.stamp!==stamp)ongoing.stopMs=timeMs;
    if(!ongoing||ongoing.stopMs!==undefined)runs.push({...entry,startMs:timeMs,stamp});
    else {ongoing.offset=entry.offset;ongoing.pass=entry.pass;}
  }
  // Retain finite-life particles across action changes. Native world-position
  // capture and systems living beyond this bounded window remain partial.
  item.xmlParticleRuns=runs.filter(r=>r.stopMs===undefined||timeMs-r.stopMs<10000).slice(-128);
  return item.xmlParticleRuns.flatMap(r=>particlesFor(renderer,r,timeMs,motion,item,states));
}
export function advanceXmlRenderer(item,timeMs,motion) {
  const renderer=item.renderer;if(!renderer)return;
  const states=updateMachines(renderer,item,timeMs,motion);
  if(AURA_RULES.has(item.raw.script)) {
    const rules=visibleRules(renderer,motion,states);item.pieces=[];
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
    item.pieces.push(...particleRuns(renderer,visibleRules(renderer,motion,states),timeMs,motion,item,states));
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
