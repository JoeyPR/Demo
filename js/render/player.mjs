/* NATIVE PLAYER RENDERER — setplanner-derived character layer.
   Builds the Growtopia character in 32-unit rig coordinates from:
   - the catalog base list (player_body_only / player_head / extraleg / feet /
     eyes+eyelids) with per-tag semantic hiding,
   - arms (player_arm.png, 6x10 art, pivots back [21,18] front [6,18], drawn
     one pixel below the arm origin),
   - equipped wearables via their decrypted fx blobs (render/data/fx/<id>.json.gz):
     item.game static moments, item.moves keyed walk/jump/fall/glide/stop
     per-locomotion moments, sleeve pieces composed through the arm transform,
     non-sprite commands {arms}, {lift}, {face}, {hideNow} steering the rig,
   - the Set Planner generic punch (PUNCH_RESTORATION.md): stretch = reach *
     t * 0.106, width = min(1.8, 7.43 * t), 200ms held cadence, 260ms released
     lifetime; punch is an overlay, airborne state is preserved underneath.

   Public-catalog-derived playback is approximate and NOT claimed as exact
   official-client behaviour. Units: logical pixels/ms; atlas rects in source
   pixels. Tint multiplies RGB and preserves alpha. The face item can move over
   the hat. Riding separates mount contact from rider lift. Missing FX stay
   visibly unresolved (no made-up emitters). */

import { PlayerRig } from "./rig.mjs";
import { compose, translate, scale, around, rotate } from "../../demo/engine/math.mjs";
import * as Content from "./content.mjs";

const IDENTITY = compose();

/* ---- fx record u → draw band ------------------------------------------ */
/* u is a planner-recording draw band, NOT a native clothing slot. */
const U_TO_BAND = {
  0: "RenderBehind",    /* hair back */
  1: "RenderBackArm",   /* back-arm sleeve */
  2: "RenderExtraleg",  /* extraleg */
  8: "RenderShoes",     /* feet */
  10: "BODY",           /* body-anchored wearable */
  11: "RenderFrontArm", /* front-arm sleeve */
  12: "RenderInFront",  /* hand / pet */
};
function slotBand(slot) {
  return ({ 0:"RenderHat",1:"RenderShirt",2:"RenderPants",3:"RenderShoes",4:"RenderFaceItem",
    5:"RenderHandItem",6:"RenderBackpack",7:"RenderHair",8:"RenderChestItem",
    9:"RenderAura" })[slot] ?? "RenderInFront";
}
const BAND_ORDER = [
  "RenderBehind", "RenderBackHair", "RenderBackArm", "RenderExtraleg", "BODY",
  "RenderShoes", "RenderPants", "RenderShirt", "RenderChestItem", "RenderFrontArm",
  "RenderFaceItem", "RenderHair", "RenderHat", "RenderHandItem", "RenderPet",
  "RenderInFront", "PARTICLES"
];

/* Moment sample (step, not interpolated): pick the latest moment at timeMs. */
function sampleMoments(moments, timeMs, period) {
  if (!moments?.length) return [];
  const t = period > 0 ? ((timeMs % period) + period) % period : timeMs;
  let out = moments[moments.length - 1][1];
  for (let i = moments.length - 1; i >= 0; i--) {
    if (moments[i][0] <= t) { out = moments[i][1]; break; }
  }
  return out;
}

