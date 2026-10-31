// Browser-only adapter; the engine itself does not depend on DOM.
export function extractSpritePixels(rgba,width,height,call) {
  const out=new Uint8ClampedArray(call.sw*call.sh*4);
  const edge=call.sx+call.sw>width||call.sy+call.sh>height;
  for(let y=0;y<call.sh;y++)for(let x=0;x<call.sw;x++) {
    if(!edge&&(call.sx+x<0||call.sy+y<0))continue;
    const bound=(n,size)=>edge?(call.pet?((n%size)+size)%size:Math.max(0,Math.min(size-1,n))):n;
    const sx=bound(call.sx+x,width),sy=bound(call.sy+y,height),index=(sy*width+sx)*4;
    out.set(rgba.subarray(index,index+4),(y*call.sw+x)*4);
  }
  return out;
}
export function makeCanvas(width,height) {
  if(typeof OffscreenCanvas!=="undefined") return new OffscreenCanvas(width,height);
  if(typeof document==="undefined") throw Error("A Canvas factory is required in Node");
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;return canvas;
}
export function tintPixelBuffer(rgba,tint,palette) {
  for(let p=0;p<rgba.length;p+=4) {
    if(palette) {
      const high=Math.max(rgba[p],rgba[p+1],rgba[p+2]),low=Math.min(rgba[p],rgba[p+1],rgba[p+2]);
      if(!rgba[p+3]||high-low>2)continue;
      const color=palette[high<=172?0:high<=190?1:high<=209?2:3];
      for(let c=0;c<3;c++)rgba[p+c]=color[c];
    } else for(let c=0;c<3;c++)rgba[p+c]=Math.round(rgba[p+c]*tint[c]/255);
  }
  return rgba;
}
export function registerAtlas(image,{pixelsPerUnit=1,canvasFactory=makeCanvas,maxTintedCrops=512}={}) {
  const cache=new Map(),edgeCache=new Map();
  let sourcePixels=null;
  const sampleCrop=call=>{
    const width=image.naturalWidth??image.width,height=image.naturalHeight??image.height;
    const key=JSON.stringify([call.sx,call.sy,call.sw,call.sh,!!call.pet]);
    if(edgeCache.has(key))return edgeCache.get(key);
    const canvas=canvasFactory(call.sw,call.sh),ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(call.sx<0||call.sy<0||call.sx+call.sw>width||call.sy+call.sh>height) {
      if(!sourcePixels) {
        const source=canvasFactory(width,height),s=source.getContext("2d",{willReadFrequently:true});
        s.drawImage(image,0,0);sourcePixels=s.getImageData(0,0,width,height).data;
      }
      const pixels=ctx.createImageData(call.sw,call.sh);
      pixels.data.set(extractSpritePixels(sourcePixels,width,height,call));ctx.putImageData(pixels,0,0);
    }else ctx.drawImage(image,call.sx,call.sy,call.sw,call.sh,0,0,call.sw,call.sh);
    if(edgeCache.size>=maxTintedCrops)edgeCache.delete(edgeCache.keys().next().value);
    edgeCache.set(key,canvas);return canvas;
  };
  return {
    image,pixelsPerUnit,sampleCrop,
    tintedCrop(call) {
      const key=JSON.stringify([call.sx,call.sy,call.sw,call.sh,call.tint,call.skinPalette]);
      if(cache.has(key)) return cache.get(key);
      const canvas=canvasFactory(call.sw,call.sh),ctx=canvas.getContext("2d",{willReadFrequently:true});
      ctx.drawImage(sampleCrop(call),0,0);
      const pixels=ctx.getImageData(0,0,call.sw,call.sh),rgba=pixels.data;
      // Deliberately preserve every source alpha byte, including transparent RGB.
      tintPixelBuffer(rgba,call.tint,call.skinPalette);
      ctx.putImageData(pixels,0,0);
      if(cache.size>=maxTintedCrops) cache.delete(cache.keys().next().value);
      cache.set(key,canvas);return canvas;
    },
    clearTintCache(){cache.clear();}
  };
}
export function createRenderSurface(width,height,{supersample=1,canvasFactory=makeCanvas}={}) {
  if(![1,2,4].includes(supersample)) throw Error("supersample must be 1/2/4");
  const working=canvasFactory(width*supersample,height*supersample);
  const output=canvasFactory(width,height);
  return {working,output,context:working.getContext("2d"),resolve(){
    const ctx=output.getContext("2d");
    ctx.clearRect(0,0,width,height);
    // Intentional resolve filtering, distinct from nearest source-sprite sampling.
    ctx.imageSmoothingEnabled=supersample>1;
    ctx.drawImage(working,0,0,width,height);return output;
  }};
}
