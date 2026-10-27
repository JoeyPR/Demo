import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeCameraLayout } from "../js/camera.mjs";
import { PLAYER_VISUAL_SCALE } from "../js/player-shadow.mjs";

test("camera follows continuous player world coordinates without edge clamps", () => {
  const near = computeCameraLayout({
    width: 960, height: 540, scale: 3, frameX: 24, frameY: 0, zoom: 1
  });
  const far = computeCameraLayout({
    width: 960, height: 540, scale: 3, frameX: 1_000_024, frameY: 0, zoom: 1
  });
  assert.equal(near.cameraWorldX, 24);
  assert.equal(far.cameraWorldX, 1_000_024);
  assert.equal(far.rootX, near.rootX, "player remains at the camera's horizontal focus");
  assert.equal(far.cameraPivotX, near.cameraPivotX);
});

test("camera pivot stays at the player's center while the ground line follows vertical motion", () => {
  const idle = computeCameraLayout({
    width: 960, height: 540, scale: 3, frameX: 0, frameY: 0, zoom: 1
  });
  const jumping = computeCameraLayout({
    width: 960, height: 540, scale: 3, frameX: 0, frameY: -18, zoom: 1
  });
  assert.equal(idle.cameraPivotY, 270 + (16 - 16 * PLAYER_VISUAL_SCALE) * 3);
  assert.equal(idle.rootY + 32 * 3 - 16 * PLAYER_VISUAL_SCALE * 3, idle.cameraPivotY,
    "rendered player midpoint is the zoom focus");
  assert.equal(jumping.cameraWorldY, -18);
  assert.equal(jumping.ground, idle.ground + 54, "the world ground follows opposite player vertical travel");
  assert.equal(jumping.rootY, idle.rootY, "player stays pinned to the camera focus");
  assert.equal(jumping.rootY + 32 * 3 - 16 * PLAYER_VISUAL_SCALE * 3, jumping.cameraPivotY);
  assert.equal(jumping.ground, jumping.cameraPivotY + 16 * PLAYER_VISUAL_SCALE * 3 - jumping.cameraWorldY * 3);
});

test("live app passes current player position into camera and scenery", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /frameX: frame\.x, frameY: frame\.y/);
  assert.match(app, /hillOffsetsNow\(w, h, s, camera\.cameraWorldX\)/);
  assert.match(app, /drawLandGround\(w, h, ground, s, frame, zoom, camera\.cameraWorldX\)/);
});
