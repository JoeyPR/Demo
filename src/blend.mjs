// Step 8: blend modes. The atlas PNGs are STRAIGHT alpha (not premultiplied) [DATA]. The game's PREMULTIPLIED_ALPHA particles are
// drawn with glBlendFunc(ONE, ONE_MINUS_SRC_ALPHA). What the game really does with straight art is unknown until the user's capture
// arrives, so the choice is ONE constant plus a runtime switch.
//   "off"  legacy: every non-additive call is plain source-over on the straight pixels (what the demo did before step 8). DEFAULT.
//   "A"    premultiply once (rgb *= a) into a cached offscreen crop, then source-over.            out = rgb*a*a + dst*(1-a)
//   "B"    emulate ONE, ONE_MINUS_SRC_ALPHA on straight RGB (no division, no premultiply of the art): out = rgb + dst*(1-a)
//          canvas plan: destination-out with the sprite's alpha, then 'lighter' with the sprite's RGB at full alpha.
// ADDITIVE stays 'lighter'. NORMAL / PREMULTIPLIED_NORMAL stay source-over in every mode.
export const BLEND_MODES=["off","A","B"];
export const BLEND_PREMULT_MODE="off";
let current=BLEND_PREMULT_MODE;
export const getBlendPremultMode=()=>current;
export function setBlendPremultMode(mode) {
  if(!BLEND_MODES.includes(mode))throw Error(`BLEND_PREMULT_MODE must be one of ${BLEND_MODES.join("/")}`);
  current=mode;return current;
}
// The XML Particle blendingMode -> the planner's three draw kinds.
export const BLEND_KIND={ADDITIVE:"additive",PREMULTIPLIED_ALPHA:"premult",PREMULTIPLIED_NORMAL:"normal",NORMAL:"normal"};
export const blendKindOf=name=>BLEND_KIND[name]??"normal";
// The kind a draw call carries: explicit blend wins, then the legacy add flag, else normal.
export const callBlend=call=>call.blend??(call.add?"additive":"normal");
// Ordered canvas operations for one draw call. Each step: {op: "source-over"|"lighter"|"destination-out", crop: "plain"|"premult"|"opaque"}.
// The same list is executed by drawCanvas and simulated in tests.
export function blendPlan(call,mode=current) {
  const kind=callBlend(call);
  if(kind==="additive")return [{op:"lighter",crop:"plain"}];
  if(kind==="premult"&&mode==="A")return [{op:"source-over",crop:"premult"}];
  if(kind==="premult"&&mode==="B")return [{op:"destination-out",crop:"plain"},{op:"lighter",crop:"opaque"}];
  return [{op:"source-over",crop:"plain"}];
}
// Pixel helpers used by the atlas adapter (browser) and by tests (Node).
export function premultiplyPixels(rgba) {
  const out=new Uint8ClampedArray(rgba.length);
  for(let i=0;i<rgba.length;i+=4){const a=rgba[i+3]/255;out[i]=Math.round(rgba[i]*a);out[i+1]=Math.round(rgba[i+1]*a);out[i+2]=Math.round(rgba[i+2]*a);out[i+3]=rgba[i+3];}
  return out;
}
// B's RGB layer: the straight RGB untouched, alpha forced opaque so 'lighter' adds exactly rgb (no division, no multiplication).
export function opaqueRgbPixels(rgba) {
  const out=new Uint8ClampedArray(rgba);
  for(let i=3;i<out.length;i+=4)out[i]=255;
  return out;
}
