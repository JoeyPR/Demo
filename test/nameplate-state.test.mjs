import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
function plate(saved={}) {
  class Image {complete=true;naturalWidth=32;naturalHeight=32;dataset={};}
  class Canvas {width=32;height=32;}
  const ctx=vm.createContext({Image,HTMLCanvasElement:Canvas,console,
    document:{createElement(){return new Canvas();}},
    fetch:async path=>({ok:true,json:async()=>JSON.parse(read('../'+path))}),
    P:{store:{get:()=>saved,set(){}},emit(){}}});
  ctx.window=ctx;
  vm.runInContext(read('../js/rtfont.js'),ctx);
  vm.runInContext(read('../js/plate.js'),ctx);
  return ctx.P;
}
test('saved title selections normalize casing, duplicates and mutually exclusive titles',()=>{
  const p=plate({growId:'Joey',titles:['LEGEND','legend','l125','party','missing']});
  assert.deepEqual(Array.from(p.plateConfig.get().titles),['party']);
  p.plateConfig.toggleTitle('not-a-title');assert.equal(p.plateConfig.get().titles.length,1);
  p.plateConfig.toggleTitle('G4G');assert.deepEqual(Array.from(p.plateConfig.get().titles),['g4g']);
});
test('nameplate state snapshots and resets do not share a mutable title array',()=>{
  const p=plate();p.plateConfig.get().titles.push('legend');assert.equal(p.plateConfig.get().titles.length,0);
  p.plateConfig.toggleTitle('legend');p.plateConfig.reset();assert.equal(p.plateConfig.get().titles.length,0);
  p.plateConfig.toggleTitle('dr');p.plateConfig.reset();assert.equal(p.plateConfig.get().titles.length,0);
});
test('nameplate validates local asset keys and status while preserving formatted GrowID text',()=>{
  const p=plate({growId:'`4Joey',flag:'../../outside',role:'unknown',guildRole:'unknown',wrenchStatus:'unknown'});
  const state=p.plateConfig.get();assert.equal(state.flag,'');assert.equal(state.role,'');
  assert.equal(state.guildRole,'');assert.equal(state.wrenchStatus,'default');
  assert.equal(state.growId,'`4Joey');
  assert.equal(p.plate.inspect().parts.find(part=>part.text!==undefined).text,'Joey');
});
test('formatted names render through the unstylized path without an undefined character index',()=>{
  const p=plate({growId:'`4Joey',flag:'',titles:[]});
  const painted=[];
  const ctx={save(){},restore(){},setTransform(){},fillText(text){painted.push(text);},
    measureText(text){return {width:text.length*8,actualBoundingBoxAscent:14,actualBoundingBoxDescent:4};}};
  assert.doesNotThrow(()=>p.plate.draw(ctx,100,50,2,1000));
  assert.ok(painted.includes('J'));assert.ok(painted.includes('y'));
});
test('the recovered title and wrench indexes load with local sprite metadata',async()=>{
  const p=plate();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(Object.keys(p.plate.frames).length,278);
  assert.equal(p.plate.wrenchData.styles.length,32);assert.equal(p.plate.wrenchData.decorations.length,32);
  for(const key of ['weather','master'])assert.ok(p.plate.titles.some(title=>title.key===key));
});
