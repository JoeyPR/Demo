import {PlannerPlayer} from "./engine/player.mjs";
import {PreviewMotion} from "./engine/motion.mjs";
import {importPlannerItem} from "./engine/items.mjs";
import {drawCanvas} from "./engine/render.mjs";
import {registerAtlas} from "./engine/canvas-assets.mjs";
import {point} from "./engine/math.mjs";
import {armMatrix,playerRoot} from "./engine/rig.mjs";
import {normalizeCatalogItem,advanceCatalogItem} from "./engine/catalog-adapter.mjs";
import {drawBounds} from "./engine/draw-bounds.mjs";
import {resolveAbilities} from "./engine/abilities.mjs";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const world=$("#world"),ctx=world.getContext("2d"),avatar=document.createElement("canvas");
const avatarCtx=avatar.getContext("2d"),atlases=new Map(),images=new Map();
const atlasLoads=new Map(),failedAtlases=new Set();
const state={
  catalog:null,equipped:new Map(),slot:0,skin:[255,206,180,255],
  mode:"preview",baseAction:"idle",resolution:128,paused:matchMedia("(prefers-reduced-motion: reduce)").matches,
  speed:1,rig:false,grid:false,fx:true,hover:false,environment:"day",
  hiddenPasses:new Set(),clock:0,actionStart:0,keys:{},touch:{},
  jumpUntil:0,punchUntil:0,doubleAt:null,width:800,height:420,aim:null,previewPunch:false,
  lastFrame:null,lastResult:null,layerSignature:"",ready:false,jumpQueued:false,punchQueued:false,page:0,pageSize:36
};
let player,motion,lastTimestamp=0,remainder=0,toastTimer,paintCount=0;
const PRESETS={
  explorer:[46,36,48,40,98,156,68],
  formal:[66,38,76,78,94,68],
  wizard:[582,124,76,42,158,362,266],
  rider:[312,466,468,592,604,44],
  bare:[]
};
const SKINS=[
  {name:"Warm peach",rgb:[255,206,180,255]},
  {name:"Golden tan",rgb:[208,149,105,255]},
  {name:"Deep brown",rgb:[128,82,61,255]},
  {name:"Cool blue",rgb:[127,194,218,255]},
  {name:"Soft stone",rgb:[186,194,175,255]}
];
const PASS_NAMES={RenderBehind:"Behind player",RenderBackpack:"Back item",RenderBackArm:"Back arm",BODY:"Body & face",
  RenderShoes:"Shoes / mount",RenderPants:"Pants",RenderShirt:"Shirt",RenderFrontArm:"Front arm",
  RenderHair:"Hair",RenderBackHair:"Back hair",RenderHat:"Hat",RenderHandItem:"Hand item",RenderInFront:"In front"};
