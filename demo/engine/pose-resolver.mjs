// Static public poses must not overwrite jump, fall or punch on normal items.
// A supplied per-state descriptor outranks our explicitly labeled mount fallback.
import {isFloatingItem,locomotionState} from "./motion-policy.mjs";
export function resolveItemPose(items,motion,visual={}) {
  const mergeDefined=(target,source)=>Object.assign(target,
    Object.fromEntries(Object.entries(source??{}).filter(([,v])=>v!==undefined)));
  const mounted=items.find(i=>i.slot===3&&i.vehicle);
  const locomotion=locomotionState(motion);
  const floatOwner=items.find(isFloatingItem);
  const floating=!!floatOwner||!!visual.forceFloat;
  const state=motion.punch?(mounted?"ridingpunch":"punch"):
    locomotion.airborne?(mounted?"ridingair":locomotion.state):
    mounted?(locomotion.moving?"ridingmove":"ridingstill"):
    floating?(locomotion.moving?"floatingmove":"floatingstill"):locomotion.state;
  let override={},evidence="base-planner-rig",owner=null;
  const neutral=!motion.punch&&["idle","stop",undefined,null,""].includes(motion.locomotion);
  if(neutral)for(const item of items) {
    if(motion.locomotion==="stop"&&item.raw?.moves?.stop)continue;
    mergeDefined(override,item.staticArmPose??item.pose);
  }
  if(mounted) {
    // No recovered native riding clip: hold authored still arms when available.
    // Do not invent motorcycle handlebar angles when the public data has none.
    if(!motion.punch)mergeDefined(override,mounted.staticArmPose??mounted.pose);
    override.disableWalk=true;override.backFoot=0;override.frontFoot=0;
    evidence="public-static-mount-fallback";owner=mounted.id;
  }
  const ordered=[...items].sort((a,b)=>(b.slot===3)-(a.slot===3));
  const move=motion.punch?"punch":motion.locomotion;
  for(const item of ordered) {
    const pose=item.statePoses?.[state]??item.statePoses?.[move];
    if(!pose)continue;
    mergeDefined(override,typeof pose==="function"?pose(motion):pose);
    owner=item.id;evidence="supplied-state-descriptor";break;
  }
  if(floating&&!locomotion.airborne&&!motion.punch&&evidence!=="supplied-state-descriptor") {
    override.floatArms={
      back:locomotion.moving?-45:(override.backAngle??0),
      front:locomotion.moving?45:(override.frontAngle??0),
      degreesPerSecond:floatOwner?.floatBehavior?.armSpeed??900
    };
    delete override.backAngle;delete override.frontAngle;
    override.disableWalk=true;override.backFoot=0;override.frontFoot=0;
    evidence="user-specified-moving-float-arms";owner=floatOwner?.id??null;
  }
  return {override,state,evidence,owner,floating};
}
