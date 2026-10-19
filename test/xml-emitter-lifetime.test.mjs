import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
import {condition} from "../src/xml-renderer.mjs";
const n=(tag,a={},v="",c=[])=>({tag,a,v,c});
const set=(name,v)=>n("Set",{name},String(v));
function fixture({delay=0,total=2,count=1,enabled=true,gravity=false,punchOnly=false,action,animate=false}={}) {
  const emitter=n("Emitter",{},"",[
    set("enable",enabled),set("emissionInterval",.1),set("delayTimer",delay),
    set("infParticles",false),set("particlesToEmit",total),set("particlesPerEmission",count),
    set("infLifeTime",true)
  ]);
  const particle=n("Particle",{},"",[
    set("sprite","p"),set("lifeTime",.4),set("useGravity",gravity),set("gravityVector","0,100"),
    set("initialVelocity","0,0"),set("blendingMode","ADDITIVE")
  ]);
  const rules=[...(punchOnly?[n("StopIf",{},"",[n("IsVariableBool",{name:"punching"},"false")])]:[]),
    n("ParticleSystemUpdate",{name:"ps",...(action?{onAction:action}:{})}),n("ParticleSystemRender",{name:"ps"})];
  const renderer={sprites:{p:{atlas:"fx.png",textureSize:"32",frame:"0,0"}},
    animations:animate?[n("SpriteAnimation",{sprite:"p",name:"frames",isLoop:"true",animTime:"400",playOnState:"Action.Playing"},"",
      [0,1,2,3].map(x=>n("Frame",{},`${x},0`)))]:[],
    machines:animate?[n("StateMachine",{name:"Action"},"",[n("States",{},"",[n("State",{name:"Playing"})])])]:[],
    options:{},particles:[n("ParticleSystem",{name:"ps"},"",[emitter,particle])],
    rules:n("RenderRules",{},"",[n("RenderInFront",{},"",rules)])};
  const item=normalizeCatalogItem({id:1,name:"Test",slot:9,script:"Test",gameIcon:[]},{renderers:{Test:renderer}});
  return (time,punch=false,events=[])=>{
    advanceCatalogItem(item,time,{clockMs:time,moveMs:0,x:0,y:0,vx:0,vy:0,facing:1,
      ground:true,locomotion:"idle",punch:punch?{ageMs:50}:null,events});
    return item.pieces.filter(p=>p.xmlParticle);
  };
}
test("finite XML emitter counts particles, not unbounded replay",()=>{
  const step=fixture({total:3,count:2});
  assert.equal(step(0).length,2);assert.equal(step(150).length,3);assert.equal(step(800).length,0);
});
test("XML emitter delays are relative to activation, not global uptime",()=>{
  const step=fixture({total:1,delay:.2});
  assert.equal(step(5000).length,0);assert.equal(step(5100).length,0);assert.equal(step(5250).length,1);
});
test("native particles live through the end of a punch and expire",()=>{
  const step=fixture({total:1,punchOnly:true});
  assert.equal(step(1000).length,0);assert.equal(step(2000,true).length,1);
  assert.equal(step(2050,false).length,1);assert.equal(step(2500,false).length,0);
});
test("native enable, gravity and additive properties are respected",()=>{
  assert.equal(fixture({enabled:false})(0).length,0);
  const step=fixture({total:1,gravity:true});const start=step(0)[0],later=step(100)[0];
  assert.ok(Math.abs(later.y-start.y-.5)<.001);assert.equal(later.add,true);
});
test("native double-jump emitters require the actual air-jump event",()=>{
  const step=fixture({total:1,action:"JUMPDOUBLE"});
  assert.equal(step(0).length,0);assert.equal(step(100).length,0);
  assert.equal(step(200,false,[{id:"second",type:"doubleJump"}]).length,1);
  assert.equal(step(250,false).length,1);assert.equal(step(800,false).length,0);
});
test("repeated punch events restart a finite native burst while held",()=>{
  const step=fixture({total:1,action:"PUNCH"});
  assert.equal(step(0,true,[{id:"p1",type:"punch"}]).length,1);
  assert.equal(step(280,true,[{id:"p2",type:"punch"}]).length,2);
  assert.equal(step(900,false).length,0);
});
test("native context predicates distinguish normal/mini render and unknown conditions",()=>{
  const mini=n("IsRenderMod",{},"RENDER_MOD_MINI_YOU");
  assert.equal(condition(mini,{ground:true},{}),false);
  assert.equal(condition(mini,{ground:true,renderContext:{renderMods:["RENDER_MOD_MINI_YOU"]}},{}),true);
  assert.equal(condition(n("UnsupportedNativePredicate"),{},{}),undefined);
  assert.equal(condition(n("IsVariableBool",{name:"unknown"},"false"),{},{}),undefined);
});
test("state-bound particle clips animate by their age after late-session equipment",()=>{
  const step=fixture({total:1,animate:true});
  assert.equal(step(5000)[0].sx,0);assert.equal(step(5250)[0].sx,64);
});