function icons(){window.lucide?.createIcons({attrs:{"stroke-width":1.65}});}
function notify(text) {
  $("#notice").textContent=text;$("#notice").classList.add("visible");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#notice").classList.remove("visible"),3200);
}
function setSelected(selector,attribute,value) {
  $$(selector).forEach(button=>{
    const selected=button.getAttribute(attribute)===String(value);
    button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",String(selected));
  });
}
function normalize(raw) {
  const item=normalizeCatalogItem(raw,state.catalog);
  item.native=state.nativeMetadata?.items?.[raw.id]??null;
  ensureItemAssets(item);
  return item;
}
function loadAtlas(name) {
  if(atlases.has(name))return Promise.resolve(images.get(name));
  if(atlasLoads.has(name))return atlasLoads.get(name);
  const load=(async()=>{
    try {
      const image=new Image();image.crossOrigin="anonymous";image.src=`./assets/${name}`;await image.decode();
      images.set(name,image);
      const atlas=registerAtlas(image),tint=atlas.tintedCrop;
      atlas.tintedCrop=call=>{
        try{return tint(call);}catch{
          const crop=document.createElement("canvas");crop.width=call.sw;crop.height=call.sh;
          crop.getContext("2d").drawImage(image,call.sx,call.sy,call.sw,call.sh,0,0,call.sw,call.sh);
          return crop;
        }
      };
      atlases.set(name,atlas);return image;
    }catch{failedAtlases.add(name);return null;}
  })();
  atlasLoads.set(name,load);return load;
}
function ensureItemAssets(item) {
  return Promise.all([...new Set([...item.pieces.map(p=>p.a),
    ...Object.values(item.renderer?.sprites??{}).map(s=>s.atlas)])].filter(Boolean).map(loadAtlas));
}
function equipPreset(name) {
  state.equipped.clear();
  for(const id of PRESETS[name]??[]) {
    const raw=state.catalog.items.find(i=>i.id===id);
    if(raw)state.equipped.set(raw.slot,normalize(raw));
  }
  player.equip([...state.equipped.values()]);
  state.hiddenPasses.clear();state.layerSignature="";
  updateWardrobe();updateEquipped();
  if(state.lastFrame)updateRig(0);
}
function thumbnail(raw,size=48) {
  const canvas=document.createElement("canvas");canvas.width=size*2;canvas.height=size*2;
  canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;
  const c=canvas.getContext("2d");c.imageSmoothingEnabled=false;
  const pieces=(raw.gameIcon??[]).filter(r=>r.a);
  // A centered sheet cell makes each preview directly comparable.
  const primary=pieces.find(r=>r.a===raw.atlas)??pieces[0]??(raw.atlas?{
    a:raw.atlas,sx:(raw.x??0)*(raw.cell?.[0]??1)*32,sy:(raw.y??0)*(raw.cell?.[1]??1)*32,
    sw:(raw.cell?.[0]??1)*32,sh:(raw.cell?.[1]??1)*32}:null);
  const draw=()=>{
  c.clearRect(0,0,canvas.width,canvas.height);
  if(primary&&images.has(primary.a)) {
    const s=size*1.6;
    c.drawImage(images.get(primary.a),primary.sx,primary.sy,primary.sw,primary.sh,
      (size*2-s)/2,(size*2-s)/2,s,s);
  }else {
    c.fillStyle="#a8b79e";c.font=`${size*.48}px monospace`;c.textAlign="center";
    c.fillText(primary?"…":"?",size,size*1.15);
  }};
  if(primary&&!images.has(primary.a))loadAtlas(primary.a).then(draw);
  draw();
  return canvas;
}
function updateWardrobe() {
  const query=$("#search").value.trim().toLowerCase();
  const entries=state.catalog.items.filter(i=>(query?i.name.toLowerCase().includes(query)||String(i.id)===query:state.slot===-1||i.slot===state.slot));
  const pages=Math.max(1,Math.ceil(entries.length/state.pageSize));
  state.page=Math.min(state.page,pages-1);
  $("#catalog-count").textContent=`${state.catalog.items.length.toLocaleString()} items`;
  $("#result-count").textContent=`${entries.length.toLocaleString()} ${query?"matches":state.slot===-1?"wearables":state.catalog.slots[state.slot]}`;
  $("#page-info").textContent=`${state.page+1} / ${pages}`;
  $("#page-prev").disabled=state.page===0;$("#page-next").disabled=state.page===pages-1;
  const list=$("#items");list.replaceChildren();
  if(!entries.length){const p=document.createElement("p");p.className="empty";p.textContent="No pieces found. Try another name.";list.append(p);}
  for(const raw of entries.slice(state.page*state.pageSize,(state.page+1)*state.pageSize)) {
    const selected=state.equipped.get(raw.slot)?.id===raw.id;
    const button=document.createElement("button");button.className=`item${selected?" selected":""}`;
    button.setAttribute("aria-label",`Equip ${raw.name}`);button.setAttribute("aria-pressed",String(selected));
    button.append(thumbnail(raw));
    const label=document.createElement("span");label.className="item-name";label.textContent=raw.name;button.append(label);
    const meta=document.createElement("span");meta.className="item-meta";
    meta.textContent=`#${raw.id}${raw.script?state.catalog.renderers?.[raw.script]?" · XML":" · script missing":""}`;button.append(meta);
    button.title=`${raw.name} (#${raw.id})${raw.script?` · Renderer "${raw.script}": ${state.catalog.renderers?.[raw.script]?"XML loaded, partial interpreter":"unavailable"}`:" · Public sprite reference"}`;
    if(selected){const check=document.createElement("span");check.className="item-check";check.textContent="✓";button.append(check);}
    button.addEventListener("click",()=>{
      state.equipped.set(raw.slot,normalize(raw));player.equip([...state.equipped.values()]);
      $("#preset").value="custom";
      state.slot=raw.slot;setSelected("[data-slot]","data-slot",raw.slot);updateWardrobe();updateEquipped();updateRig(0);
    });
    list.append(button);
  }
}
function updateEquipped() {
  const bar=$("#equipped");bar.replaceChildren();
  for(const item of [...state.equipped.values()].sort((a,b)=>a.slot-b.slot)) {
    const b=document.createElement("button");b.className="equipped-item";b.title=item.name;
    b.setAttribute("aria-label",`Show ${item.name} slot`);b.append(thumbnail(item.raw,30));
    b.onclick=()=>{state.slot=item.slot;$("#search").value="";setSelected("[data-slot]","data-slot",state.slot);updateWardrobe();};
    bar.append(b);
  }
  $("#piece-count").textContent=`${state.equipped.size} pieces`;
  const items=[...state.equipped.values()];
  state.abilities=resolveAbilities(items,state.abilityRegistry);
  motion?.setAbilities(state.abilities);
  $("[data-action='double']").disabled=!state.abilities.doubleJump;
  $("#ability-status").textContent=[
    state.abilities.doubleJump?"Double jump":"Single jump",
    state.abilities.highJump?"High jump":null,
    state.abilities.slowFall?"Hold Jump to slow fall":null,
    state.abilities.speedy?"Speedy":null
  ].filter(Boolean).join(" · ");
  $("#coverage-status").textContent=items.some(i=>i.renderer)?
    "Renderer XML loaded. Matched animation tracks run; unsupported native rules and FX remain partial.":
    items.some(i=>i.raw.script)?
    "Some native scripts are missing. Available public sprite animations run; missing script behavior does not.":
    items.some(i=>i.vehicle)?"Mount pose uses public still data. Moving mount clips are fallback.":
    "Public sprite reference. Per-item native movement and FX are not verified.";
}
function reset() {
  state.clock=0;state.actionStart=0;state.jumpUntil=0;state.punchUntil=0;state.doubleAt=null;remainder=0;
  state.jumpQueued=false;state.punchQueued=false;
  motion=new PreviewMotion();motion.setAbilities(state.abilities);
  player=new PlannerPlayer(state.catalog,[...state.equipped.values()]);
  state.lastFrame=motion.snapshot();state.lastFrame.locomotion=state.baseAction;
  updateRig(0);
}
function updateRig(dt) {
  const f={...state.lastFrame,worldX:state.lastFrame.x,worldY:state.lastFrame.y,x:0,y:0};
  state.lastResult=player.step(f,dt,{skin:state.skin,
    forceFloat:state.hover,effects:state.fx});
}
function step(dt) {
  state.clock+=dt;
  if(state.doubleAt!==null&&state.clock>=state.doubleAt) {
    state.jumpUntil=state.clock+100;state.doubleAt=null;
  }
  const input={
    right:state.mode==="play"&&(state.keys.right||state.touch.right),
    left:state.mode==="play"&&(state.keys.left||state.touch.left),
    jump:state.clock<state.jumpUntil||(state.mode==="play"&&(state.keys.jump||state.touch.jump||state.jumpQueued)),
    punch:state.previewPunch||state.clock<state.punchUntil||(state.mode==="play"&&(state.keys.punch||state.touch.punch||state.punchQueued))
  };
  if(state.aim&&state.view&&input.punch) {
    const {rootX,rootY,s}=state.view;
    if(input.punch)motion.facing=state.aim.x>=rootX+16*s?1:-1;
    let x=(state.aim.x-rootX)/s;
    if(motion.facing<0)x=32-x;
    input.punchTarget=[x,(state.aim.y-rootY)/s-(state.lastResult?.lift?.y??0)];
  }
  // Preserve discrete press edges even when keydown and keyup both occur between ticks.
  if(state.mode==="play"&&state.jumpQueued)motion.lastJump=false;
  const frame=motion.step(dt,input);
  state.jumpQueued=false;state.punchQueued=false;
  if(state.mode==="preview"&&frame.ground) {
    frame.locomotion=state.baseAction;frame.moveMs=state.clock-state.actionStart;
  }
  state.lastFrame=frame;
  updateRig(dt);
}
function action(name) {
  if(name==="idle"||name==="walk"){state.baseAction=name;state.actionStart=state.clock;}
  if(name==="jump"||name==="double") {
    if(name==="double"&&!state.abilities?.doubleJump){notify("Equip a Double Jump item first.");return;}
    motion.lastJump=false;
    state.jumpUntil=state.clock+150;
    if(name==="double")state.doubleAt=state.clock+250;
  }
  if(name==="fall"){motion.y=-90;motion.vy=0;motion.ground=false;motion.airAvailable=motion.doubleJump;}
  if(name==="punch")state.punchUntil=state.clock+34;
  if(state.paused){state.paused=false;updatePause();}
  world.focus({preventScroll:true});
}
function updatePause() {
  $("#pause").setAttribute("aria-label",state.paused?"Resume animation":"Pause animation");
  $("#pause").title=state.paused?"Resume animation":"Pause animation";
  $("#pause").innerHTML=`<i data-lucide="${state.paused?"play":"pause"}"></i>`;icons();
}
function resize() {
  const r=$("#viewport").getBoundingClientRect();
  state.width=r.width;state.height=r.height;
  const dpr=Math.min(devicePixelRatio||1,2);
  world.width=Math.round(r.width*dpr);world.height=Math.round(r.height*dpr);
}
const palettes={
  day:{sky:"#c6dcd1",cloud:"#e8eee0",sun:"#f7e9ac",far:"#acbeab",hill:"#94ac94",grass:"#799555",edge:"#a1b36c",soil:"#8a745a",dark:"#76644f",ink:"#304339"},
  sunset:{sky:"#dfc7aa",cloud:"#efe0c5",sun:"#f4e0a1",far:"#b8b09a",hill:"#a4a184",grass:"#859356",edge:"#b2b76b",soil:"#8c7158",dark:"#795f4c",ink:"#4b4631"},
  night:{sky:"#384d52",cloud:"#526564",sun:"#e1e8bd",far:"#3e5b53",hill:"#466550",grass:"#546e46",edge:"#7c9259",soil:"#625d4b",dark:"#54503f",ink:"#e3ebd6"},
  rain:{sky:"#a4bab4",cloud:"#c0ccc3",sun:"#becab4",far:"#96aaa0",hill:"#829d8c",grass:"#6a8755",edge:"#93a36b",soil:"#796d58",dark:"#695d4d",ink:"#304339"}
};
function cloud(x,y,s,color) {
  ctx.fillStyle=color;
  for(const [dx,dy,w,h] of [[0,8,62,12],[10,0,28,28],[38,5,32,20],[-8,13,18,10]])
    ctx.fillRect(Math.round(x+dx*s),Math.round(y+dy*s),Math.ceil(w*s),Math.ceil(h*s));
}
function background(w,h,ground,cameraY,displayScale) {
  const p=palettes[state.environment],scroll=state.mode==="play"?state.lastFrame.x*displayScale:0;
  ctx.fillStyle=p.sky;ctx.fillRect(0,0,w,h);
  const night=state.environment==="night";
  if(night) {
    ctx.fillStyle="#d4dfb8";
    for(let i=0;i<28;i++)ctx.fillRect((i*83+23)%w,(i*47+17)%(h*.5),i%5===0?3:2,2);
  }
  // Block-built scenery is original demo artwork, not a game-world reconstruction.
  const sunX=w*.77,sunY=h*.22-cameraY*.05;
  ctx.fillStyle=p.sun;ctx.fillRect(sunX-18,sunY-24,36,48);ctx.fillRect(sunX-24,sunY-18,48,36);
  if(night){ctx.fillStyle=p.sky;ctx.fillRect(sunX-22,sunY-25,34,34);}
  cloud(w*.15-scroll*.08,h*.22-cameraY*.08,1.35,p.cloud);
  cloud(w*.58-scroll*.04,h*.12-cameraY*.04,.75,p.cloud);
  cloud(w*.89-scroll*.03,h*.37-cameraY*.05,.65,p.cloud);
  ctx.fillStyle=p.far;
  for(let i=-1;i<12;i++) {
    const x=i*110-((scroll*.13)%110),top=ground-55-cameraY*.3-(i%3)*18;
    ctx.fillRect(x,top,110,h);ctx.fillRect(x+20,top-18,70,20);
  }
  ctx.fillStyle=p.hill;
  for(let i=-1;i<8;i++) {
    const x=i*160-((scroll*.23)%160),top=ground-22-cameraY*.5-(i%3)*11;
    ctx.fillRect(x,top,160,h);ctx.fillRect(x+24,top-16,95,20);
  }
  const floor=ground-cameraY,tile=32*displayScale;
  // A few sparse pixel saplings provide scale, without covering the player.
  for(let i=-1;i<3;i++) {
    const x=i*480+90-((scroll*.65)%480),y=floor;
    ctx.fillStyle=p.dark;ctx.fillRect(x,y-80,8,80);
    ctx.fillStyle=p.grass;ctx.fillRect(x-24,y-100,56,28);ctx.fillRect(x-12,y-115,32,20);
    ctx.fillStyle=p.edge;ctx.fillRect(x-20,y-100,48,8);
  }
  ctx.fillStyle=p.soil;ctx.fillRect(0,floor,w,h-floor);
  for(let i=-1;i<Math.ceil(w/tile)+1;i++) {
    const x=i*tile-(scroll%tile);
    ctx.fillStyle=p.dark;ctx.fillRect(Math.round(x),floor+14,1,h);
    for(let j=0;j<20;j++) {
      const ox=(j*29+13)%tile,oy=(j*37+22)%125;
      ctx.fillStyle=j%3===0?p.edge:p.dark;ctx.fillRect(Math.round(x+ox),floor+oy,4,3);
    }
    ctx.fillStyle=p.grass;ctx.fillRect(Math.round(x),floor,tile+1,13);
    ctx.fillStyle=p.edge;ctx.fillRect(Math.round(x),floor,tile+1,4);
    for(let j=0;j<8;j++)ctx.fillRect(Math.round(x+j*tile/8),floor-4-(j%3)*3,4,7);
  }
  if(state.grid) {
    ctx.strokeStyle=night?"#e0edd02e":"#31463226";ctx.lineWidth=1;
    for(let x=-(scroll%tile);x<w;x+=tile){ctx.beginPath();ctx.moveTo(Math.round(x)+.5,0);ctx.lineTo(Math.round(x)+.5,h);ctx.stroke();}
    for(let y=floor%tile;y<h;y+=tile){ctx.beginPath();ctx.moveTo(0,Math.round(y)+.5);ctx.lineTo(w,Math.round(y)+.5);ctx.stroke();}
  }
  return floor;
}
function renderAvatar() {
  const calls=state.lastResult.calls.filter(c=>!state.hiddenPasses.has(c.pass)&&atlases.has(c.atlas));
  const bounds=drawBounds(calls),scale=state.resolution/32;
  const width=Math.ceil(bounds.width*scale),height=Math.ceil(bounds.height*scale);
  if(avatar.width!==width||avatar.height!==height){avatar.width=width;avatar.height=height;}
  avatarCtx.setTransform(1,0,0,1,0,0);avatarCtx.clearRect(0,0,width,height);
  state.avatarBounds=bounds;
  const missing=[...new Set(state.lastResult.calls.filter(c=>!atlases.has(c.atlas)).map(c=>c.atlas))];
  for(const name of missing)loadAtlas(name);
  if(missing.some(name=>failedAtlases.has(name)))$("#coverage-status").textContent=
    `Unavailable sprite sheets: ${missing.filter(n=>failedAtlases.has(n)).join(", ")}. Other outfit pieces remain visible.`;
  drawCanvas(avatarCtx,calls,atlases,{tilePixels:state.resolution,camera:[bounds.x,bounds.y]});
  return calls.length;
}
function paintRig(rootX,rootY,s) {
  const p=state.lastResult.pose;
  const lift=state.lastResult.lift?.y??0;
  const root=playerRoot({...state.lastFrame,x:0,y:0});
  const toScreen=v=>{const q=point(root,v);return[rootX+q[0]*s,rootY+(q[1]+lift)*s];};
  ctx.save();ctx.strokeStyle="#eaffb9";ctx.fillStyle="#273e31";ctx.lineWidth=1.5;
  ctx.setLineDash([4,4]);ctx.strokeRect(rootX,rootY+lift*s,32*s,32*s);ctx.setLineDash([]);
  for(const side of ["back","front"]) {
    const origin=side==="back"?[24,18]:[9,18];
    const endpoint=point(armMatrix(side,p[`${side}Angle`]),[origin[0],28]);
    const a=toScreen(origin),b=toScreen(endpoint);
    ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
    ctx.beginPath();ctx.arc(...a,4,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(...b,3,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  const hip=toScreen([16,24]),head=toScreen([16,10]);
  ctx.beginPath();ctx.moveTo(...hip);ctx.lineTo(...head);ctx.stroke();
  for(const side of ["back","front"]) {
    const foot=toScreen([side==="back"?21:11,30+p[`${side}Foot`]]);
    ctx.beginPath();ctx.moveTo(...hip);ctx.lineTo(...foot);ctx.stroke();
    ctx.beginPath();ctx.arc(...foot,3,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function paint() {
  if(!state.ready||!state.lastResult)return;
  const {width:w,height:h}=state,dpr=Math.min(devicePixelRatio||1,2);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
  const preferredScale=w<500?2.6:Math.min(4,Math.max(3,w/180));
  const s=h<160?Math.min(preferredScale,Math.max(.6,(h*.78-8)/70)):preferredScale;
  const ground=h*.78;
  // Preserve headroom on short phones; a fixed 100px jump allowance places
  // the entire player above a compact preview.
  const headroom=Math.min(100,Math.max(4,ground-32*s+
    Math.min(0,(state.lastResult.lift?.y??0)*s)-18));
  const cameraY=Math.min(0,state.lastFrame.y*s+headroom);
  const floor=background(w,h,ground,cameraY,s);
  const rootX=w/2-16*s,rootY=ground-32*s+state.lastFrame.y*s-cameraY;
  state.view={rootX,rootY,s};
  ctx.fillStyle="#253d352b";ctx.beginPath();
  const shadow=Math.max(.3,1+state.lastFrame.y/150);
  ctx.ellipse(w/2,floor+2,16*s*shadow,3*s*shadow,0,0,Math.PI*2);ctx.fill();
  const visible=renderAvatar();
  const b=state.avatarBounds;
  ctx.drawImage(avatar,rootX+b.x*s,rootY+b.y*s,b.width*s,b.height*s);
  if(state.rig)paintRig(rootX,rootY,s);
  if(state.environment==="rain") {
    ctx.strokeStyle="#eef5dc77";ctx.lineWidth=1.5;
    for(let i=0;i<70;i++) {
      const x=(i*53+state.clock*.04)%(w+20),y=(i*91+state.clock*.3)%(h+20);
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+11);ctx.stroke();
    }
  }
  const ink=palettes[state.environment].ink;
  $(".canvas-label").style.color=ink;
  $(".live-dot").style.background=ink;
  if(++paintCount%5===0)updateTelemetry(visible);
}
function updateTelemetry(visible) {
  const frame=state.lastFrame,result=state.lastResult;
  const actionName=frame.punch?"punch":frame.locomotion;
  $("#stage-state").textContent=state.mode==="play"?`PLAY MODE / ${actionName.toUpperCase()}`:`${actionName.toUpperCase()} ${actionName==="walk"?"CYCLE":"POSE"}`;
  $("#coordinate").textContent=`X ${frame.x.toFixed(1)} / Y ${frame.y.toFixed(1)}`;
  $("#stat-state").textContent=result.poseResolution?.state??actionName;
  $("#stat-back").textContent=(((result.pose.backAngle%360)+360)%360).toFixed(1)+"°";
  $("#stat-front").textContent=(((result.pose.frontAngle%360)+360)%360).toFixed(1)+"°";
  $("#stat-calls").textContent=String(visible);
  $("#stat-lift").textContent=`${result.lift.y.toFixed(2)} px`;
  $("#stat-float").textContent=result.lift.gait?`Step ${result.lift.gait.profile.periodMs} ms`:result.lift.profile?.amplitude?
    `${result.lift.profile.periodMs} ms`:result.lift.evidence==="captured-static-lift"&&
    result.lift.floating?"Curve unresolved":"Static / none";
  const seconds=Math.floor(state.clock/1000);
  $("#timecode").textContent=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}.${String(Math.floor(state.clock%1000)).padStart(3,"0")}`;
  $("#playhead").style.left=`${((frame.moveMs??0)%1320)/1320*100}%`;
  setSelected("[data-action]","data-action",actionName);
  updateLayers();
}
function updateLayers() {
  const counts=new Map();
  for(const call of state.lastResult.calls)counts.set(call.pass,(counts.get(call.pass)??0)+1);
  const signature=[...counts.keys()].join("|");
  if(signature!==state.layerSignature) {
    state.layerSignature=signature;
    $("#layers").replaceChildren();
    let index=0;
    for(const [pass,count] of counts) {
      const label=document.createElement("label");label.className="layer";
      const input=document.createElement("input");input.type="checkbox";input.checked=!state.hiddenPasses.has(pass);
      input.setAttribute("aria-label",`Show ${PASS_NAMES[pass]??pass} layer`);
      input.onchange=()=>{if(input.checked)state.hiddenPasses.delete(pass);else state.hiddenPasses.add(pass);};
      const number=document.createElement("span");number.className="layer-index";number.textContent=String(++index).padStart(2,"0");
      const name=document.createElement("span");name.className="layer-name";name.textContent=PASS_NAMES[pass]??pass.replace("Render","");
      const c=document.createElement("span");c.className="layer-count";c.dataset.pass=pass;c.textContent=count;
      label.append(input,number,name,c);$("#layers").append(label);
    }
  } else $$(".layer-count").forEach(el=>el.textContent=counts.get(el.dataset.pass)??0);
}
function animate(timestamp) {
  const elapsed=lastTimestamp?Math.min(100,timestamp-lastTimestamp):0;lastTimestamp=timestamp;
  if(state.ready&&!state.paused) {
    remainder+=elapsed*state.speed;
    while(remainder>=1000/60){step(1000/60);remainder-=1000/60;}
  }
  try{paint();}catch(error){console.error(error);state.paused=true;notify(`Rendering error: ${error.message}`);}
  requestAnimationFrame(animate);
}
function setupControls() {
  $("#mobile-export").onclick=()=>$("#export").click();
  $("#mobile-unequip").onclick=()=>$("#clear-slot").click();
  $$("button[data-mobile-tab]").forEach(b=>b.onclick=()=>{
    document.body.dataset.mobileTab=b.dataset.mobileTab;
    setSelected("button[data-mobile-tab]","data-mobile-tab",b.dataset.mobileTab);resize();
  });
  $$("[data-slot]").forEach(b=>b.onclick=()=>{state.slot=Number(b.dataset.slot);state.page=0;$("#search").value="";setSelected("[data-slot]","data-slot",state.slot);updateWardrobe();});
  $("#search").oninput=()=>{state.page=0;updateWardrobe();};
  for(const [id,delta] of [["page-prev",-1],["page-next",1]])$("#"+id).onclick=()=>{
    state.page+=delta;updateWardrobe();$("#result-count").scrollIntoView({block:"nearest"});
  };
  $("#preset").onchange=e=>equipPreset(e.target.value);
  $("#clear-slot").onclick=()=>{if(state.slot===-1)state.equipped.clear();else state.equipped.delete(state.slot);player.equip([...state.equipped.values()]);$("#preset").value="custom";updateWardrobe();updateEquipped();updateRig(0);};
  $$("[data-action]").forEach(b=>{
    b.onclick=()=>action(b.dataset.action);
    if(b.dataset.action!=="punch")return;
    b.onpointerdown=e=>{
      state.aim=null;state.previewPunch=true;
      if(state.paused){state.paused=false;updatePause();}
      b.setPointerCapture(e.pointerId);
    };
    const release=()=>state.previewPunch=false;
    b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;
  });
  $$("[data-mode]").forEach(b=>b.onclick=()=>{
    state.mode=b.dataset.mode;state.keys={};state.touch={};state.previewPunch=false;state.jumpQueued=false;state.punchQueued=false;setSelected("[data-mode]","data-mode",state.mode);
    $("#help").textContent="A / D move · Space jump · Hold F or the preview to punch. Abilities come from equipment.";
    if(state.mode==="play")world.focus({preventScroll:true});
  });
  $$("[data-resolution]").forEach(b=>b.onclick=()=>{state.resolution=Number(b.dataset.resolution);setSelected("[data-resolution]","data-resolution",state.resolution);});
  for(const key of ["rig","grid","fx","hover"])$("#"+key).onchange=e=>{state[key]=e.target.checked;updateRig(0);};
  $("#environment").onchange=e=>state.environment=e.target.value;
  $("#pause").onclick=()=>{state.paused=!state.paused;updatePause();};
  $("#step").onclick=()=>{state.paused=true;step(1000/60);updatePause();updateTelemetry(renderAvatar());};
  $("#reset").onclick=()=>{reset();notify("Player and animation clocks reset.");};
  $("#speed").onchange=e=>state.speed=Number(e.target.value);
  $("#about").onclick=$("#details").onclick=()=>$("#reference-dialog").showModal();
  $("#close-dialog").onclick=()=>$("#reference-dialog").close();
  $("#reference-dialog").addEventListener("click",e=>{if(e.target===$("#reference-dialog")){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $("#export").onclick=()=>{
    try{
      renderAvatar();
      const a=document.createElement("a");a.download=`growtopia-reference-${state.resolution}px-tile.png`;a.href=avatar.toDataURL("image/png");a.click();
      notify(`Exported ${avatar.width} × ${avatar.height} PNG · ${state.resolution}px per tile.`);
    }catch{notify("Export blocked by image security. The preview remains available.");}
  };
  for(const [index,skin] of SKINS.entries()) {
    const button=document.createElement("button");button.className=`swatch${index===0?" selected":""}`;button.style.background=`rgb(${skin.rgb.slice(0,3).join(",")})`;
    button.setAttribute("aria-label",skin.name);button.setAttribute("aria-pressed",String(index===0));
    button.onclick=()=>{state.skin=skin.rgb;$$(".swatch").forEach(b=>{b.classList.toggle("selected",b===button);b.setAttribute("aria-pressed",String(b===button));});updateRig(0);};
    $("#skins").append(button);
  }
  const map={KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right",Space:"jump",KeyW:"jump",ArrowUp:"jump",KeyF:"punch"};
  document.addEventListener("keydown",e=>{
    if($("#reference-dialog").open||["INPUT","SELECT","TEXTAREA","BUTTON"].includes(e.target.tagName))return;
    if(map[e.code]&&state.mode==="play"){
      e.preventDefault();state.keys[map[e.code]]=true;
      if(!e.repeat&&map[e.code]==="jump")state.jumpQueued=true;
      if(!e.repeat&&map[e.code]==="punch")state.punchQueued=true;
    }
  });
  document.addEventListener("keyup",e=>{if(map[e.code])state.keys[map[e.code]]=false;});
  window.addEventListener("blur",()=>{state.keys={};state.touch={};state.previewPunch=false;state.jumpQueued=false;state.punchQueued=false;});
  document.addEventListener("visibilitychange",()=>{state.keys={};state.touch={};state.previewPunch=false;state.jumpQueued=false;state.punchQueued=false;lastTimestamp=0;remainder=0;});
  const aim=e=>{const r=world.getBoundingClientRect();state.aim={x:e.clientX-r.left,y:e.clientY-r.top};};
  world.onpointerdown=e=>{
    e.preventDefault();aim(e);state.previewPunch=true;state.punchUntil=state.clock+34;
    if(state.paused){state.paused=false;updatePause();}
    world.setPointerCapture(e.pointerId);world.focus({preventScroll:true});
  };
  world.onpointermove=e=>{if(state.previewPunch)aim(e);};
  const releasePunch=()=>{state.previewPunch=false;};
  world.onpointerup=releasePunch;world.onpointercancel=releasePunch;world.onlostpointercapture=releasePunch;
  $$("[data-control]").forEach(b=>{
    b.onpointerdown=e=>{
      e.preventDefault();state.mode="play";setSelected("[data-mode]","data-mode","play");
      state.touch[b.dataset.control]=true;
      if(b.dataset.control==="punch")state.aim=null;
      if(state.paused){state.paused=false;updatePause();}
      if(b.dataset.control==="jump")state.jumpQueued=true;
      if(b.dataset.control==="punch")state.punchQueued=true;
      $("#help").textContent="Hold arrows to move. Jump abilities depend on equipment. Hold Punch to repeat.";
      b.setPointerCapture(e.pointerId);
    };
    const release=()=>state.touch[b.dataset.control]=false;
    b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;
  });
  new ResizeObserver(resize).observe($("#viewport"));
  updatePause();icons();
}
async function init() {
  try{
    const response=await fetch("./catalog.json");if(!response.ok)throw Error("Catalog did not load");
    state.catalog=await response.json();
    const liftData=await (await fetch("./lift-profiles.json")).json();
    state.catalog.liftProfiles=Object.fromEntries(liftData.profiles.map(p=>[p.id,p]));
    const rendererResponse=await fetch("./renderer-data.json");
    if(!rendererResponse.ok)throw Error("Renderer XML data failed to load");
    state.catalog.renderers=(await rendererResponse.json()).scripts;
    state.nativeMetadata=await (await fetch("./native-metadata.json")).json();
    state.abilityRegistry=await (await fetch("./ability-registry.json")).json();
    // Original procedural reference art; native sprite art is not fabricated.
    const sheet=document.createElement("canvas");sheet.width=192;sheet.height=32;
    const g=sheet.getContext("2d");g.fillStyle="white";g.strokeStyle="white";g.lineWidth=2;
    g.fillRect(14,3,4,26);g.fillRect(3,14,26,4);
    g.beginPath();g.arc(48,16,10,0,Math.PI*2);g.stroke();g.fillRect(43,9,3,3);
    g.beginPath();g.moveTo(80,26);g.bezierCurveTo(53,9,76,0,80,11);
    g.bezierCurveTo(84,0,107,9,80,26);g.fill();
    g.fillRect(102,13,20,6);g.fillRect(128,13,32,6);
    g.fillRect(169,9,14,14);g.fillRect(173,5,6,22);
    atlases.set("reference-fx.png",registerAtlas(sheet));
    const names=["player_body_only.png","player_head.png","player_extraleg.png","player_feet.png","player_eyes.png",
      "player_arm.png","player_puncharm.png","player_sleeve.png","player_hair.png","player_hairhair.png",
      "player_shirt.png","player_pants.png","player_handitem.png","player_back.png","player_horsepants.png"];
    await Promise.all(names.map(loadAtlas));
    motion=new PreviewMotion();
    player=new PlannerPlayer(state.catalog);state.lastFrame=motion.snapshot();
    equipPreset("bare");$("#preset").value="bare";await Promise.all([...state.equipped.values()].map(ensureItemAssets));
    setupControls();reset();resize();state.ready=true;
    $("#loading").hidden=true;$("#loading").style.display="none";
    updateTelemetry(renderAvatar());requestAnimationFrame(animate);
    window.renderLab={getState:()=>({ready:state.ready,mode:state.mode,resolution:state.resolution,paused:state.paused,
      equipped:[...state.equipped.values()].map(i=>({id:i.id,name:i.name,slot:i.slot})),
      frame:state.lastFrame,pose:state.lastResult?.pose,drawCalls:state.lastResult?.calls.length,
      effectCount:state.lastResult.calls.filter(c=>c.xmlParticle||c.referenceFx).length,hiddenPasses:[...state.hiddenPasses],
      abilities:state.abilities,avatarBounds:state.avatarBounds,view:state.view,
      catalogItems:state.catalog.items.length,poseResolution:state.lastResult?.poseResolution,
      failedAtlases:[...failedAtlases],lift:state.lastResult?.lift,
      itemFrames:[...state.equipped.values()].map(i=>({id:i.id,animationState:i.animationState,gait:i.gait,petMotion:i.petMotion,pieces:i.pieces.map(p=>({
        atlas:p.a,sx:p.sx,sy:p.sy,sw:p.sw,sh:p.sh,alpha:p.o,add:!!p.add,scale:p.k}))}))})};
  }catch(error){
    console.error(error);$("#loading").textContent=`Unable to start: ${error.message}. Please reload.`;
  }
}
init();
