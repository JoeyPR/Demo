/* Native player renderer — basic coverage: base pieces, fx layer assembly,
   punch overlay, facing, walk cycle independence from display refresh. */
import test from "node:test";
import assert from "node:assert/strict";
import { NativePlayerRenderer, sampleMoments } from "../js/render/player.mjs";
import { buildPlayerDrawList } from "../js/render/player-draw-list.mjs";
import { PlayerRig } from "../js/render/rig.mjs";

const catalog = {
  base: [
    { atlas: "player_body_only.png", x: 0, y: 0, cell: [1,1,0] },
    { atlas: "player_head.png", x: 0, y: 0, cell: [1,1,0] },
    { atlas: "player_extraleg.png", x: 0, y: 0, cell: [1,1,0], w: 16, h: 1, dx: 8, dy: 28 },
    { atlas: "player_feet.png", x: 0, y: 0, cell: [1,2,1] },
    { atlas: "player_eyes.png", x: 0, y: 0, cell: [1,1,0] },
    { atlas: "player_eyes.png", x: 0, y: 4, cell: [1,1,0] }
  ],
  arm: { atlas: "player_arm.png", w: 6, h: 10, back: [21,18], front: [6,18] },
  layerOrder: [6,-2,-1,3,2,1,8,-3,4,7,0,5],
  layers: { body: -1, backArm: -2, frontArm: -3 }
};

const motion = (over = {}) => ({
  x: 0, y: 0, vx: 0, vy: 0, ground: true, facing: 1, clockMs: 0,
  moveMs: 0, punch: null, events: [], locomotion: "idle", jumpHeld: false,
  ...over
});

test("sampleMoments picks the latest moment at or before time", () => {
  const m = [[0, ["a"]], [100, ["b"]], [200, ["c"]]];
  assert.deepEqual(sampleMoments(m, 0, 300), ["a"]);
  assert.deepEqual(sampleMoments(m, 50, 300), ["a"]);
  assert.deepEqual(sampleMoments(m, 100, 300), ["b"]);
  assert.deepEqual(sampleMoments(m, 250, 300), ["c"]);
  assert.deepEqual(sampleMoments(m, 300, 300), ["a"]); // wrap
});

test("basePieces: naked avatar contains all base pieces and no punch arm", () => {
  const r = new NativePlayerRenderer(catalog);
  const pose = r.rig.update(motion(), 16);
  const result = r.step(motion(), 16);
  const tags = new Set(result.calls.map(c => c.tag).filter(Boolean));
  for (const t of ["body","head","backFoot","frontFoot","frontLeg","backLeg","eyes","eyelids","backArm","frontArm"]) {
    assert.ok(tags.has(t), `missing base tag ${t}`);
  }
  assert.ok(!result.calls.some(c => c.atlas === "player_puncharm.png"));
});

test("punch overlay applies without removing body", async () => {
  const r = new NativePlayerRenderer(catalog);
  const m = motion({ punch: { ageMs: 0, target: [64, 16] } });
  const result = r.step(m, 16);
  const punchCall = result.calls.find(c => c.atlas === "player_puncharm.png");
  assert.ok(punchCall, "punch arm overlay missing");
  const tags = new Set(result.calls.map(c => c.tag).filter(Boolean));
  assert.ok(tags.has("body"), "body missing during punch");
  assert.ok(tags.has("head"), "head missing during punch");
});

test("punch stretch and width follow the Set Planner curve", () => {
  const rig = new PlayerRig();
  // reach = hypot(64-24, 16-18) (target distance from the back-arm shoulder)
  const reach = Math.hypot(64 - 24, 16 - 18);
  for (const t of [50, 100, 200]) {
    const pose = rig.update(motion({ punch: { ageMs: t, target: [64, 16] } }), 16);
    assert.ok(pose.punch, `no punch at ${t}`);
    assert.ok(Math.abs(pose.punch.stretch - reach * (t / 1000) * 0.106) < 1e-6,
      `stretch at ${t}: got ${pose.punch.stretch}`);
    assert.ok(Math.abs(pose.punch.width - Math.min(1.8, 7.43 * (t / 1000))) < 1e-6,
      `width at ${t}: got ${pose.punch.width}`);
  }
});

test("walk cycle is independent of display refresh rate", () => {
  const r1 = new NativePlayerRenderer(catalog);
  const r2 = new NativePlayerRenderer(catalog);
  const walk = { ...motion({ locomotion: "walk" }), vx: 250, ground: true };
  let p1, p2;
  for (let i = 0; i < 30; i++) p1 = r1.step(walk, 1000/60);
  for (let i = 0; i < 15; i++) p2 = r2.step(walk, 1000/30);
  // both rigs sample at the same logical time; the walk track is time-based
  assert.ok(p1.pose && p2.pose, "rigs returned no pose");
  assert.equal(r1.pose.backFoot, r2.pose.backFoot, "walk foot offset differs");
  assert.equal(r1.pose.frontFoot, r2.pose.frontFoot, "walk foot offset differs");
});

test("facing mirrors once in logical 32-unit coordinates", () => {
  const r = new NativePlayerRenderer(catalog);
  const left = r.step(motion({ facing: -1 }), 16);
  const right = r.step(motion({ facing: 1 }), 16);
  const lBody = left.calls.find(c => c.tag === "body");
  const rBody = right.calls.find(c => c.tag === "body");
  assert.ok(lBody && rBody, "body call missing");
  assert.notDeepEqual(lBody.matrix, rBody.matrix, "facing reflection not applied");
});
