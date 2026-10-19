// Step 8: blend modes and the A/B premultiply switch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {BLEND_MODES,BLEND_PREMULT_MODE,BLEND_KIND,blendKindOf,blendPlan,getBlendPremultMode,setBlendPremultMode,premultiplyPixels,opaqueRgbPixels} from "../src/blend.mjs";
import {drawCanvas} from "../src/render.mjs";
import {fixture,n,set} from "./xml-fixture.mjs";
import {SUPPORT} from "../src/xml-support.mjs";
const scripts=JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json",import.meta.url),"utf8")).scripts;
const approx=(a,b,eps=1)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

// Tiny software compositor for one pixel: executes a blendPlan with the crops' straight RGBA and returns the resulting premultiplied dst.
function composite(plan,straight,dst,alpha=1) {
  let [dr,dg,db,da]=dst;                                    // destination as premultiplied floats 0..1
  const [r,g,b,a]=straight.map(v=>v/255);
  for(const step of plan) {
    const src=step.crop==="premult"?[r*a,g*a,b*a,a]:step.crop==="opaque"?[r,g,b,1]:[r,g,b,a];   // straight rgb + alpha of the crop
    const sa=src[3]*alpha;
    if(step.op==="source-over"){dr=src[0]*sa+dr*(1-sa);dg=src[1]*sa+dg*(1-sa);db=src[2]*sa+db*(1-sa);da=sa+da*(1-sa);}
    else if(step.op==="lighter"){dr=Math.min(1,dr+src[0]*sa);dg=Math.min(1,dg+src[1]*sa);db=Math.min(1,db+src[2]*sa);da=Math.min(1,da+sa);}
    else if(step.op==="destination-out"){const k=1-sa;dr*=k;dg*=k;db*=k;da*=k;}
  }
  return [dr,dg,db,da];
}

