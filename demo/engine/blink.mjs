// The captured renderer closes the basic eyes with player_eyes.png cell (5,3),
// tinted to skin. Timing below is independent preview tuning, not native timing.
export const BLINK_LID = Object.freeze({atlas:"player_eyes.png",sx:160,sy:99,sw:32,height:5,y:3});

const SCHEDULE_GROUPS=64;
const hash01=(seed,index,salt)=>{
  let value=Math.imul((seed|0)^Math.imul(index+1,0x9e3779b1)^salt,0x85ebca6b);
  value^=value>>>16;
  value=Math.imul(value,0xc2b2ae35);
  value^=value>>>13;
  return (value>>>0)/4294967296;
};
const triangular=(seed,index,salt)=>
  (hash01(seed,index,salt)+hash01(seed,index,salt^0x02e5be93))/2;

function makeBlink(seed,index,gap,salt) {
  const close=55+Math.floor(hash01(seed,index,salt^0x27d4eb2f)*25);
  const hold=55+Math.floor(hash01(seed,index,salt^0x165667b1)*45);
  const open=80+Math.floor(hash01(seed,index,salt^0xd3a2646c)*50);
  return {gap,close,hold,open,duration:close+hold+open};
}
function buildBlinkSchedule(seed) {
  const sequence=[];
  for(let index=0;index<SCHEDULE_GROUPS;index++) {
    // Most open intervals cluster around 4-5 seconds, with natural short/long variation.
    const gap=Math.round(2200+triangular(seed,index,0x68bc21eb)*5000);
    sequence.push(makeBlink(seed,index,gap,0x27d4eb2f));
    // A subtle second blink occurs occasionally, like a human double-blink.
    if(hash01(seed,index,0x9e3779b9)<0.13) {
      const secondGap=100+Math.floor(hash01(seed,index,0x7f4a7c15)*140);
      sequence.push(makeBlink(seed,index,secondGap,0x94d049bb));
    }
  }
  return sequence;
}

// Sampling an absolute simulation clock keeps pauses, exports and frame rates aligned.
// No frame-by-frame randomness or unbounded event history is used.
export function sampleBlink(clockMs,{enabled=true,seed=1,override}={}) {
  if(!enabled)return {phase:"open",closure:0};
  if(Number.isFinite(override)) {
    const closure=Math.max(0,Math.min(1,override));
    return {phase:closure===0?"open":closure===1?"closed":"closing",closure};
  }
  if(!Number.isFinite(clockMs)||clockMs<0)return {phase:"open",closure:0};
  const normalizedSeed=Number.isFinite(seed)?Math.trunc(seed)|0:1;
  const sequence=buildBlinkSchedule(normalizedSeed);
  const period=sequence.reduce((sum,event)=>sum+event.gap+event.duration,0);
  let t=clockMs%period;
  for(const event of sequence) {
    if(t<event.gap)return {phase:"open",closure:0};
    t-=event.gap;
    if(t<event.close)return {phase:"closing",closure:t/event.close};
    t-=event.close;
    if(t<event.hold)return {phase:"closed",closure:1};
    t-=event.hold;
    if(t<event.open)return {phase:"opening",closure:1-t/event.open};
    t-=event.open;
  }
  return {phase:"open",closure:0};
}

// The same lid footprint fits existing idle/look-up/look-down/punch cells.
// Other authored faces retain their expression rather than gaining a mismatched mask.
export function blinkFitsFace(face=[0,0]) {
  return face[1]===0&&Number.isInteger(face[0])&&face[0]>=0&&face[0]<=4;
}
