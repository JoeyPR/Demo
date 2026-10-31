import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from '../src/fx-engine.mjs';
import {integrateParticle} from '../src/particle-state.mjs';
import {PlannerPlayer} from '../src/player.mjs';
import {resolveLook} from '../src/look.mjs';
import {PunchTimeline,resolvePunchCues} from '../src/punch-timeline.mjs';
import {rendererScripts} from '../src/research-data.mjs';
import {buildDrawList,drawCanvas} from '../src/render.mjs';
import {XmlParticleLayer} from '../src/xml-particles.mjs';
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const node=(tag,a={},v='',c=[])=>({tag,a,v:String(v),c});
const sets=values=>Object.entries(values).map(([name,value])=>node('Set',{name},value));
const host={action:'IDLE',facing:1,x:0,y:0,vx:0,vy:0,onGround:true,target:[76,32],events:[]};
function script(emitter={},particle={},stage='Update') {
  return new Script('test',{sprites:{p:{atlas:'particles.png',textureSize:'32',frame:'0,0'}},
    particles:[node('ParticleSystem',{name:'p',updateStage:stage},'',[
      node('Emitter',{},'',sets({infLifeTime:true,infParticles:false,particlesToEmit:3,particlesPerEmission:2,emissionInterval:.1,...emitter})),
      node('Particle',{},'',sets({sprite:'p',lifeTime:10,...particle}))])]},()=>null,7);
}
test('direct and wrapped renderer bundles both reach the active FX engine',()=>{
  const fx=json('../demo/fx-data.json');
  assert.equal(Object.keys(rendererScripts(fx)).length,314);
  assert.deepEqual(rendererScripts({scripts:fx}),rendererScripts(fx));
  assert.deepEqual(rendererScripts(null),{});
});
test('the active emitter emits a finite particle count including a partial final burst',()=>{
  const s=script();for(let i=0;i<40;i++)s.step(.033,host);
  assert.equal(s.systems[0].emitted,3);assert.equal(s.systems[0].live.length,3);
});
test('disabled emitters stay empty and infinite emitters respect their live limit',()=>{
  const disabled=script({enable:false});disabled.step(.1,host);assert.equal(disabled.systems[0].live.length,0);
  const bounded=script({infParticles:true,maxParticleInstanceAtOnce:4,emissionInterval:.01});
  for(let i=0;i<50;i++)bounded.step(.033,host);
  assert.equal(bounded.systems[0].live.length,4);
});
test('a saturated emitter does not consume finite births that it could not create',()=>{
  const s=script({particlesToEmit:3,particlesPerEmission:3,maxParticleInstanceAtOnce:2,emissionInterval:.033},{lifeTime:.1});
  for(let i=0;i<15;i++)s.step(.033,host);
  assert.equal(s.systems[0].emitted,3);assert.equal(s.systems[0].live.length,0);
});
test('particle clips can finish without looping back to their first cell',()=>{
  const original=script({particlesToEmit:1,particlesPerEmission:1});
  original.data.animations=[node('SpriteAnimation',{name:'clip',sprite:'p',animTime:100,isLoop:false},'',[
    node('Frame',{},'0,0'),node('Frame',{},'1,0')])];
  const s=new Script('clip',original.data,()=>null);
  for(let i=0;i<10;i++)s.step(.033,host);
  assert.equal(s.records(s.systems[0],1)[0].sx,32);
});
test('secondary trails keep their parent birth position and finite child count after the player turns',()=>{
  const parent=script({particlesToEmit:1,particlesPerEmission:1});
  parent.data.particles[0].a.secondary='trail';
  const child=script({particlesToEmit:2,particlesPerEmission:3},{},'OnRespawned').data.particles[0];
  child.a.name='trail';parent.data.particles.push(child);
  const s=new Script('trail',parent.data,()=>null);
  s.step(.033,{...host,x:100,facing:-1});s.step(.033,{...host,x:150,facing:1});
  assert.equal(s.systems[1].live.length,2);
  assert.ok(s.records(s.systems[1],1).every(record=>record.X===-50));
});
test('relative particles apply their current emitter offset once and follow its movement',()=>{
  const s=script({offset:'3,4'},{relativeToEmitter:true});s.step(.033,host);
  assert.deepEqual(s.records(s.systems[0],1).map(r=>[r.X,r.Y]),[[3,4],[3,4]]);
  s.systems[0].es.offset='9,12';
  assert.deepEqual(s.records(s.systems[0],1).map(r=>[r.X,r.Y]),[[9,12],[9,12]]);
});
test('world-space births project into a local preview origin and stay fixed as the avatar travels and bobs',()=>{
  const data=script({particlesToEmit:1,particlesPerEmission:1},{relativeToEmitter:false}).data;
  const item={id:1,raw:{script:'p'}},layer=new XmlParticleLayer({p:data});
  const frame=worldX=>({x:0,y:0,worldX,worldY:0,clockMs:33,ground:true,locomotion:'idle',facing:1,events:[]});
  const initial=layer.step([item],frame(1000),{}, {x:0,y:-5},33)[0];
  assert.equal(initial.matrix[4],0); // center anchor (16) minus half the sprite (16)
  assert.equal(initial.matrix[5],11); // feet anchor (32) - lift (5) - half sprite (16)
  const moved=layer.step([item],frame(1010),{}, {x:0,y:-10},33)[0];
  assert.equal(moved.matrix[4],-10,'the detached particle remains at its birth X');
  assert.equal(moved.matrix[5],11,'later rider bob does not move a detached particle');
});
test('context predicates reach the FX engine and unsupported predicates fail closed',()=>{
  const s=script();s.host={...host,renderContext:{equippedIds:[42],renderMods:['MINI']}};
  assert.equal(s.cond(node('IsWearing',{},42)),true);
  assert.equal(s.cond(node('IsWearing',{},43)),false);
  assert.equal(s.cond(node('IsRenderMod',{},'MINI')),true);
  assert.equal(s.cond(node('IsVariableBool',{name:'missing'},false)),false);
  assert.equal(s.cond(node('UnknownPredicate',{},false)),false);
  assert.equal(s.cond(node('CompareCustomVariable',{VariableNameToCompare:'missing'},0)),false);
});
test('acceleration and interpolated velocity preserve the same trajectory across step sizes',()=>{
  const particle=()=>({age:0,life:2,pos:[0,0],vel:[0,0],vel0:[0,0],vel1:[20,0],grav:[0,10],angle:0,spin:0});
  const a=particle(),b=particle();integrateParticle(a,1);
  for(let i=0;i<100;i++)integrateParticle(b,.01);
  for(let axis=0;axis<2;axis++)assert.ok(Math.abs(a.pos[axis]-b.pos[axis])<1e-9);
  assert.deepEqual(a.pos,[5,5]);
  integrateParticle(a,100);assert.equal(a.age,2);
});
test('punch start and stop stage emitters activate without render-rule shims',()=>{
  const start=script({particlesToEmit:1,particlesPerEmission:1},{},'OnPunchStart');
  start.step(.033,host);assert.equal(start.systems[0].live.length,0);
  start.step(.033,{...host,punchStart:true,punching:true});assert.equal(start.systems[0].live.length,1);
  const stop=script({particlesToEmit:1},{},'OnPunchStop');
  stop.step(.033,{...host,punchStop:true});assert.equal(stop.systems[0].live.length,1);
});
test('hidden equipment keeps modifiers while same-slot transmutation changes sprites',()=>{
  const original={id:1,slot:0,raw:{},skin:[10,20,30,255],bodyAlpha:.5,pieces:[],hideSlots:[]};
  const target={id:2,slot:0,raw:{},pieces:[],hideSlots:[]};
  const look=resolveLook([original],{transmutes:new Map([[1,target]])});
  assert.equal(look.displayed[0],target);assert.equal(look.contributors[0],original);
  assert.equal(resolveLook([original],{hiddenItemIds:[1]}).contributors.length,1);
  assert.throws(()=>resolveLook([original],{transmutes:{1:{id:3,slot:5}}}),/same clothing slot/);
  const calls=buildDrawList({catalog:{},motion:{x:0,y:0,facing:1},pose:{frontFoot:0,backFoot:0,frontAngle:0,backAngle:0},
    items:look.displayed,visual:{contributors:look.contributors}});
  assert.deepEqual(calls.find(c=>c.tag==='body').tint,[10,20,30]);
  assert.equal(calls.find(c=>c.tag==='body').alpha,.5);
  const hiddenCalls=buildDrawList({catalog:{},motion:{x:0,y:0,facing:1},
    pose:{frontFoot:0,backFoot:0,frontAngle:0,backAngle:0},items:[],visual:{contributors:[{...original,hideLegs:true}]}});
  assert.ok(hiddenCalls.some(call=>call.tag==='backFoot'),'hidden mount geometry must not hide the bare feet');
});
test('slot-hiding affects display without removing the hidden contribution',()=>{
  const hat={id:1,slot:0,hideSlots:[7]},hair={id:2,slot:7,bodyAlpha:.5};
  const look=resolveLook([hat,hair]);assert.deepEqual(look.displayed,[hat]);assert.equal(look.contributors.length,2);
});
test('research punch sequences play each cue once across uneven updates and held repeats',()=>{
  const data=json('../demo/punch-sfx.json'),timeline=new PunchTimeline(data),items=[{id:1780,slot:5}];
  const frame=(clock,events=[])=>({clockMs:clock,events,facing:-1,x:10,y:20});
  const event={type:'punch',id:'p1',at:100,facing:-1};
  assert.equal(timeline.step(items,frame(100,[event])).length,1);
  assert.equal(timeline.step(items,frame(250,[event])).length,0);
  const rest=timeline.step(items,frame(1000));
  assert.equal(rest.length,data.items[1780][1].length-1);
  assert.equal(rest.at(-1).at,708);assert.equal(rest.at(-1).origin,'feet');
  assert.equal(timeline.step(items,frame(1100)).length,0);
  assert.equal(resolvePunchCues(items,data).style,21);
  timeline.reset();assert.equal(timeline.step(items,frame(1200)).length,0);
});
test('equipping another slot preserves existing particles; repeated event snapshots do not retrigger them',()=>{
  const s=script({particlesToEmit:1},{},'OnPunchStart');
  const data=s.data,catalog={fxRenderers:{test:data},renderers:{},tile:32,slotOffset:{}};
  const item={id:1,slot:0,raw:{script:'test'},pieces:[],hooks:{}};
  const player=new PlannerPlayer(catalog,[item]);
  const frame={clockMs:33,ground:true,locomotion:'idle',facing:1,x:0,y:0,events:[{type:'punch',id:'p1',at:0}],punch:{ageMs:33}};
  player.step(frame,33);const active=player.xmlfx.scripts.get(1);
  player.equip([item,{id:2,slot:1,raw:{},pieces:[],hooks:{}}]);
  player.step({...frame,clockMs:66},33);
  assert.equal(player.xmlfx.scripts.get(1),active);assert.equal(active.systems[0].live.length,1);
  player.step({...frame,clockMs:99},33,{effects:false});assert.equal(player.xmlfx.scripts.size,0);
});
test('canvas line draws restore normal blending after additive sprites',()=>{
  const blends=[];const ctx={save(){},restore(){},setTransform(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){blends.push(this.globalCompositeOperation);}};
  drawCanvas(ctx,[{atlas:'a',sx:0,sy:0,sw:1,sh:1,matrix:[1,0,0,1,0,0],add:true},
    {line:{from:[0,0],to:[1,1]},matrix:[1,0,0,1,0,0]}],new Map([['a',{image:{width:1,height:1}}]]));
  assert.deepEqual(blends,['source-over']);
});
test('browser engine modules are identical to the tested source modules',()=>{
  for(const file of ['fx-engine','player','render','xml-particles','look','particle-state','punch-timeline','research-data','world-rules','reference-fx'].map(name=>name+'.mjs'))
    assert.equal(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),readFileSync(new URL('../demo/engine/'+file,import.meta.url),'utf8'),file);
});
