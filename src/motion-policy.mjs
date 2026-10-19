// Explicit semantic rules. Texture dimensions never determine an action.
// The float-arm and ground/air corrections implement the user's observations.
const ELEPHANT_FLAP_FAMILY=new Set([7836,7838,7840,7842]);
// Explicit user-observed families, not inferred from negative rider offsets.
export const FLOATING_MOUNT_IDS=new Set([3788,2048,2064]);
export function locomotionState(motion={}) {
  const airborne=motion.ground===false||["jump","fall","glide"].includes(motion.locomotion);
  return {airborne,moving:motion.locomotion==="walk"||Math.abs(motion.vx??0)>1,
    state:airborne?motion.locomotion==="jump"?"jump":motion.locomotion==="glide"?"glide":"fall":
      motion.locomotion==="walk"||Math.abs(motion.vx??0)>1?"walk":"idle"};
}
export function isFloatingItem(item) {
  const authored=item.floatBehavior?.enabled??item.raw?.floatBehavior?.enabled;
  if(authored!==undefined)return !!authored;
  if(FLOATING_MOUNT_IDS.has(item.id))return true;
  const hover=item.renderer?.options?.ShouldHover??item.raw?.gameOptions?.ShouldHover;
  if(hover===true||hover==="true")return true;
  if(item.liftProfile?.publicStillAgrees&&item.liftProfile.amplitude!==0)return true;
  // Known floating renderer families, not every item with a negative shoe offset.
  return ["Cumulus","JusticeLens"].includes(item.raw?.script);
}
export function sequencePolicy(item,part) {
  if(part.animationPolicy)return part.animationPolicy;
  if(item.raw?.animationPolicy)return item.raw.animationPolicy;
  if(ELEPHANT_FLAP_FAMILY.has(item.id))return "air";
  if(item.vehicle&&!isFloatingItem(item))return "travel";
  return "ambient";
}
export function sequenceTime(item,timeMs,motion={}) {
  const locomotion=locomotionState(motion),state=locomotion.state;
  const group=locomotion.airborne?"air":locomotion.moving?"travel":"idle";
  const previous=item.motionPlayback;
  if(!previous||previous.group!==group||timeMs<previous.lastMs) {
    item.motionPlayback={state,group,startedMs:timeMs,lastMs:timeMs};
  }else {previous.lastMs=timeMs;previous.state=state;}
  return {...locomotion,elapsedMs:Math.max(0,timeMs-item.motionPlayback.startedMs)};
}
export function sampleSequenceIndex(sequence,playback,timeMs,still=false) {
  if(sequence.policy==="air")return playback.airborne?
    Math.floor(playback.elapsedMs/sequence.ms)%sequence.frames.length:0;
  if(sequence.policy==="travel")return playback.state==="walk"?
    Math.floor(playback.elapsedMs/sequence.ms)%sequence.frames.length:0;
  return still?0:Math.floor(timeMs/sequence.ms)%sequence.frames.length;
}
