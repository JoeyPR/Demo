import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
const n=(tag,a={},v="",c=[])=>({tag,a,v,c});
const set=(name,v)=>n("Set",{name},String(v));
function build(velocityNode,{emitterExtra=[]}={}) {
  const emitter=n("Emitter",{},"",[set("emissionInterval",.1),set("infParticles",true),set("infLifeTime",true),set("particlesPerEmission",3),...emitterExtra]);
  const particle=n("Particle",{},"",[set("sprite","p"),set("lifeTime",1),velocityNode]);
  const renderer={sprites:{p:{atlas:"fx.png",textureSize:"32",frame:"0,0"}},animations:[],machines:[],options:{},
    particles:[n("ParticleSystem",{name:"ps"},"",[emitter,particle])],
    rules:n("RenderRules",{},"",[n("RenderInFront",{},"",[n("ParticleSystemUpdate",{name:"ps"}),n("ParticleSystemRender",{name:"ps"})])])};
  const item=normalizeCatalogItem({id:1,name:"T",slot:9,script:"T",gameIcon:[]},{renderers:{T:renderer}});
  return t=>{advanceCatalogItem(item,t,{clockMs:t,moveMs:0,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[]});return item;};
}
test("RandomRadial initialVelocity is evaluated: particle displacement = speed*age within radiusRange", () => {
  const run=build(n("RandomRadial",{name:"initialVelocity",angleRange:"0,360",radiusRange:"70,80"}));
  run(0); const item=run(450);
  const ps=item.pieces.filter(p=>p.xmlParticle);
  assert.ok(ps.length>=3,"particles emitted");
  for(const p of ps){const age=p.xmlParticleAge/1000,d=Math.hypot(p.x-16,p.y-32);
    assert.ok(d/age>=70-1e-6&&d/age<=80+1e-6,`speed ${d/age}`);}
  assert.equal(item.xmlUnsupportedParticleExpressions?.size??0,0);
});
test("VectorTo without a target is reported with a reason and the particle is skipped (not drawn stationary)", () => {
  const run=build(n("VectorTo",{name:"initialVelocity",source:"targetPos",duration:"lifeTime",x:"1"}));
  run(0); const item=run(450);
  assert.equal(item.pieces.filter(p=>p.xmlParticle).length,0);
  assert.ok(item.xmlUnsupportedParticleExpressions.has("ps"));
  assert.match(item.xmlUnsupportedReasons.ps[0],/targetPos unavailable/);
});
