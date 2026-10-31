// Normalize the available tile rules once, outside the render loop. Family
// selection still uses the verified local connection tables in land-system.
export function compileWorldRules(definitions) {
  const ids=Object.keys(definitions).map(Number).filter(id=>Number.isInteger(id)&&id>=0&&id<=65535);
  const length=Math.max(0,...ids)+1;
  const table={present:new Uint8Array(length),atlasX:new Uint16Array(length),atlasY:new Uint16Array(length),
    spread:new Uint8Array(length),collision:new Uint8Array(length),frames:new Uint16Array(length),
    frameMs:new Uint32Array(length),page:new Uint16Array(length),pages:[],definitions};
  const pages=new Map();
  for(const id of ids) {
    const def=definitions[id];
    if(def.unsupported)continue;
    const page=def.page||'tiles_page1';
    if(!pages.has(page)){pages.set(page,pages.size);table.pages.push(page);}
    table.present[id]=1;table.atlasX[id]=def.atlas?.[0]??0;table.atlasY[id]=def.atlas?.[1]??0;
    table.spread[id]=def.spread??1;table.collision[id]=def.collision??0;
    table.frames[id]=Math.max(1,def.animFrames??1);table.frameMs[id]=def.animMs??0;table.page[id]=pages.get(page);
  }
  return table;
}