test("8.1 BLEND_PREMULT_MODE is one named constant, one of off/A/B, and defaults to off (legacy straight alpha)", () => {
  assert.deepEqual(BLEND_MODES,["off","A","B"]);assert.equal(BLEND_PREMULT_MODE,"off");assert.equal(getBlendPremultMode(),"off");
});
test("8.1 setBlendPremultMode switches at runtime and rejects unknown modes", () => {
  try {
    assert.equal(setBlendPremultMode("A"),"A");assert.equal(getBlendPremultMode(),"A");
    assert.equal(setBlendPremultMode("B"),"B");
    assert.throws(()=>setBlendPremultMode("C"),/BLEND_PREMULT_MODE must be one of/);
    assert.equal(getBlendPremultMode(),"B","a rejected mode changes nothing");
  } finally {setBlendPremultMode("off");}
});
test("8.1 the XML blendingMode names map to three kinds: ADDITIVE additive, PREMULTIPLIED_ALPHA premult, NORMAL/PREMULTIPLIED_NORMAL/absent normal", () => {
  assert.deepEqual(BLEND_KIND,{ADDITIVE:"additive",PREMULTIPLIED_ALPHA:"premult",PREMULTIPLIED_NORMAL:"normal",NORMAL:"normal"});
  assert.equal(blendKindOf(undefined),"normal");assert.equal(blendKindOf("SOMETHING_NEW"),"normal");
});
test("8.1 every blendingMode value shipped in the XML is known to BLEND_KIND", () => {
  const seen=new Set(),walk=(x)=>{if(x.a?.name==="blendingMode")seen.add(x.v);(x.c??[]).forEach(walk);};
  for(const r of Object.values(scripts))for(const ps of r.particles??[])walk(ps);
  assert.deepEqual([...seen].filter(v=>!(v in BLEND_KIND)),[]);
  assert.ok(seen.has("ADDITIVE")&&seen.has("PREMULTIPLIED_ALPHA"));
});
test("8.2 plan: additive is always 'lighter' on the plain crop, in every mode", () => {
  for(const m of BLEND_MODES)assert.deepEqual(blendPlan({blend:"additive"},m),[{op:"lighter",crop:"plain"}]);
  assert.deepEqual(blendPlan({add:true},"A"),[{op:"lighter",crop:"plain"}],"legacy add flag still means additive");
});
test("8.2 plan: normal calls are source-over on the plain crop in every mode", () => {
  for(const m of BLEND_MODES)assert.deepEqual(blendPlan({blend:"normal"},m),[{op:"source-over",crop:"plain"}]);
});
test("8.2 plan: premult is plain source-over in off, one premultiplied source-over in A, destination-out + lighter(opaque RGB) in B", () => {
  assert.deepEqual(blendPlan({blend:"premult"},"off"),[{op:"source-over",crop:"plain"}]);
  assert.deepEqual(blendPlan({blend:"premult"},"A"),[{op:"source-over",crop:"premult"}]);
  assert.deepEqual(blendPlan({blend:"premult"},"B"),[{op:"destination-out",crop:"plain"},{op:"lighter",crop:"opaque"}]);
});
test("8.2 plan: with no mode argument the current global mode is used", () => {
  try {setBlendPremultMode("B");assert.equal(blendPlan({blend:"premult"}).length,2);} finally {setBlendPremultMode("off");}
  assert.equal(blendPlan({blend:"premult"}).length,1);
});
test("8.3 pixels: premultiplyPixels multiplies RGB by alpha and keeps alpha", () => {
  assert.deepEqual([...premultiplyPixels([200,100,50,128, 255,255,255,0])],[100,50,25,128, 0,0,0,0]);
});
test("8.3 pixels: opaqueRgbPixels keeps straight RGB, forces alpha 255 and does not divide or multiply", () => {
  assert.deepEqual([...opaqueRgbPixels([200,100,50,128, 9,8,7,0])],[200,100,50,255, 9,8,7,255]);
});
test("8.4 maths A: out = rgb*a*a + dst*(1-a) (art premultiplied once, then source-over)", () => {
  const a=.5,out=composite(blendPlan({blend:"premult"},"A"),[255,0,0,128],[0,0,1,1]);
  const alpha=128/255;approx(out[0]*255,255*alpha*alpha,1e-6);approx(out[2],1-alpha,1e-6);
});
test("8.4 maths B: out = rgb + dst*(1-a), the GL ONE, ONE_MINUS_SRC_ALPHA result on straight RGB", () => {
  const out=composite(blendPlan({blend:"premult"},"B"),[255,0,0,128],[0,0,1,1]);
  const alpha=128/255;approx(out[0],1,1e-9);approx(out[2],1-alpha,1e-9);approx(out[3],1,1e-9);
});
test("8.4 maths: A and B differ on a half-transparent pixel (A is darker) and agree on a fully opaque one", () => {
  const half=[[200,120,40,128],[0,0,0,1]],opaque=[[200,120,40,255],[0,0,0,1]];
  const A=s=>composite(blendPlan({blend:"premult"},"A"),...s),B=s=>composite(blendPlan({blend:"premult"},"B"),...s);
  assert.ok(A(half)[0]<B(half)[0]);
  for(let i=0;i<4;i++)approx(A(opaque)[i],B(opaque)[i],1e-9);
});
test("8.4 maths: call alpha (piece opacity) scales A and B consistently (B: rgb*alpha + dst*(1-a*alpha))", () => {
  const out=composite(blendPlan({blend:"premult"},"B"),[200,100,0,128],[0,0,1,1],.5);
  approx(out[0],200/255*.5,1e-9);approx(out[2],1-(128/255)*.5,1e-9);
});
test("8.4 maths: 'off' equals the legacy path (straight source-over): rgb*a + dst*(1-a)", () => {
  const out=composite(blendPlan({blend:"premult"},"off"),[255,0,0,128],[0,0,1,1]),a=128/255;
  approx(out[0],a,1e-9);approx(out[2],1-a,1e-9);
});

