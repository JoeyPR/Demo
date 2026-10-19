import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compose,translate,scale,rotate,point,around,angleDelta } from "../src/math.mjs";
import { sampleTrack,sampleFrames,crossedEvents } from "../src/animation.mjs";
import { PlayerRig,armMatrix,heldMatrix,playerRoot } from "../src/rig.mjs";
import { PreviewMotion,FixedStepper } from "../src/motion.mjs";
import { PLANNER_PROFILE as P } from "../src/planner-profile.mjs";
import { importPlannerItem,requirePlannerCatalog,spriteMatrix } from "../src/items.mjs";
import { buildDrawList,drawCanvas,resolveWear } from "../src/render.mjs";
import { EffectSystem } from "../src/effects.mjs";
import { runHook } from "../src/script-vm.mjs";
import { PlannerPlayer } from "../src/player.mjs";
import { registerAtlas,createRenderSurface } from "../src/canvas-assets.mjs";

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const catalog={tile:32,frameMs:175,arm:P.arm,slotOffset:{},items:[]};
const motion=(o={})=>({x:0,y:0,facing:1,locomotion:"idle",moveMs:0,clockMs:0,ground:true,events:[],...o});
const rawItem=(o={})=>({id:1,name:"Synthetic test item",slot:1,atlas:"synthetic.png",x:0,y:0,gameIcon:[],...o});
const pose=new PlayerRig().update(motion(),16);
const piece={a:"synthetic.png",sx:0,sy:0,sw:32,sh:32,x:0,y:0,pass:"RenderShirt",attachment:"body"};
const callsFor=(items=[],m=motion(),p=pose)=>buildDrawList({motion:m,pose:p,items,catalog});
const item=(o={})=>({...importPlannerItem(rawItem()),pieces:[piece],...o});

