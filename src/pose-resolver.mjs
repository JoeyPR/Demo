// Static poses must not override jump, fall or punch.
// Mounted airborne movement uses the player's own rig animation.
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
  const mountedAirborne=!!mounted&&locomotion.airborne&&!motion.punch;
  if(mounted) {
    // Hold the captured ride pose only while grounded. In the air, preserve
    // the player's jump/fall arm and foot motion; the ride item keeps its own
    // sequence and draw calls in the item renderer.
    if(!motion.punch&&!locomotion.airborne)
      mergeDefined(override,mounted.staticArmPose??mounted.pose);
    override.disableWalk=true;
    if(!locomotion.airborne) {
      override.backFoot=0;
      override.frontFoot=0;
    }
    evidence=mountedAirborne?"player-airborne-pose-while-mounted":"public-static-mount-fallback";
    owner=mounted.id;
  }
  const ordered=[...items].sort((a,b)=>(b.slot===3)-(a.slot===3));
  const move=motion.punch?"punch":motion.locomotion;
  for(const item of ordered) {
    // A cached item pose must not replace the player jump pose while riding.
    // The item's visual animation continues independently of this pose resolver.
    if(mountedAirborne)break;
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
