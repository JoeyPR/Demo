import { PlayerRig } from "./rig.mjs";
import { runHook } from "./script-vm.mjs";
import { buildDrawList } from "./render.mjs";
import { resolveItemPose } from "./pose-resolver.mjs";
import { resolvePlayerLift } from "./lift.mjs";
import { advanceCatalogItem } from "./catalog-adapter.mjs";
import {ItemEffects,punchEffectOwner} from "./item-fx.mjs";

// Integration entry point for Claude: supply catalog, items and MotionFrames.
export class PlannerPlayer {
  constructor(catalog,items=[]) {this.catalog=catalog;this.items=items;this.rig=new PlayerRig();this.lastEvents=new Set();this.effects=new ItemEffects();}
  equip(items) {this.items=items;this.lastEvents.clear();this.effects.reset();}
  step(motion,dtMs,visual={}) {
    motion={...motion,renderContext:{equippedIds:this.items.map(i=>i.id),...visual.renderContext}};
    // One MotionFrame owns body, clothes and attachments, never separate clocks.
    for(const item of this.items)if(item.referencePieces)
      advanceCatalogItem(item,motion.clockMs,motion);
    const resolution=resolveItemPose(this.items,motion,visual);
    let override={...resolution.override},extraPieces=[],dynamicHide=new Map();
    const context={locomotion:motion.locomotion,ground:motion.ground,
      facing:motion.facing,clockMs:motion.clockMs,moveMs:motion.moveMs,
      punching:!!motion.punch,jumpHeld:!!motion.jumpHeld};
    const emits=[];
    for(const item of this.items) {
      const hooks=[item.hooks?.update];
      for(const event of motion.events??[]) {
        const key=`${item.id}:${event.id}`;
        if(!this.lastEvents.has(key)) {
          this.lastEvents.add(key);hooks.push(item.hooks?.[event.type]);
        }
      }
      if(this.lastEvents.size>10000) throw Error("Restore/reset event checkpoint");
      for(const hook of hooks) {
        const out=runHook(hook,context);
        override={...override,...out.pose};
        dynamicHide.set(item.id,[...(dynamicHide.get(item.id)??[]),...out.hide]);
        // Hook pieces use normalized draw calls, unlike catalog icon records.
        extraPieces.push(...out.pieces);
        emits.push(...out.emit.map(id=>({itemId:item.id,emitterId:id})));
      }
    }
    const pose=this.rig.update(motion,dtMs,override);
    const shotOwner=motion.punch&&punchEffectOwner(this.items);
    if(shotOwner){
      pose.punch=null;pose.backAngle=shotOwner.staticArmPose?.backAngle??0;
      const target=motion.punch.target??[64,16];
      pose.frontAngle=shotOwner.slot===5?
        (Math.atan2(-(target[0]-9),target[1]-18)*180/Math.PI+360)%360:
        shotOwner.staticArmPose?.frontAngle??0;
    }
    const items=this.items.map(item=>({...item,hide:[...(item.hide??[]),...(dynamicHide.get(item.id)??[])]}));
    const lift=resolvePlayerLift(items,motion.clockMs,visual);
    const gait=this.items.find(i=>i.gait?.active)?.gait;
    if(gait&&!lift.floating){lift.y+=gait.bodyY;lift.gait=gait;}
    const calls=buildDrawList({motion,pose,items,catalog:this.catalog,visual:{...visual,playerLift:lift},extraPieces});
    // ITEM_FX_RECIPES are procedural look-alikes, not extracted native effects: opt-in only (visual.approximateFx).
    if(visual.effects!==false&&visual.approximateFx===true)calls.push(...this.effects.step(this.items,motion,calls,lift));
    return {pose,emits,poseResolution:resolution,lift,warnings:this.items.flatMap(i=>i.warnings??[]),calls};
  }
}