/* ---- Wearable adapter -------------------------------------------------- */
export class PlayerWear {
  constructor(catalog) {
    this.catalog = catalog;
    this.items = [];
    this.fx = new Map();
  }
  async equip(items) {
    this.items = items;
    await Promise.all(items.map(async item => {
      if (this.fx.has(item.id)) return;
      try {
        const blob = await Content.itemFx(item.id);
        this.fx.set(item.id, {
          game: blob?.item?.game ?? null,
          moves: blob?.item?.moves ?? {},
        });
      } catch (e) {
        this.fx.set(item.id, { game: null, moves: {} });
      }
    }));
  }
  /* Returns {layers, hide, hideNow, faceOverride, lift, armsOverride}. */
  sample(locomotion, clockMs, moveMs, punch) {
    const layers = [], hide = new Set();
    let faceOverride = null, lift = null, armsOverride = null;
    const active = punch ? (this.fxFor(punch.itemId)?.moves?.punch ? null : null) : null;
    for (const item of this.items) {
      const data = this.fx.get(item.id);
      if (!data) continue;
      let moments = null, period = 0;
      // punch: item-specific punch moment if present, else generic overlay
      if (punch && data.moves?.punch) {
        moments = data.moves.punch.moments;
        period = data.moves.punch.period ?? 0;
      }
      if (!moments && data.moves && locomotion in data.moves) {
        const m = data.moves[locomotion];
        if (m) { moments = m.moments; period = m.period ?? 0; }
      }
      if (!moments) { moments = data.game?.moments ?? []; period = data.game?.period ?? 0; }
      const t = moments === data.game?.moments ? clockMs : moveMs;
      const recs = sampleMoments(moments, punch ? punch.ageMs : t, period);
      for (const record of recs) {
        if (!record.a) {
          if (Array.isArray(record.arms)) armsOverride = record.arms.slice();
          if (Array.isArray(record.lift)) lift = record.lift.slice();
          if (Array.isArray(record.face)) faceOverride = record.face.slice();
          if (Array.isArray(record.hideNow)) for (const s of record.hideNow) hide.add(s);
          continue;
        }
        layers.push({ ...record, itemId: item.id, slot: item.slot, atlas: record.a });
      }
      if (Array.isArray(data.game?.hide)) for (const s of data.game.hide) hide.add(s);
    }
    return { layers, hide, faceOverride, lift, armsOverride };
  }
  fxFor(id) { return this.fx.get(id); }
}

/* ---- Arm / punch geometry ---------------------------------------------- */
const ARM = { atlas: "player_arm.png", w: 6, h: 10, back: [21, 18], front: [6, 18] };
function armPivot(side) {
  const at = ARM[side];
  return [at[0] + ARM.w / 2, at[1] + 1];
}
function limbMatrix(side, angleDeg) {
  return around(armPivot(side), rotate(angleDeg));
}
function punchMatrix(punch) {
  const [x, y] = ARM.back;
  return compose(translate(x + ARM.w / 2, y), rotate(punch.angle),
    scale(punch.width ?? 1, punch.stretch ?? 1), translate(-10, 0));
}
function pointOf(m, [x, y]) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/* ---- Base pieces ------------------------------------------------------- */
/* The catalog base list entries (player_body_only, player_head, extraleg w16
   h1 dx8 dy28, feet cell [1,2,1], eyes rows y=0 face / y=4 eyelids). */
function basePieces(pose, hide, faceOverride) {
  const out = [];
  const hidden = tag => hide.has(tag);
  if (!hidden("body")) out.push({ atlas: "player_body_only.png", sx: 0, sy: 0, sw: 32, sh: 32,
    matrix: IDENTITY, pass: "BODY", tint: "SKIN", tag: "body" });
  if (!hidden("head")) out.push({ atlas: "player_head.png", sx: 0, sy: 0, sw: 32, sh: 32,
    matrix: IDENTITY, pass: "BODY", tint: "SKIN", tag: "head" });
  if (!hidden("backFoot")) out.push({ atlas: "player_feet.png", sx: 0, sy: 32, sw: 32, sh: 32,
    matrix: translate(0, pose.backFoot), pass: "BODY", tint: "SKIN", tag: "backFoot" });
  if (!hidden("frontFoot")) out.push({ atlas: "player_feet.png", sx: 0, sy: 0, sw: 32, sh: 32,
    matrix: translate(0, pose.frontFoot), pass: "BODY", tint: "SKIN", tag: "frontFoot" });
  for (const [tag, x, offset] of [["frontLeg", 8, pose.frontFoot], ["backLeg", 16, pose.backFoot]]) {
    if (hidden(tag)) continue;
    const h = 2 + offset;
    if (h > 0.01) out.push({ atlas: "player_extraleg.png", sx: 0, sy: 0, sw: 16, sh: 1,
      matrix: compose(translate(x, 28), scale(1, h)), pass: "BODY", tint: "SKIN", tag });
  }
  const face = faceOverride ?? pose.face ?? [0, 0];
  if (!hidden("eyes")) out.push({ atlas: "player_eyes.png", sx: face[0] * 32, sy: face[1] * 32,
    sw: 32, sh: 32, matrix: IDENTITY, pass: "BODY", tag: "eyes" });
  if (!hidden("eyelids")) out.push({ atlas: "player_eyes.png", sx: face[0] * 32, sy: (face[1] + 4) * 32,
    sw: 32, sh: 32, matrix: IDENTITY, pass: "BODY", tint: "SKIN", tag: "eyelids" });
  for (const side of ["back", "front"]) {
    if (hidden(`${side}Arm`)) continue;
    if (side === "back" && pose.punch) continue; // punch arm replaces the back arm
    const at = ARM[side];
    const matrix = compose(limbMatrix(side, pose[`${side}Angle`]), translate(at[0], at[1]));
    out.push({ atlas: ARM.atlas, sx: 0, sy: 0, sw: ARM.w, sh: ARM.h,
      matrix, pass: side === "back" ? "RenderBackArm" : "RenderFrontArm", tint: "SKIN", tag: `${side}Arm` });
  }
  return out;
}

