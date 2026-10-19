import { point } from "./math.mjs";

function random(seed) {
  let s=seed>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}
// Per-item descriptors specify trigger, lifetime, source, velocity and anchor.
// Effects must be supplied from authorized data; an FX flag alone is not an emitter.
export class EffectSystem {
  constructor(seed=1,maxParticles=2000) {
    this.rng=random(seed);this.maxParticles=maxParticles;this.particles=[];this.seen=new Set();
  }
  trigger(emitter,event,anchor) {
    const key=`${emitter.id}:${event.id}`;
    if(this.seen.has(key)) return;
    this.seen.add(key);
    if(this.seen.size>10000) throw Error("Restore/restart bounded FX checkpoint");
    const count=emitter.count??1;
    if(!Number.isInteger(count)||count<0||count>this.maxParticles) throw Error("Invalid emitter count");
    for(let i=0;i<count;i++) {
      const origin=emitter.at??[0,0];
      const spread=emitter.spread??[0,0],v=emitter.velocity??[0,0];
      this.particles.push({
        emitter,ageMs:0,birth:event.at,
        origin:emitter.space==="world"?point(anchor,origin):origin.slice(),
        velocity:[v[0]+(this.rng()-.5)*spread[0],v[1]+(this.rng()-.5)*spread[1]],
        // Captured facing is part of the world-space birth transform.
        facing:event.facing??1
      });
    }
    if(this.particles.length>this.maxParticles) this.particles.splice(0,this.particles.length-this.maxParticles);
  }
  update(dtMs) {
    for(const p of this.particles) p.ageMs+=dtMs;
    this.particles=this.particles.filter(p=>p.ageMs<(p.emitter.lifeMs??500));
  }
  sample(resolveAnchor) {
    return this.particles.map(p=>{
      const t=p.ageMs/1000,g=p.emitter.gravity??0,sign=p.emitter.space==="world"?p.facing:1;
      const xy=[p.origin[0]+sign*p.velocity[0]*t,p.origin[1]+p.velocity[1]*t+0.5*g*t*t];
      return {emitter:p.emitter,alpha:1-p.ageMs/(p.emitter.lifeMs??500),
        world:p.emitter.space==="world"?xy:point(resolveAnchor(p.emitter),xy)};
    });
  }
}
