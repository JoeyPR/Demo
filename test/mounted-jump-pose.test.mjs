import test from "node:test";
import assert from "node:assert/strict";
import { resolveItemPose as resolveSourcePose } from "../src/pose-resolver.mjs";
import { resolveItemPose as resolveDemoPose } from "../demo/engine/pose-resolver.mjs";
import { PlayerRig } from "../demo/engine/rig.mjs";
import { angleDelta } from "../demo/engine/math.mjs";

const mount = () => ({
  id: 592, slot: 3, vehicle: true,
  staticArmPose: { backAngle: -35, frontAngle: -35 },
  pose: { backAngle: -35, frontAngle: -35 },
  statePoses: {
    jump: { backAngle: -90, frontAngle: -90 },
    ridingair: { backAngle: -110, frontAngle: -110 },
  },
});
const frame = (locomotion = "idle") => ({
  clockMs: 100, moveMs: 100, x: 0, y: 0, vx: 0, vy: 0, facing: 1,
  ground: !["jump", "fall", "glide"].includes(locomotion),
  locomotion, events: [],
});

for (const [name, resolvePose] of [
  ["source", resolveSourcePose],
  ["demo", resolveDemoPose],
]) {
  test(`${name}: riding retains its neutral arm pose while grounded`, () => {
    const result = resolvePose([mount()], frame("idle"));
    assert.equal(result.override.backAngle, -35);
    assert.equal(result.override.frontAngle, -35);
    assert.equal(result.state, "ridingstill");
  });

  test(`${name}: riding jump uses the player's airborne pose`, () => {
    const motion = frame("jump");
    const result = resolvePose([mount()], motion);
    assert.equal(result.state, "ridingair");
    assert.equal(result.override.backAngle, undefined);
    assert.equal(result.override.frontAngle, undefined);
    assert.equal(result.override.backFoot, undefined);
    assert.equal(result.override.frontFoot, undefined);
    const pose = new PlayerRig().update(motion, 1000 / 60, result.override);
    assert.notEqual(angleDelta(0, pose.backAngle), -35);
    assert.notEqual(angleDelta(0, pose.frontAngle), -35);
    assert.equal(pose.backAngle, pose.frontAngle);
  });
}
