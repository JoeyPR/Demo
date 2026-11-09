/* PLAYER DRAW LIST — setplanner-derived assembly of the character into
   ordered draw calls on the entity canvas.

   The player draws in 32-unit rig coordinates: the player root sits at the
   camera's anchor (the ground point directly under the player's feet), with a
   single facing reflection. Draw order follows the catalog's layerOrder:
   6 backpack, -2 backArm, -1 body, 3 shoes, 2 pants, 1 shirt, 8 chest,
   -3 frontArm, 4 face, 7 hair, 0 hat, 5 hand, with RenderBehind (hair back)
   before everything and RenderInFront/pet/hand items last. */

import { compose, translate, scale, around, rotate } from "../../demo/engine/math.mjs";
import { ARM } from "./player.mjs";
import { basePieces, limbMatrix, punchMatrix, playerRoot } from "./player.mjs";

/* u → band, from setplanner's fx blob anchors. */
const U_TO_BAND = {
  0: "RenderBehind",   /* hair back */
  1: "RenderBackArm",  /* back-arm sleeve */
  2: "RenderExtraleg", /* extraleg */
  8: "RenderShoes",    /* feet */
  10: "BODY",          /* body-anchored wearable */
  11: "RenderFrontArm",/* front-arm sleeve */
  12: "RenderInFront", /* hand / pet */
};
function slotBand(slot) {
  return ({ 0:"RenderHat",1:"RenderShirt",2:"RenderPants",3:"RenderShoes",4:"RenderFaceItem",
    5:"RenderHandItem",6:"RenderBackpack",7:"RenderHair",8:"RenderChestItem",
    9:"RenderAura" })[slot] ?? "RenderInFront";
}
const BAND_ORDER = ["RenderBehind","RenderBackArm","RenderExtraleg","BODY",
  "RenderShoes","RenderPants","RenderShirt","RenderChestItem","RenderFrontArm",
  "RenderFaceItem","RenderHair","RenderHat","RenderHandItem","RenderPet",
  "RenderInFront"];

/* Assemble the frame's ordered draw calls. pose: rig output. layers: fx-blob
   layers for equipped items. hide: base-piece tags the worn items hide. */
export function buildPlayerDrawList({ motion, pose, layers = [], hide = new Set(), lift = null }) {
  const root = playerRoot(motion, lift);
  const calls = basePieces(pose, hide, null)
    .map(call => ({ ...call, matrix: compose(root, call.matrix) }));
  const punchActive = !!pose.punch;
  let punchSleeveDone = false;
  for (const record of layers) {
    if (record.a === "player_sleeve.png") {
      const side = record.x === 24 ? "back" : record.x === 9 ? "front" : null;
      if (!side) continue;
      if (side === "back" && punchActive) {
        const index = Math.round(record.sx / record.sw);
        calls.push({ atlas: "player_puncharm.png", sx: index * 20, sy: 0, sw: 20, sh: 48,
          matrix: punchMatrix(pose.punch), pass: "RenderBackArm",
          tint: record.skin ? "SKIN" : record.t ?? null, itemId: record.itemId });
        punchSleeveDone = true;
      } else {
        const at = ARM[side];
        const local = compose(limbMatrix(side, pose[`${side}Angle`]), translate(at[0], at[1]));
        calls.push({ ...record, atlas: record.a, matrix: compose(root, local),
          pass: side === "back" ? "RenderBackArm" : "RenderFrontArm", itemId: record.itemId });
      }
      continue;
    }
    if (record.a === "player_extraleg.png") {
      const side = record.sy === 32 ? "back" : "front";
      const offset = side === "back" ? pose.backFoot : pose.frontFoot;
      const local = compose(translate(record.x ?? 8, 28), scale(record.sw ?? 16, 2 + offset));
      calls.push({ ...record, atlas: record.a, matrix: compose(root, local),
        pass: "RenderExtraleg", itemId: record.itemId });
      continue;
    }
    if (record.a === "player_feet.png" && record.slot === 3) {
      const side = record.sy === 32 ? "back" : "front";
      const local = translate(0, side === "back" ? pose.backFoot : pose.frontFoot);
      calls.push({ ...record, atlas: record.a, matrix: compose(root, local),
        pass: "RenderShoes", itemId: record.itemId });
      continue;
    }
    const sw = record.sw ?? 32, sh = record.sh ?? 32;
    const ax = record.ax ?? 0.5, ay = record.ay ?? 1;
    const local = translate((record.x ?? 0) - sw * ax, (record.y ?? 0) - sh * ay);
    calls.push({ ...record, atlas: record.a, matrix: compose(root, local),
      pass: U_TO_BAND[record.u] ?? slotBand(record.slot), itemId: record.itemId });
  }
  if (punchActive && !punchSleeveDone) {
    calls.push({ atlas: "player_puncharm.png", sx: 180, sy: 0, sw: 20, sh: 48,
      matrix: punchMatrix(pose.punch), pass: "RenderBackArm", tint: "SKIN", tag: "punchArm" });
  }
  calls.sort((a, b) => BAND_ORDER.indexOf(a.pass) - BAND_ORDER.indexOf(b.pass));
  return calls;
}