/* ---- Facing / lift ------------------------------------------------------ */
function playerRoot(motion, lift) {
  const facing = motion.facing < 0 ? [-1, 0, 0, 1, 32, 0] : [1, 0, 0, 1, 0, 0];
  return compose(translate(motion.x ?? 0, motion.y ?? 0), facing,
    translate(lift?.[0] ?? 0, lift?.[1] ?? 0));
}

/* ---- Renderer ---------------------------------------------------------- */
export class NativePlayerRenderer {
  constructor(catalog) {
    this.catalog = catalog;
    this.rig = new PlayerRig();
    this.wear = new PlayerWear(catalog);
    this.pose = { backAngle: 0, frontAngle: 0, backFoot: 0, frontFoot: 0, face: [0, 0] };
  }
  async equip(items) { await this.wear.equip(items); }
  step(motion, dtMs) {
    const { layers, hide, faceOverride, lift, armsOverride } =
      this.wear.sample(motion.locomotion, motion.clockMs, motion.moveMs, motion.punch);
    const override = {};
    if (armsOverride && !motion.punch) {
      override.backAngle = armsOverride[0];
      override.frontAngle = armsOverride[1];
    }
    const pose = this.rig.update(motion, dtMs, override);
    if (faceOverride) pose.face = faceOverride;
    this.pose = pose;
    // hide base feet when a wearable supplies shoes (catalog slot 3 present)
    const wornShoes = layers.some(l => l.slot === 3);
    if (wornShoes) { hide.add("backFoot"); hide.add("frontFoot"); }
    const root = playerRoot(motion, lift);
    const calls = basePieces(pose, hide, faceOverride)
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
          const local = limbMatrix(side, pose[`${side}Angle`]);
          calls.push({ ...record, atlas: record.a, matrix: compose(root, local),
            pass: U_TO_BAND[record.u] ?? (side === "back" ? "RenderBackArm" : "RenderFrontArm"),
            itemId: record.itemId });
        }
        continue;
      }
      if (record.a === "player_extraleg.png" || record.a === "player_feet.png" && record.slot === 3) {
        // wearable feet/extraleg piece composes through the foot translation
        const side = record.sy === 32 ? "back" : "front";
        const dy = side === "back" ? pose.backFoot : pose.frontFoot;
        const local = record.a === "player_extraleg.png"
          ? compose(translate(record.x ?? 8, 28), scale(record.sw ?? 16, 2 + dy))
          : translate(0, dy);
        calls.push({ ...record, atlas: record.a, matrix: compose(root, local),
          pass: record.a === "player_feet.png" ? "RenderShoes" : "RenderExtraleg",
          itemId: record.itemId });
        continue;
      }
      // sprite piece: anchor at (x, y) with (ax, ay); x/y are already rig coords.
      const sw = record.sw ?? 32, sh = record.sh ?? 32;
      const ax = record.ax ?? 0.5, ay = record.ay ?? 1;
      const local = translate((record.x ?? 0) - sw * ax, (record.y ?? 0) - sh * ay);
      calls.push({ ...record, atlas: record.a, matrix: compose(root, local),
        pass: U_TO_BAND[record.u] ?? slotBand(record.slot), itemId: record.itemId });
    }
    if (punchActive) {
      if (!punchSleeveDone) {
        calls.push({ atlas: "player_puncharm.png", sx: 180, sy: 0, sw: 20, sh: 48,
          matrix: punchMatrix(pose.punch), pass: "RenderBackArm", tint: "SKIN", tag: "punchArm" });
      }
    }
    calls.sort((a, b) => BAND_ORDER.indexOf(a.pass) - BAND_ORDER.indexOf(b.pass));
    return { pose, calls };
  }
}

export { basePieces, limbMatrix, punchMatrix, playerRoot, sampleMoments,
  U_TO_BAND, slotBand, BAND_ORDER, ARM };