test("affine multiplication applies local before parent",()=>{
  assert.deepEqual(point(compose(translate(10,20),scale(2)),[3,4]),[16,28]);
});
test("arm pivot remains fixed through all rotations",()=>{
  for(let a=-720;a<=720;a+=13) for(const side of ["back","front"]) {
    const p=P.origins[side],r=point(armMatrix(side,a),p);near(r[0],p[0]);near(r[1],p[1]);
  }
});
test("held hand uses distinct y+1 pivot",()=>{
  const p=[P.origins.front[0],P.origins.front[1]+1];
  const r=point(heldMatrix("front",90),p);near(r[0],p[0]);near(r[1],p[1]);
});
test("mirror once about logical tile, then root position",()=>{
  const m=playerRoot(motion({x:100,y:40,facing:-1}));
  assert.deepEqual(point(m,[9,18]),[123,58]);
});
test("angles use shortest wrapping",()=>{near(angleDelta(350,10),20);near(angleDelta(10,350),-20);});
test("recovered walk arm knots match exact numeric profile",()=>{
  for(const [t,a,b] of P.armTracks.walk.keys) assert.deepEqual(
    sampleTrack(P.armTracks.walk,t,new Set([0,1])),[a,b]);
});
test("walk period wraps and interpolates",()=>{
  assert.deepEqual(sampleTrack(P.armTracks.walk,1320,new Set([0,1])),[20,330.3]);
  const sample=sampleTrack(P.armTracks.walk,16.5,new Set([0,1]));
  near(sample[0],15.9);near(sample[1],339.25);
});
test("foot channels interpolate independently from step channels",()=>{
  const sample=sampleTrack(P.footTracks.walk,16.5);
  near(sample[0],-.2);near(sample[1],-1.8);
  assert.deepEqual(sample.slice(2),[1,0]);
});
test("rig uses same walk phase for both limbs",()=>{
  const p=new PlayerRig().update(motion({locomotion:"walk",moveMs:99}),1000/60);
  assert.deepEqual([p.backAngle,p.frontAngle,p.backFoot,p.frontFoot],[333.8,26.2,-1.2,-.8]);
});
test("air arms approach targets rather than snapping",()=>{
  const r=new PlayerRig(),p=r.update(motion({locomotion:"jump"}),1000/60);
  near(p.backAngle,345);near(p.frontAngle,345);near(p.frontFoot,.5);
});
test("punch overlays air locomotion",()=>{
  const p=new PlayerRig().update(motion({locomotion:"jump",punch:{ageMs:100}}),1000/60);
  assert.ok(p.punch);near(p.frontFoot,.5);assert.deepEqual(p.face,[4,0]);
});
test("idle resets air offsets; no fabricated landing squash",()=>{
  const r=new PlayerRig();r.update(motion({locomotion:"fall"}),50);
  assert.equal(r.update(motion(),16).frontFoot,0);
});
test("discrete frame sequence supports unequal durations and hold last",()=>{
  const c={frames:["a","b","c"],durations:[10,20,30]};
  assert.equal(sampleFrames(c,29),"b");assert.equal(sampleFrames(c,60),"a");
  assert.equal(sampleFrames({...c,loop:false},9000),"c");
  assert.throws(()=>sampleFrames({frames:["a"],frameMs:0},0));
});
test("intentional empty clip frame stays hidden instead of using icon fallback",()=>{
  const i=item({clips:{idle:{frames:[[]],frameMs:100}},raw:rawItem({
    gameIcon:[{...piece,u:10}]
  })});
  assert.ok(!callsFor([i]).some(c=>c.owner===i.id));
});
test("loop events use interval crossings and do not duplicate boundaries",()=>{
  const events=[{at:0,type:"burst"},{at:25,type:"spark"}];
  assert.deepEqual(crossedEvents(events,-1,100,50).map(e=>e.time),[0,25,50,75,100]);
  assert.deepEqual(crossedEvents(events,100,125,50).map(e=>e.time),[125]);
});
test("fixed stepping independent of display-frame batching",()=>{
  const run=frames=>{const m=new PreviewMotion(),s=new FixedStepper(dt=>m.step(dt,{right:true}));
    for(const t of frames)s.advance(t);return m.snapshot();};
  assert.deepEqual(run(Array(60).fill(1000/60)),run(Array(30).fill(1000/30)));
});
test("jump is edge triggered, lands and refreshes air jump",()=>{
  const m=new PreviewMotion({doubleJump:true}),dt=1000/60;
  m.step(dt,{jump:true});assert.equal(m.events[0].type,"jump");
  m.step(dt,{jump:true});assert.equal(m.events.length,0);
  m.step(dt,{jump:false});m.step(dt,{jump:true});assert.equal(m.events[0].type,"doubleJump");
  m.step(dt,{jump:false});m.step(dt,{jump:true});assert.equal(m.events.length,0);
  let lands=0;for(let i=0;i<150;i++)lands+=m.step(dt,{}).events.filter(e=>e.type==="land").length;
  assert.equal(lands,1);assert.equal(m.ground,true);assert.equal(m.airAvailable,true);
});
test("native data is never accepted as planner JSON",()=>{
  assert.throws(()=>requirePlannerCatalog({version:27,items:[{}]}));
  assert.equal(requirePlannerCatalog(catalog),catalog);
});
test("unknown item renderer remains flagged incomplete",()=>{
  const i=importPlannerItem(rawItem({script:"RenderUnknown.xml"}));
  assert.equal(i.completeness,"reference-only");assert.ok(i.warnings.some(w=>w.includes("unavailable")));
});
test("render order puts body before shirt before front arm before hat",()=>{
  const calls=callsFor([item(),item({id:2,slot:0,pieces:[{...piece,pass:"RenderHat"}]})]);
  const idx=pass=>calls.findIndex(c=>c.pass===pass);
  assert.ok(idx("BODY")<idx("RenderShirt"));assert.ok(idx("RenderShirt")<idx("RenderFrontArm"));
  assert.ok(idx("RenderFrontArm")<idx("RenderHat"));
});
test("slot conflicts fail loudly",()=>assert.throws(()=>callsFor([item(),item({id:2})])));
test("slot hiding differs from semantic body-part hiding",()=>{
  const shirt=item(),robe=item({id:2,slot:0,hideSlots:[1],hide:["frontArm"]});
  const calls=callsFor([shirt,robe]);
  assert.ok(!calls.some(c=>c.owner===1));assert.ok(!calls.some(c=>c.tag==="frontArm"));
});
test("headless hides head and eyes, not all clothes",()=>{
  const calls=callsFor([item({headless:true})]);
  assert.ok(!calls.some(c=>["head","eyes","eyelids"].includes(c.tag)));
  assert.ok(calls.some(c=>c.owner===1));
});
test("body skin alpha and color are resolved separately",()=>{
  const w=resolveWear([item({skin:[80,100,120,128],bodyAlpha:.5})]);
  near(w.alpha,128/255*.5);assert.deepEqual(w.skin.slice(0,3),[80,100,120]);
});
test("front face overHat changes pass order",()=>{
  const face=item({id:2,slot:4,raw:{overHat:true},pieces:[{...piece,pass:"RenderFaceItem"}]});
  const hat=item({id:3,slot:0,pieces:[{...piece,pass:"RenderHat"}]});
  const calls=callsFor([face,hat]);
  assert.ok(calls.findIndex(c=>c.owner===2)>calls.findIndex(c=>c.owner===3));
});
test("rider lift moves player but not mount pieces",()=>{
  const rider=item({riderLift:-4,pieces:[piece,{...piece,attachment:"mount"}]});
  const owner=callsFor([rider]).filter(c=>c.owner===1);
  assert.equal(owner[0].matrix[5],-4);assert.equal(owner[1].matrix[5],0);
});
test("sleeve replacement uses per-item punch column",()=>{
  const sleeve={a:"player_sleeve.png",sx:56,sy:0,sw:8,sh:8,x:24,y:18,ax:.5,ay:.125,u:1};
  const i=item({pieces:[],raw:rawItem({gameIcon:[sleeve]}),punchSleeves:[[7,[0,150,190,255]]]});
  const p={...pose,punch:{angle:270,width:1.2,stretch:1}};
  const rendered=callsFor([i],motion({punch:{ageMs:100}}),p).find(c=>c.owner===1);
  assert.equal(rendered.atlas,"player_puncharm.png");assert.equal(rendered.sx,140);
  assert.deepEqual(rendered.tint,[0,150,190]);
});
test("source density is independent from output pixels per tile",()=>{
  const c={...piece,atlas:"a",matrix:[1,0,0,1,0,0],alpha:1,tint:null};
  for(const size of [32,64,128,256]) {
    const matrices=[],ctx={save(){},restore(){},setTransform(...m){matrices.push(m);},drawImage(){}};
    drawCanvas(ctx,[c],new Map([["a",{image:{},pixelsPerUnit:2}]]),{tilePixels:size});
    near(matrices[0][0],size/64);
  }
});
test("dense piece anchors normalize to logical source dimensions",()=>{
  const p={sw:64,sh:64,pixelsPerUnit:2,x:16,y:32,ax:.5,ay:1};
  const m=spriteMatrix(p);
  assert.deepEqual(point(m,[0,0]),[0,0]);
  const flipped=spriteMatrix({...p,f:[true,false]});
  assert.deepEqual(point(flipped,[0,0]),[32,0]);
});
test("RGBA tint preserves source alpha bytes",()=>{
  const data=new Uint8ClampedArray([200,100,50,128,255,255,255,0]);
  let result;
  const ctx={drawImage(){},getImageData(){return {data};},putImageData(x){result=x.data;}};
  const a=registerAtlas({}, {canvasFactory:()=>({getContext:()=>ctx})});
  a.tintedCrop({sx:0,sy:0,sw:2,sh:1,tint:[128,255,0]});
  assert.deepEqual([...result],[100,100,0,128,128,255,0,0]);
});
test("supersampling is explicit and separately resolved",()=>{
  const sizes=[],ctx={clearRect(){},drawImage(){}};
  const surface=createRenderSurface(64,128,{supersample:2,canvasFactory:(w,h)=>{
    sizes.push([w,h]);return {getContext:()=>ctx};}});
  assert.deepEqual(sizes,[[128,256],[64,128]]);surface.resolve();assert.equal(ctx.imageSmoothingEnabled,true);
});
test("world particles stay at birth; local particles follow root",()=>{
  const fx=new EffectSystem(1),event={id:"d1",at:0,facing:1};
  fx.trigger({id:"w",space:"world",at:[1,2],lifeMs:1000},event,translate(10,20));
  fx.trigger({id:"l",space:"local",at:[1,2],lifeMs:1000},event,translate(10,20));
  fx.update(100);
  assert.deepEqual(fx.sample(()=>translate(100,200)).map(p=>p.world),[[11,22],[101,202]]);
});
test("FX duplicate event does not spawn twice; seeded repeat is reproducible",()=>{
  const run=()=>{const fx=new EffectSystem(42),e={id:"e",at:0};
    const d={id:"x",space:"world",count:2,spread:[10,10],lifeMs:500};
    fx.trigger(d,e,translate(0,0));fx.trigger(d,e,translate(0,0));fx.update(100);return fx.sample(()=>translate(0,0));};
  assert.equal(run().length,2);assert.deepEqual(run(),run());
});
test("declarative VM honors conditions and rejects arbitrary instructions",()=>{
  assert.equal(runHook([{op:"if",left:{read:"ground"},equals:false,then:[
    {op:"pose",key:"backAngle",value:200}]}],{ground:false}).pose.backAngle,200);
  assert.throws(()=>runHook([{op:"eval",value:"fetch('/secret')"}],{}));
  assert.throws(()=>runHook(Array(300).fill({op:"hide",part:"head"}),{}));
});
test("integration runs motion hook, pose, and draw list",()=>{
  const i=item({hooks:{jump:[{op:"pose",key:"frontAngle",value:123}]}});
  const player=new PlannerPlayer(catalog,[i]);
  const result=player.step(motion({locomotion:"jump",events:[{type:"jump",id:"j1"}]}),1000/60);
  assert.equal(result.pose.frontAngle,123);assert.ok(result.calls.length>4);
});
test("differential fixtures match extracted target pure functions",()=>{
  const fixtures=JSON.parse(fs.readFileSync(new URL("../evidence/differential-fixtures.json",import.meta.url)));
  for(const f of fixtures.arms) {
    const own=sampleTrack(P.armTracks.walk,f.t,new Set([0,1]));
    own.forEach((x,i)=>near(((x%360)+360)%360,f.value[i]));
  }
  for(const f of fixtures.rotations) {
    const own=armMatrix(f.side,f.angle);
    own.forEach((x,i)=>near(x,f.value[i]));
  }
  for(const f of fixtures.pieces) spriteMatrix(f.record).forEach((x,i)=>near(x,f.value[i]));
});
