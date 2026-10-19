// Units of motion.punch.target (work order step 7, checked before use).
//
// FINDING: motion.punch.target is in PIXELS OF THE 32 x 32 PLAYER CELL (1 tile = 32 units), not tiles and not screen pixels.
//   origin  top-left of the player cell, x right, y down (the cell moves with the player, so it is already player-relative)
//   x       facing-local: at facing -1 the demo sends 32 - x, because the rig mirrors the whole cell afterwards
//   y       relative to the LIFTED player (the demo subtracts lift.y)
//   default the rig and item-fx fall back to [64,16] = two tiles ahead, half a tile down
// The demo canvas draws a tile as 32*s screen px, so screen px / s = cell px; s only decides how large the cell is on screen.
export const PUNCH_TARGET_UNITS={unit:"cell-px",pxPerTile:32,origin:"cell-top-left",yAxis:"down",xSpace:"facing-local",yRelativeTo:"lifted-player",
  defaultTarget:[64,16],cell:[32,32]};
export function aimToPunchTarget({aim,view,facing=1,liftY=0}) {
  const {rootX,rootY,s}=view;
  let x=(aim.x-rootX)/s;
  if(facing<0)x=PUNCH_TARGET_UNITS.cell[0]-x;
  return [x,(aim.y-rootY)/s-liftY];
}
// Particle offsets are measured from the feet-centre of the cell: (16,32) in cell coordinates (see spritePiece in xml-renderer).
export const PARTICLE_ORIGIN=[16,32];
export const punchTargetToParticleSpace=target=>[target[0]-PARTICLE_ORIGIN[0],target[1]-PARTICLE_ORIGIN[1]];
