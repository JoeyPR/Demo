import {point} from "./math.mjs";

// Shared by preview and PNG export. Nothing is cropped to the player's tile.
// Keep the historical 128-unit minimum export, expand for fists/pets/large FX.
export function drawBounds(calls,padding=4) {
  let left=-48,top=-48,right=80,bottom=80;
  for(const c of calls) {
    if(c.line) {
      const pad=padding+(c.line.width??1)/2;
      for(const v of [c.line.from,c.line.to]) {
        const [x,y]=point(c.matrix,v);
        if(!Number.isFinite(x)||!Number.isFinite(y))continue;
        left=Math.min(left,Math.floor(x-pad));top=Math.min(top,Math.floor(y-pad));
        right=Math.max(right,Math.ceil(x+pad));bottom=Math.max(bottom,Math.ceil(y+pad));
      }
      continue;
    }
    const ppu=c.sourcePixelsPerUnit??1;
    for(const v of [[0,0],[c.sw/ppu,0],[0,c.sh/ppu],[c.sw/ppu,c.sh/ppu]]) {
      const [x,y]=point(c.matrix,v);
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      left=Math.min(left,Math.floor(x-padding));top=Math.min(top,Math.floor(y-padding));
      right=Math.max(right,Math.ceil(x+padding));bottom=Math.max(bottom,Math.ceil(y+padding));
    }
  }
  return {x:left,y:top,width:right-left,height:bottom-top};
}
