// The captured renderer closes the basic eyes with player_eyes.png cell (5,3),
// tinted to skin. Timing below is independent preview tuning, not native timing.
export const BLINK_LID = Object.freeze({atlas:"player_eyes.png",sx:160,sy:99,sw:32,height:5,y:3});
const CLOSE_MS=60,HOLD_MS=55,OPEN_MS=85,DURATION_MS=CLOSE_MS+HOLD_MS+OPEN_MS;
const BASE_GAPS=[4100,5200,3600,6100,4700,5500,3900,5800];
const jitter=(seed,index)=>{
  let n=Math.imul((seed|0)^Math.imul(index+1,0x9e3779b1),0x85ebca6b);
  n^=n>>>16;
  return (n>>>0)%701-350;
};

// Sampling an absolute simulation clock makes pauses, export samples and frame
// rates share the same blink. No display-frame randomness or unbounded history.
export function sampleBlink(clockMs,{enabled=true,seed=1,override}={}) {
  if(!enabled)return {phase:"open",closure:0};
  if(Number.isFinite(override)) {
    const closure=Math.max(0,Math.min(1,override));
    return {phase:closure===0?"open":closure===1?"closed":"closing",closure};
  }
  if(!Number.isFinite(clockMs)||clockMs<0)return {phase:"open",closure:0};
  const gaps=BASE_GAPS.map((gap,index)=>gap+jitter(seed,index));
  const period=gaps.reduce((sum,gap)=>sum+gap+DURATION_MS,0);
  let t=clockMs%period;
  for(const gap of gaps) {
    if(t<gap)return {phase:"open",closure:0};
    t-=gap;
    if(t<CLOSE_MS)return {phase:"closing",closure:t/CLOSE_MS};
    if(t<CLOSE_MS+HOLD_MS)return {phase:"closed",closure:1};
    if(t<DURATION_MS)return {phase:"opening",closure:1-(t-CLOSE_MS-HOLD_MS)/OPEN_MS};
    t-=DURATION_MS;
  }
  return {phase:"open",closure:0};
}

// The same lid footprint fits the existing idle, look-up, look-down and punch
// cells. Other authored faces keep their expression rather than gaining a
// mismatched mask. Face items, skin transformations and visibility still win.
export function blinkFitsFace(face=[0,0]) {
  return face[1]===0&&Number.isInteger(face[0])&&face[0]>=0&&face[0]<=4;
}