// ---- drawCanvas executes the plan -------------------------------------------------------------------------------------
function recorder() {
  const ops=[];
  const ctx={save(){},restore(){},setTransform(){},transform(){},scale(){},translate(){},clearRect(){},fillRect(){},
    set globalCompositeOperation(v){ops.push(["op",v]);},set globalAlpha(v){},set imageSmoothingEnabled(v){},
    drawImage(img){ops.push(["draw",img.name??"atlas"]);}};
  return {ctx,ops};
}
const atlas=()=>({image:{width:64,height:64,naturalWidth:64,naturalHeight:64,name:"atlas"},blendCrop:(c,kind)=>({name:kind}),sampleCrop:()=>({name:"edge"}),tintedCrop:()=>({name:"tinted"})});
const callOf=blend=>({atlas:"a",sx:0,sy:0,sw:32,sh:32,matrix:[1,0,0,1,0,0],alpha:1,tint:null,add:blend==="additive",blend,smooth:false});
test("8.5 drawCanvas runs the premult plan per mode: off=source-over/atlas, A=source-over/premult crop, B=destination-out then lighter/opaque crop", () => {
  const results={};
  for(const mode of BLEND_MODES) {
    const {ctx,ops}=recorder();
    drawCanvas(ctx,[callOf("premult")],new Map([["a",atlas()]]),{blendMode:mode});
    results[mode]=ops.filter(o=>o[0]==="op"||o[0]==="draw").map(o=>o.join(":")).join(" ");
  }
  assert.match(results.off,/op:source-over draw:atlas/);
  assert.match(results.A,/op:source-over draw:premult/);
  assert.match(results.B,/op:destination-out draw:atlas op:lighter draw:opaque/);
});
test("8.5 drawCanvas: additive and normal calls draw the same in every mode (no derived crops requested)", () => {
  for(const kind of ["additive","normal"]) {
    const seen=new Set();
    for(const mode of BLEND_MODES){const {ctx,ops}=recorder();drawCanvas(ctx,[callOf(kind)],new Map([["a",atlas()]]),{blendMode:mode});seen.add(JSON.stringify(ops.filter(o=>o[0]!=="draw"||true)));}
    assert.equal(seen.size,1,kind);
  }
});
test("8.5 drawCanvas: an atlas adapter without blendCrop fails loudly in A/B instead of silently drawing straight alpha", () => {
  const bare=atlas();delete bare.blendCrop;
  assert.throws(()=>drawCanvas(recorder().ctx,[callOf("premult")],new Map([["a",bare]]),{blendMode:"A"}),/cannot supply a premult crop/);
  assert.doesNotThrow(()=>drawCanvas(recorder().ctx,[callOf("premult")],new Map([["a",bare]]),{blendMode:"off"}));
});
test("8.5 drawCanvas without a blendMode option uses the global mode", () => {
  try {
    setBlendPremultMode("A");const {ctx,ops}=recorder();drawCanvas(ctx,[callOf("premult")],new Map([["a",atlas()]]));
    assert.ok(ops.some(o=>o.join()==="draw,premult"));
  } finally {setBlendPremultMode("off");}
});

// ---- XML particles carry their kind ----------------------------------------------------------------------------------
test("8.6 an XML particle with blendingMode PREMULTIPLIED_ALPHA / ADDITIVE / NORMAL / absent carries blend premult / additive / normal / normal", () => {
  const kinds=[];
  for(const mode of ["PREMULTIPLIED_ALPHA","ADDITIVE","NORMAL",undefined]) {
    const run=fixture({particle:mode?[set("blendingMode",mode)]:[]});
    const [p]=run(0,{});kinds.push([p.blend,!!p.add]);
  }
  assert.deepEqual(kinds,[["premult",false],["additive",true],["normal",false],["normal",false]]);
});
test("8.6 xml-support: Particle.blendingMode stays partial (the A/B choice is not verified)", () => {
  assert.ok(["partial","evaluator"].includes(SUPPORT["Particle.blendingMode"]??"partial"));
  assert.notEqual(SUPPORT["Particle.blendingMode"],"full");
});
test("8.7 UI: the page has the three-way Particle blend control, wired to setBlendPremultMode and to drawCanvas", () => {
  const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8"),app=fs.readFileSync(new URL("../demo/app.js",import.meta.url),"utf8");
  for(const m of BLEND_MODES)assert.match(html,new RegExp(`data-blend="${m}"`));
  assert.match(html,/Particle blend/);
  assert.match(app,/setBlendPremultMode\(b\.dataset\.blend\)/);
  assert.match(app,/blendMode:state\.blendMode/);
});
