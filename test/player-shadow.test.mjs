import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_VISUAL_SCALE,
  PLAYER_SHADOW_OFFSET,
  PLAYER_SHADOW_DROP,
  PLAYER_SHADOW_OPACITY,
  PLAYER_SHADOW_COLOR,
  getPlayerShadowCalls,
  playerVisualRect,
  playerShadowOffset,
} from "../js/player-shadow.mjs";

test("shadow caster selection keeps player/clothing and excludes FX, pets, particles, ancestrals, and punching", () => {
  const calls = [
    { atlas: "player_body_only.png", pass: "BODY", alpha: 1 },
    { atlas: "hat.png", pass: "RenderHat", owner: 42, alpha: 0.8 },
    { atlas: "player_artifact.png", pass: "RenderAura", owner: 99 },
    { atlas: "particles.png", pass: "PARTICLES" },
    { atlas: "tiles_page1.png", pass: "BODY", fxEngine: true },
    { atlas: "pet.png", pass: "RenderPet", pet: true },
    { atlas: "reference-fx.png", pass: "BODY", referenceFx: "sparkle" },
    { atlas: "player_puncharm.png", pass: "RenderBackArm" },
    { atlas: "shirt-sleeve.png", pass: "RenderFrontArm", owner: 42 },
    { atlas: "held-item.png", pass: "RenderHandItem", owner: 55 },
    { atlas: "leash.png", pass: "RenderBehind", line: {} },
    { atlas: "hair.png", pass: "RenderHair", owner: 42, add: true },
    { atlas: "visual.png", pass: "VISUAL" },
  ];

  const selected = getPlayerShadowCalls(calls, { ancestralId: 99 });
  assert.deepEqual(selected.map(c => c.atlas), [
    "player_body_only.png", "hat.png", "shirt-sleeve.png", "held-item.png",
  ]);
  assert.deepEqual(selected[0].tint, [0, 0, 0]);
  assert.equal(selected[0].add, false);
  assert.equal(selected[1].alpha, 0.8, "existing item alpha is preserved");

  const whilePunching = getPlayerShadowCalls(calls, {
    ancestralId: 99, punchingItemId: 55, punching: true,
  });
  assert.deepEqual(whilePunching.map(c => c.atlas), [
    "player_body_only.png", "hat.png",
  ]);
});

test("avatar scale is 1.56 half-size land tiles and stays pinned to the feet", () => {
  assert.equal(PLAYER_VISUAL_SCALE, 0.78);
  assert.equal(PLAYER_VISUAL_SCALE * 2, 1.56);
  const rect = playerVisualRect({ x: 0, y: 0, width: 32, height: 32 }, 100, 200, 4);
  assert.equal(rect.width, 32 * 4 * PLAYER_VISUAL_SCALE);
  assert.equal(rect.height, 32 * 4 * PLAYER_VISUAL_SCALE);
  assert.equal(rect.x + 16 * 4 * PLAYER_VISUAL_SCALE, 100 + 16 * 4);
  assert.equal(rect.y + rect.height, 200 + 32 * 4);
});

test("shadow projection is black and falls down-right or down-left with facing", () => {
  assert.deepEqual(PLAYER_SHADOW_COLOR, [0, 0, 0]);
  assert.deepEqual(playerShadowOffset(4, 1), { x: 5, y: 10 });
  assert.deepEqual(playerShadowOffset(4, -1), { x: -5, y: 10 });
  assert.equal(PLAYER_SHADOW_OFFSET, 1.25);
  assert.equal(PLAYER_SHADOW_DROP, 2.5);
  assert.equal(PLAYER_SHADOW_OPACITY, 0.5);
});


test("preview uses the shadow mask, removes the circular floor shadow, and draws a smaller feet-pinned avatar", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /getPlayerShadowCalls\(calls/);
  assert.match(app, /drawImage\(avatarShadow/);
  assert.match(app, /playerVisualRect\(b, rootX, rootY, s\)/);
  assert.doesNotMatch(app, /c\.ellipse\(w \/ 2, ground/);
  assert.match(app, /PLAYER_VISUAL_SCALE \* zoom/);
  assert.match(app, /globalAlpha = PLAYER_SHADOW_OPACITY/);
  assert.ok(app.indexOf("c.drawImage(avatar, playerRect.x") < app.indexOf("drawLandGround(w, h, ground, s, frame, zoom)"),
    "foreground land is drawn after the player");
  assert.ok(app.indexOf("drawAncestralAura(s, rootX, ground, frame, \"front\"") < app.indexOf("drawLandGround(w, h, ground, s, frame, zoom)"),
    "foreground land occludes the full player/effects composite");
});
