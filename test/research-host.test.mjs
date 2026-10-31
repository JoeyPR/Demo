// Actual host-module smoke test with a recording canvas/DOM adapter. This
// verifies boot/wiring/asset paths; it is deliberately NOT a browser pixel test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const errors = [], missing = [], draws = [];
class Canvas {
  constructor() { this.width=1920;this.height=1080;this.style={};this.listeners={}; }
  getContext() {
    if(!this.ctx)this.ctx=new Proxy({canvas:this,globalAlpha:1,
      drawImage:(image,...args)=>{assert.ok(image);assert.ok(args.every(Number.isFinite));draws.push(args);},
      setTransform:(...m)=>assert.ok(m.every(Number.isFinite)),
      getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255),width:w,height:h}),
      measureText:s=>({width:s.length*8,actualBoundingBoxAscent:14,actualBoundingBoxDescent:4}),
      createLinearGradient:()=>({addColorStop(){}}),
      getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0})
    },{get:(target,key)=>key in target?target[key]:()=>{}});
    return this.ctx;
  }
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(){}
  getBoundingClientRect(){return {left:0,top:0,right:this.width,bottom:this.height,width:this.width,height:this.height};}
}
class ImageAdapter {
  constructor(){this.width=0;this.height=0;this.complete=false;this.listeners=[];}
  set src(src){
    this._src=String(src);
    this.loading=(async()=>{
      try {
        const bytes=await fs.readFile(new URL(this._src,root));
        assert.ok(bytes.length>0);
        const png=bytes.subarray(1,4).toString()==='PNG';
        this.width=this.naturalWidth=png?bytes.readUInt32BE(16):512;
        this.height=this.naturalHeight=png?bytes.readUInt32BE(20):512;
        this.complete=true;this.onload?.();for(const fn of this.listeners)fn();
      }catch(error){missing.push(this._src);this.onerror?.(error);throw error;}
    })();
    this.loading.catch(()=>{});
  }
  get src(){return this._src;}
  decode(){return this.loading;}
  addEventListener(name,fn){if(name==='load')this.listeners.push(fn);}
}
const waitUntil=async predicate=>{
  const until=Date.now()+10000;
  while(!predicate()) {if(Date.now()>until)throw Error('Host did not initialize');await new Promise(r=>setTimeout(r,5));}
};
test('live host boots bitmap plate, terrain, source equipment effects and appearance controls',async()=>{
  const canvas=new Canvas(),hud={textContent:''},nodes=new Map();
  globalThis.HTMLCanvasElement=Canvas;globalThis.Image=ImageAdapter;
  globalThis.document={createElement:()=>new Canvas(),querySelector:s=>s==='#pv'?canvas:s==='#hud'?hud:(nodes.get(s)??(nodes.set(s,new Canvas()),nodes.get(s))),
    querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){}};
  globalThis.window=globalThis;globalThis.addEventListener=()=>{};
  const events=new Map(),stored=new Map();
  globalThis.P={on:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},
    emit:(name,data)=>{for(const fn of events.get(name)??[])fn(data);},
    store:{get:(name,fallback)=>stored.get(name)??fallback,set:(name,value)=>stored.set(name,value)},
    input:{},toast:message=>errors.push(message),camZoom:{v:1}};
  globalThis.fetch=async address=>{
    const url=new URL(address,root);
    try {const bytes=await fs.readFile(url);return {ok:true,status:200,json:async()=>JSON.parse(bytes),text:async()=>bytes.toString()};}
    catch{return {ok:false,status:404};}
  };
  const originalError=console.error;console.error=(...args)=>errors.push(args.map(String).join(' '));
  try {
    await import('../js/plate.js');await import('../js/app.js');
    await waitUntil(()=>globalThis.plannerApp?.ready);
    assert.equal(await P.plate.ready,true);assert.equal(P.plate.renderer,'bitmap');
    await waitUntil(()=>plannerApp.weatherRenderer);
    assert.equal(plannerApp.catalog.items.length,4081);
    const frame=()=>P.emit('frame',{dt:1/60,ctx:canvas.getContext('2d'),w:1920,h:1080});
    P.plateConfig.setGrowId('JoeyPR');P.plateConfig.toggleTitle('ss');P.plateConfig.setWrenchOn(true);
    for(let i=0;i<5;i++)frame();
    assert.ok(plannerApp.ready,hud.textContent);
    assert.ok(draws.length>0);
    assert.ok(plannerApp.terrainRenderer.stats.hits>0);
    P.emit('equip',156); // Fairy Wings: equipped identity grants the ability.
    assert.equal(plannerApp.abilities.doubleJump,true);
    assert.equal(P.appearance.setHidden(156,true),true);frame();
    assert.equal(plannerApp.appearance.visualItems.length,0);
    assert.equal(plannerApp.abilities.doubleJump,true);
    P.appearance.setHidden(156,false);P.appearance.setTransmute(156,1206);frame();
    assert.equal(plannerApp.appearance.visualItems[0].id,1206);
    assert.equal(plannerApp.equipped.get(6).id,156);
    assert.equal(plannerApp.abilities.doubleJump,true);
    assert.equal(P.appearance.setTransmute(156,36),false);
    P.emit('equip',156);frame();assert.equal(plannerApp.equipped.size,0);
    P.emit('equip',472);P.input.punch=true;
    for(let i=0;i<5;i++)frame();P.input.punch=false;
    const bullets=plannerApp.lastResult.calls.filter(c=>c.referenceFx==='bullet');
    assert.ok(bullets.length>0);
    assert.equal(bullets[0].sx,96, 'bullet uses the fourth cell of the shared 192px sheet');
    assert.ok(plannerApp.ready,hud.textContent);
    for(const title of P.plate.titles) {
      P.plateConfig.reset();P.plateConfig.setGrowId('JoeyPR');P.plateConfig.toggleTitle(title.key);frame();
      assert.ok(Number.isFinite(P.plate.measure(canvas.getContext('2d'),960,300,3)));
      assert.ok(plannerApp.ready,title.key+': '+hud.textContent);
    }
    assert.equal(P.plate.titles.length,27);
    P.plateConfig.setGuildFlag(34);P.plateConfig.setGuildBackground(116);frame();
    await new Promise(r=>setTimeout(r,20));
    assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
  }finally{console.error=originalError;}
});
