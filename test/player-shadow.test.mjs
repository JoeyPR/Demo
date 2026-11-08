import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_VISUAL_SCALE,
  PLAYER_SHADOW_OFFSET,
  PLAYER_SHADOW_DROP,
  PLAYER_SHADOW_OPACITY,
  PLAYER_SHADOW_COLOR,
  playerShadowOffset,
} from "../js/player-shadow.mjs";

test("avatar stays pinned to its feet while land tiles use the full 32-unit scale", () => {
  assert.equal(PLAYER_VISUAL_SCALE, 1);
});

test("shadow is black at 50% and always shifts left 12px and down 12px", () => {
  assert.deepEqual(PLAYER_SHADOW_COLOR, [0, 0, 0]);
  assert.deepEqual(playerShadowOffset(1), { x: -12, y: 12 });
  assert.deepEqual(playerShadowOffset(-1), { x: -12, y: 12 });
  assert.deepEqual(playerShadowOffset(0), { x: -12, y: 12 });
  assert.equal(PLAYER_SHADOW_OFFSET, 12);
  assert.equal(PLAYER_SHADOW_DROP, 12);
  assert.equal(PLAYER_SHADOW_OPACITY, 0.5);
});
