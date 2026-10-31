import {approach, approachAngle} from './math.mjs';

// Pose data recovered from emote state 13 in the supplied Set Planner bundle.
// Keep the avatar assembled from its existing body, eyes, feet and arm atlases;
// sleeves, held items and other attachments consume the same sampled pose.
// A 25ms pose step fits the supplied capture's arm timing more closely than
// display-rate stepping. This is capture calibration, not a client tick claim.
export const DANCE_FRAME_MS=25;
export const DANCE_SOURCE='Set Planner app.f9354b027b.js: emoteSet/emoteStep, state 13';

function initialState(startFacing) {
  return {turn:startFacing<0?3:1,facing:startFacing<0?-1:1,armSide:0,backAngle:0,frontAngle:0,
    foot:0,footTarget:1,turnElapsedMs:0};
}
function advance(state,dtMs) {
  const turn=state.turn;
  state.facing=turn>1?-1:1;
  const target=(turn|2)===2?(state.armSide===0?135:225):(state.armSide===1?315:45);
  const distance=Math.abs(target-state.backAngle);
  const amount=dtMs/1000*(distance>90&&distance<180?1000:560);
  state.backAngle=approachAngle(state.backAngle,target,amount);
  state.frontAngle=approachAngle(state.frontAngle,360-target,amount);
  state.foot=approach(state.foot,state.footTarget,dtMs/100);
  if(Math.abs(state.backAngle-target)<=1)state.armSide=1-state.armSide;
  if(state.foot===state.footTarget)state.footTarget=state.footTarget===-2?1:-2;
  state.turnElapsedMs+=dtMs;
  if(state.turnElapsedMs>=1000-1e-7) {
    state.turnElapsedMs=Math.max(0,state.turnElapsedMs-1000);
    state.turn=(turn+1)%4;
  }
  return state;
}
function poseOf(state,elapsedMs) {
  return {active:true,elapsedMs,facing:state.facing,turn:state.turn,
    backAngle:state.backAngle,frontAngle:state.frontAngle,
    backFoot:state.foot,frontFoot:state.foot,bodyY:-state.foot,face:[0,1]};
}

// Seeking and display frame rate must not alter the dance. Cache only complete
// fixed simulation steps and sample a copy for any fractional display frame.
export class DanceSampler {
  constructor(){this.reset();}
  reset(){this.state=null;this.frame=0;this.startFacing=1;}
  sample(elapsedMs=0,startFacing=1) {
    const time=Number.isFinite(elapsedMs)?Math.max(0,elapsedMs):0;
    const facing=startFacing<0?-1:1;
    const frame=Math.floor(time/DANCE_FRAME_MS+1e-8);
    if(!this.state||facing!==this.startFacing||frame<this.frame) {
      this.state=initialState(facing);this.frame=0;this.startFacing=facing;
    }
    while(this.frame<frame){advance(this.state,DANCE_FRAME_MS);this.frame++;}
    const fractional=Math.max(0,time-frame*DANCE_FRAME_MS);
    const sampled=fractional>1e-7?advance({...this.state},fractional):this.state;
    return poseOf(sampled,time);
  }
}
export function sampleDance(elapsedMs=0,{startFacing=1}={}) {
  return new DanceSampler().sample(elapsedMs,startFacing);
}
export function sampleTalkingFace(elapsedMs=0) {
  const time=Number.isFinite(elapsedMs)?Math.max(0,elapsedMs):0;
  return [time%300<100?6:5,1];
}
