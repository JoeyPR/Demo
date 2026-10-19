import { clamp, mod, lerpAngle } from "./math.mjs";

// Explicit tracks, never infer frameCount from transparent neighboring cells.
// keys = [[timeMs, ...channels]], interpolation applies only to requested channels.
export function sampleTrack(track, timeMs, angleChannels = new Set()) {
  if (!track?.keys?.length) return null;
  const keys=track.keys, last=keys.at(-1);
  const t=track.loop && track.period>0 ? mod(timeMs,track.period)
    : clamp(timeMs,keys[0][0],last[0]);
  let i=0;
  while(i+1<keys.length && keys[i+1][0]<=t) i++;
  const a=keys[i];
  const b=keys[i+1] ?? (track.loop&&!track.holdTail ? [track.period,...keys[0].slice(1)] : a);
  const f=b[0]>a[0] ? (t-a[0])/(b[0]-a[0]) : 0;
  return a.slice(1).map((v,c)=>track.stepChannels?.includes(c) ? v
    : angleChannels.has(c) ? lerpAngle(v,b[c+1],f)
    : v+(b[c+1]-v)*f);
}
export function sampleFrames(clip,timeMs) {
  if(!clip?.frames?.length) return null;
  const durations=clip.frames.map((_,i)=>clip.durations?.[i] ?? clip.frameMs ?? 175);
  if(durations.some(d=>!Number.isFinite(d)||d<=0)) throw Error("Invalid frame duration");
  const period=durations.reduce((a,b)=>a+b,0);
  let t=clip.loop===false ? clamp(timeMs,0,period-Number.EPSILON*period) : mod(timeMs,period);
  for(let i=0;i<durations.length;i++) {
    if(t<durations[i]) return clip.frames[i];
    t-=durations[i];
  }
  return clip.frames.at(-1);
}
// Events fire on crossings (previous,current], including skipped display frames.
export function crossedEvents(events,previous,current,period=0) {
  if(current<previous) throw Error("Seek requires restoring a checkpoint");
  const result=[];
  for(const event of events) {
    if(period<=0) {
      if(previous<event.at && event.at<=current) result.push({...event,time:event.at});
    } else {
      if(event.at<0 || event.at>=period) throw Error("Loop event outside period");
      const first=Math.max(0,Math.floor((previous-event.at)/period)+1);
      const last=Math.floor((current-event.at)/period);
      if(last-first>10000) throw Error("Event interval too large; restore checkpoint");
      for(let n=first;n<=last;n++) result.push({...event,time:event.at+n*period});
    }
  }
  return result.sort((a,b)=>a.time-b.time);
}
