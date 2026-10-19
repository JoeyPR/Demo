// Recovered profiles use isolated source arithmetic for default actor state.
// Unknown hover curves use separately labelled reference fallbacks below.
import {isFloatingItem,FLOATING_MOUNT_IDS} from "./motion-policy.mjs";
export function sampleLiftProfile(profile,timeMs,{bob=true}={}) {
  if(!profile?.publicStillAgrees&&!profile?.reference)return null;
  const sine=Math.fround(Math.sin(
    Math.fround((Math.trunc(timeMs)%profile.periodMs)/profile.periodMs)*Math.PI*2));
  return Math.fround(profile.base+(bob?profile.amplitude*sine:0));
}
export function resolvePlayerLift(items,timeMs,options={}) {
  const floating=items.some(isFloatingItem)||!!options.forceFloat;
  if(options.forceFloat) {
    const generic={base:-5,amplitude:2,periodMs:1000,publicStillAgrees:true};
    const y=sampleLiftProfile(generic,timeMs,options);
    return {x:0,y,owner:null,floating:true,vehicleY:y-generic.base,
      evidence:"manual-generic-reference",profile:{base:-5,amplitude:2,periodMs:1000},
      outfitInteractionsVerified:false};
  }
  const feet=items.find(i=>i.slot===3&&i.vehicle);
  const candidates=feet?[feet,...items.filter(i=>i!==feet)]:items;
  const owner=candidates.find(i=>i.liftProfile?.publicStillAgrees&&
    (i.liftProfile.amplitude!==0||i.riderLift!==undefined))??
    candidates.find(i=>i.riderLift!==undefined)??candidates.find(isFloatingItem);
  if(!owner)return {x:0,y:0,owner:null,evidence:"none",profile:null,floating};
  // A shared bounded bob when hover is known but its curve is unavailable.
  // Do not label these coefficients native or replace recovered source curves.
  const referenceFloat=floating&&!(owner.liftProfile?.publicStillAgrees&&owner.liftProfile.amplitude);
  const profile=referenceFloat?
    {base:owner.riderLift??owner.liftProfile?.base??0,amplitude:1,periodMs:1000,
      reference:true,publicStillAgrees:false}:owner.liftProfile;
  const sampled=sampleLiftProfile(profile,timeMs,options);
  return {x:owner.riderShiftX??0,y:sampled??owner.riderLift??0,owner:owner.id,
    floating,
    vehicleY:owner===feet&&sampled!==null?sampled-profile.base:0,
    evidence:referenceFloat?(FLOATING_MOUNT_IDS.has(owner.id)?"user-observed-float-reference":"reference-float-fallback"):
      sampled!==null?"source-helper-default-state":"captured-static-lift",
    profile:sampled!==null?{base:profile.base,amplitude:profile.amplitude,periodMs:profile.periodMs}:null,
    outfitInteractionsVerified:!referenceFloat&&items.filter(i=>i.liftProfile||i.riderLift!==undefined).length<=1};
}
