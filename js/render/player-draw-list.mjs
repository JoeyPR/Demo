/* PLAYER DRAW LIST — setplanner-derived: assemble the character into ordered
   draw calls, then draw them through the entity canvas via the camera.

   This is the Set Planner reference's *character layer*, not the whole app.
   The player draws in 32-unit rig coordinates: the player root sits at its
   MotionFrame (x, y) (centre/feet), with a single facing reflection; the
   character (body 32x32, arms 6x10 at pivots [21,18]/[6,18]) composes on top.
   Draw bands (fx record u) map to the catalog's layerOrder:
   6 backpack, -2 backArm, -1 body, 3 shoes, 2 pants, 1 shirt, 8 chest,
   -3 frontArm, 4 face, 7 hair, 0 hat, 5 hand, with RenderBehind (hair back)
   in front of everything and RenderInFront/pet/hand items last. */

import { basePieces, limbMatrix, punchMatrix, playerRoot } from "./player.mjs";

/* Slot → band, matching the layerOrder slots in the catalog. */
const SLOT_TO_BAND = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9
};
/* u → band, from setplanner's fx blob anchors (u0 hair-back → RenderBehind
   before everything, u8 feet, u10 body, u11 front-arm sleeve, u12 hand/pet,
   u2 extraleg). */
const U_TO_BAND = {
  0: 0,   /* hair back → RenderBehind */
  2: -4,  /* extraleg — behind everything (catalog: extraleg entry w/ dx/dy) */
  8: 3,   /* feet */
  10: -1, /* body */
  11: -3, /* front-arm sleeve */
  12: 5,  /* hand / pet */
};

/* Assemble the frame's ordered draw calls. pose: rig output. layers: fx-blob
   layers for equipped items. hide: base-piece tags the worn items hide. */
export function buildPlayerDrawList({ motion, pose, layers = [], hide = new Set(), skin, punch }) {
  const calls = basePieces(pose, null, hide, null);
  const punchActive = !!pose.punch;
  for (const record of layers) {
    if (!record.a) continue;
    const u = record.u;
    if (record.a === "player_sleeve.png") {
      const side = record.x === 24 ? "back" : record.x === 9 ? "front" : null;
      if (side === "back" && punchActive) {
        // Punch sleeve: replaces the back arm while punching.
        const index = Math.round(record.sx / record.sw);
        calls.push({ atlas: "player_puncharm.png", sx: index * 20, sy: 0, sw: 20, sh: 48,
          matrix: punchMatrix(pose.punch), pass: "RenderBackArm",
          tint: record.skin ? "SKIN" : record.t ?? null, itemId: record.itemId });
      } else if (side) {
        const local = limbMatrix(side, pose[`${side}Angle`]);
        calls.push({ ...record, atlas: record.a, matrix: local,
          pass: side === "back" ? "RenderBackArm" : "RenderFrontArm", itemId: record.itemId });
      }
      continue;
    }
    if (record.a === "player_arm.png" && record.skin) {
      // Some items author their own arm: compose through the arm transform.
      const side = record.x === 24 ? "back" : "front";
      const local = limbMatrix(side, pose[`${side}Angle`]);
      calls.push({ ...record, atlas: record.a, matrix: local,
        pass: side === "back" ? "RenderBackArm" : "RenderFrontArm", itemId: record.itemId });
      continue;
    }
    if (record.a === "player_extraleg.png") {
      // extraleg piece: (w16 h1) at (8,28), scaled vertically by foot offset + 2.
      const [x, y] = [record.x ?? 8, record.y ?? 28];
      const offset = y === 28 ? (record.side === "back" ? pose.backFoot : pose.frontFoot) : 0;
      const h = 2 + offset;
      const local = compose(translate(x, y), scale(record.sw ?? 16, h));
      calls.push({ ...record, atlas: record.a, matrix: local, pass: "RenderBehind",
        itemId: record.itemId });
      continue;
    }
    if (record.a === "player_feet.png") {
      // the feet piece from a worn item composes through the foot translation
      const side = record.sy === 32 ? "back" : "front";
      const local = translate(0, side === "back" ? pose.backFoot : pose.frontFoot);
      calls.push({ ...record, atlas: record.a, matrix: local, pass: "RenderShoes",
        itemId: record.itemId });
      continue;
    }
    const band = U_TO_BAND[u] ?? SLOT_TO_BAND[record.slot] ?? 10;
    const root = playerRoot(motion, null);
    calls.push({ ...record, atlas: record.a, matrix: root, pass: band, itemId: record.itemId });
  }
  // Punch arm overlay (if no sleeve replaced it)
  if (punchActive) {
    const replaced = calls.some(c => c.pass === "RenderBackArm" && c.atlas === "player_puncharm.png");
    if (!replaced) {
      calls.push({ atlas: "player_puncharm.png", sx: 180, sy: 0, sw: 20, sh: 48,
        matrix: punchMatrix(pose.punch), pass: "RenderBackArm", tint: "SKIN", tag: "punchArm" });
    }
  }
  // Sort by band order (matches layerOrder)
  const order = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 12];
  calls.sort((a, b) => order.indexOf(a.pass) - order.indexOf(b.pass));
  return calls;
}

function translate(x, y) { return [1, 0, 0, 1, x, y]; }
function scale(x, y) { return [x, 0, 0, y, 0, 0]; }
function compose(...m) {
  return m.reduce((a, b) => mul(a, b), [1, 0, 0, 1, 0, 0]);
}
function mul(a, b) {
  return [
    a[0]*b[0] + a[2]*b[1],
    a[1]*b[0] + a[3]*b[1],
    a[0]*b[2] + a[2]*b[3],
    a[1]*b[2] + a[3]*b[3],
    a[0]*b[4] + a[2]*b[5] + a[4],
    a[1]*b[4] + a[3]*b[5] + a[5]
  ];
}
