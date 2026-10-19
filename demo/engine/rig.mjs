import { around, compose, translate, rotate, scale, approach, approachAngle } from "./math.mjs";
import { sampleTrack } from "./animation.mjs";
import { PLANNER_PROFILE } from "./planner-profile.mjs";

// Stateful because jump/fall transitions approach targets from the previous pose.
// Feed fixed simulation dt, NOT display-frame dt. dtMs and all clocks are milliseconds.
export class PlayerRig {
  constructor(profile=PLANNER_PROFILE) {
    this.profile=profile;
    this.pose={backAngle:0,frontAngle:0,backFoot:0,frontFoot:0,face:[0,0]};
  }
  update(motion,dtMs,override={}) {
    const dt=dtMs/1000, p=this.pose;
    const previousArms={back:p.backAngle,front:p.frontAngle};
    const mode=motion.locomotion;
    if(mode==="walk" && !override.disableWalk) {
      const arms=sampleTrack(this.profile.armTracks.walk,motion.moveMs,new Set([0,1]));
      const feet=sampleTrack(this.profile.footTracks.walk,motion.moveMs);
      [p.backAngle,p.frontAngle]=arms;
      [p.backFoot,p.frontFoot]=feet;
      p.face=[0,0];
    } else if(["jump","fall","glide"].includes(mode)) {
      const rising=mode==="jump", target=rising || (mode==="glide" && override.glideArms!==false) ? 200 : 330;
      p.backAngle=approachAngle(p.backAngle,target,(rising?900:200)*dt);
      p.frontAngle=approachAngle(p.frontAngle,target,(rising?900:200)*dt);
      p.backFoot=approach(p.backFoot,rising?1:-2,30*dt);
      p.frontFoot=approach(p.frontFoot,rising?1:-2,30*dt);
      p.face=[rising?1:2,0];
    } else {
      Object.assign(p,{backAngle:0,frontAngle:0,backFoot:0,frontFoot:0,face:[0,0]});
    }
    if(override.floatArms&&!motion.punch) {
      const f=override.floatArms;
      p.backAngle=approachAngle(previousArms.back,f.back,f.degreesPerSecond*dt);
      p.frontAngle=approachAngle(previousArms.front,f.front,f.degreesPerSecond*dt);
    }
    // Punch is an overlay, so air state and item locomotion remain available.
    p.punch=null;
    if(motion.punch) {
      const punch=motion.punch;
      if(punch.pose) {
        const k=sampleTrack(punch.pose,punch.ageMs,new Set([0,1]));
        [p.backAngle,p.frontAngle]=k;
        if(k.length>=4) p.punch={angle:k[0],width:k[2],stretch:k[3]};
      } else {
        // Restore the Set Planner generic punch, not a replacement easing curve.
        // Pointer aiming changes direction/reach, never its expansion timing.
        const target=punch.target??[64,16];
        const dx=target[0]-24,dy=target[1]-18;
        const t=Math.max(0,punch.ageMs)/1000;
        const angle=((Math.atan2(-dx,dy)*180/Math.PI)+360)%360;
        p.punch={angle,stretch:Math.max(2,Math.min(192,Math.hypot(dx,dy)))*t*.106,
          width:Math.min(1.8,7.43*t)};
        p.backAngle=angle;
        p.frontAngle=punch.ageMs<=dtMs?90:previousArms.front;
        p.frontAngle=approachAngle(p.frontAngle,20,900*dt);
      }
      p.face=[4,0];
    }
    for(const k of ["backAngle","frontAngle","backFoot","frontFoot","face"])
      if(override[k]!==undefined) p[k]=override[k];
    return structuredClone(p);
  }
}
export function armMatrix(side,angle,profile=PLANNER_PROFILE) {
  return around(side==="back" ? profile.origins.back : profile.origins.front,rotate(angle));
}
export function heldMatrix(side,angle,referenceAngle=0,profile=PLANNER_PROFILE) {
  const pivot=[...(side==="back"?profile.origins.back:profile.origins.front)];
  pivot[1]+=1;
  return around(pivot,rotate(angle-referenceAngle));
}
export function punchMatrix(punch,profile=PLANNER_PROFILE) {
  const [x,y]=profile.arm.back;
  return compose(translate(x+profile.arm.w/2,y),rotate(punch.angle),
    scale(punch.width ?? 1,punch.stretch ?? 1),translate(-10,0));
}
export function playerRoot(motion,visual={},profile=PLANNER_PROFILE) {
  // Facing reflection occurs exactly once, in logical 32-pixel coordinates.
  const facing=motion.facing<0 ? [-1,0,0,1,32,0] : [1,0,0,1,0,0];
  return compose(translate(motion.x??0,motion.y??0),
    around([16,32],scale(visual.scaleX??1,visual.scaleY??visual.scaleX??1)),facing);
}
