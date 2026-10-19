import {locomotionState} from "./motion-policy.mjs";
// Source-assisted public petCells clocks; follower motion is an explicitly
// bounded reference, not complete native AI/perching/combat behavior.
export function advancePet(item,timeMs,motion) {
  if(item.vehicle)return;
  const pieces=item.pieces.filter(p=>p.pet||p.pass==="RenderPet");
  if(!pieces.length)return;
  const ownerState=locomotionState(motion),prev=item.petMotion;
  const dt=prev?Math.max(0,Math.min(100,timeMs-prev.timeMs)):0;
  const origin=motion.worldX??motion.x??0;
  const target=origin+(motion.facing<0?56:-24);
  const worldX=(prev?.worldX??target)+(target-(prev?.worldX??target))*(1-Math.exp(-dt/160));
  const originY=motion.worldY??motion.y??0;
  const worldY=(prev?.worldY??originY)+(originY-(prev?.worldY??originY))*(1-Math.exp(-dt/180));
  const x=worldX-origin;
  // A pet that is still catching up must not snap to its owner's idle cell.
  const catchingUp=Math.abs(target-worldX)>1.5;
  const moving=ownerState.moving||catchingUp;
  const state={...ownerState,moving,state:ownerState.airborne?ownerState.state:moving?"walk":"idle"};
  const dx=prev?worldX-prev.worldX:0;
  const facing=Math.abs(dx)>.05?Math.sign(dx):prev?.facing??motion.facing??1;
  item.petMotion={x,worldX,worldY,timeMs,state:state.state,facing,catchingUp};
  const cells=item.raw.petCells?.[state.airborne?(state.state==="jump"?"rise":"fall"):state.moving?"move":"stand"];
  const part=item.raw.parts?.find(p=>p.pet),frames=cells?.cells??part?.frames;
  const size=part?.cell??item.raw.cell??[1,1,0];
  const total=cells?.ms;
  const index=frames?.length?Math.floor(total?((timeMs%total)/total)*frames.length:timeMs/(part.ms??175))%frames.length:0;
  for(const p of pieces) {
    if(frames?.length){p.sx=frames[index][0]*size[0]*32;p.sy=frames[index][1]*size[1]*32;}
    // x is world-facing relative to the player; undo the one player reflection.
    p.x=motion.facing<0?32-x:x;
    // Retain the pet's own heading through owner reversals. The parent reflects
    // once, so undo only the relative heading rather than reflecting twice.
    if(facing!==(motion.facing<0?-1:1))p.k=[-(p.k?.[0]??1),p.k?.[1]??1];
    p.y+=worldY-originY;
    if(item.raw.petOffset)p.y+=item.raw.petOffset[1];
    // Generic walk cells are source-sampled only for ordinary walking-pet type 0.
    if(!frames?.length&&item.raw.petType===0) {
      const cell=state.airborne?(state.state==="jump"?3:4):
        state.moving?[0,1,0,2][Math.floor(timeMs/100)%4]:0;
      p.sx=(item.raw.x+cell)*32;
    }
  }
}
