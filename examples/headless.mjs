// Runnable integration smoke example. No real item data or textures are bundled.
import { PlannerPlayer } from "../src/player.mjs";
import { PreviewMotion } from "../src/motion.mjs";
import { PLANNER_PROFILE } from "../src/planner-profile.mjs";
const catalog={tile:32,frameMs:175,arm:PLANNER_PROFILE.arm,items:[],slotOffset:{}};
const player=new PlannerPlayer(catalog),motion=new PreviewMotion({doubleJump:true});
let frame,rendered;
for(let i=0;i<90;i++) {
  frame=motion.step(1000/60,{right:i<30,jump:i>=30&&i<40,punch:i===50});
  rendered=player.step(frame,1000/60);
}
console.log(JSON.stringify({
  note:"Headless draw-command smoke test, not a Growtopia image",
  motion:{x:frame.x,y:frame.y,locomotion:frame.locomotion},
  pose:rendered.pose,drawCalls:rendered.calls.length,
  passes:rendered.calls.map(c=>c.pass)
},null,2));
