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
function openGap(seed,index) {
  const band=hash01(seed,index,0x68bc21eb);
  const detail=hash01(seed,index,0x02e5be93);
  // Deliberately uneven: occasional quick blinks, ordinary pauses, and longer
  // open-eye holds so the animation does not settle into a metronome.
  if(band<0.20)return Math.round(1800+detail*2500);        // 1.8–4.3s
  if(band<0.82)return Math.round(4300+detail*5200);        // 4.3–9.5s
  return Math.round(9800+detail*9000);                     // 9.8–18.8s
}
function makeBlink(seed,index,gap,salt) {
  const close=55+Math.floor(hash01(seed,index,salt^0x27d4eb2f)*26);
  const hold=65+Math.floor(hash01(seed,index,salt^0x165667b1)*41);
  const open=85+Math.floor(hash01(seed,index,salt^0xd3a2646c)*41);
  return {gap,close,hold,open,duration:close+hold+open};
}
function buildBlinkSchedule(seed) {
  const sequence=[];
  const earlyDoubleAt=(seed>>>0)%4;
  for(let index=0;index<SCHEDULE_GROUPS;index++) {
    sequence.push(makeBlink(seed,index,openGap(seed,index),0x27d4eb2f));
    // Guarantee one early paired blink, then allow occasional seeded repeats.
    // The short open gap makes the second closure clearly read as a double blink.
    if(index===earlyDoubleAt||hash01(seed,index,0x9e3779b9)<0.12) {
      const secondGap=70+Math.floor(hash01(seed,index,0x7f4a7c15)*110);
      sequence.push(makeBlink(seed,index,secondGap,0x94d049bb));
    }
  }
  return sequence;
}

// Sampling an absolute simulation clock keeps pause/export/frame-rate behavior stable.
// Randomness is generated once from the player's seed, never per display frame.
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
