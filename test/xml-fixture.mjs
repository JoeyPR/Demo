// Synthetic one-system renderer for particle tests. Real-data tests use evidence/renderer-data.json directly.
import {normalizeCatalogItem,advanceCatalogItem} from "../src/catalog-adapter.mjs";
export const n=(tag,a={},v="",c=[])=>({tag,a,v,c});
export const set=(name,v)=>n("Set",{name},String(v));
export const upd=(name="ps")=>[n("ParticleSystemUpdate",{name}),n("ParticleSystemRender",{name})];
export const base=(motion={})=>({clockMs:0,moveMs:0,x:0,y:0,vx:0,vy:0,facing:1,ground:true,locomotion:"idle",punch:null,events:[],...motion});
// opts: emitter:[Set...], particle:[Set...], particleAttrs:{}, emitterAttrs:{}, hooks:[hook nodes], extraSprites:{}
export function fixture({emitter=[],particle=[],particleAttrs={},emitterAttrs={},hooks=[n("AddClothingParticles",{},"",upd())],systemAttrs={},animations=[]}={}) {
  // Defaults are dropped when the test supplies the same property, so a test override always wins.
  const merge=(defaults,extra)=>[...defaults.filter(d=>!extra.some(e=>e.a.name===d.a.name)),...extra];
  const em=n("Emitter",emitterAttrs,"",merge([set("emissionInterval",.1),set("infParticles",true),set("infLifeTime",true),set("particlesPerEmission",1)],emitter));
  const pt=n("Particle",particleAttrs,"",merge([set("sprite","p"),set("lifeTime",1)],particle));
  const renderer={sprites:{p:{atlas:"fx.png",textureSize:"32",frame:"0,0"}},animations,machines:[],options:{},
    particles:[n("ParticleSystem",{name:"ps",...systemAttrs},"",[em,pt])],rules:n("RenderRules",{},"",hooks)};
  const item=normalizeCatalogItem({id:1,name:"T",slot:9,script:"T",gameIcon:[]},{renderers:{T:renderer}});
  const run=(t,m={})=>{advanceCatalogItem(item,t,base({clockMs:t,...m}));return item.pieces.filter(p=>p.xmlParticle);};
  run.item=item;
  // Drive the item through a time range at a fixed step; returns the last frame's particles.
  run.until=(from,to,step=50,m=()=>({}))=>{let out=[];for(let t=from;t<=to;t+=step)out=run(t,m(t));return out;};
  return run;
}
// A SpriteAnimation track for sprite "p" whose frames are the given atlas cells, e.g. frameTrack([[0,0],[1,0],[2,0]]).
export const frameTrack=(cells,sprite="p")=>n("SpriteAnimation",{sprite},"",cells.map(c=>n("Frame",{},c.join(","))));
export const punchEvent=t=>({events:[{type:"punch",id:`punch:${t}`,at:t}],punch:{}});
