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

test("avatar stays pinned to its feet while land tiles use the full 32-unit scale", () => {
  assert.equal(PLAYER_VISUAL_SCALE, 0.78);
  const rect = playerVisualRect({ x: 0, y: 0, width: 32, height: 32 }, 100, 200, 4);
  assert.equal(rect.width, 32 * 4 * PLAYER_VISUAL_SCALE);
  assert.equal(rect.height, 32 * 4 * PLAYER_VISUAL_SCALE);
  assert.equal(rect.x + 16 * 4 * PLAYER_VISUAL_SCALE, 100 + 16 * 4);
  assert.equal(rect.y + rect.height, 200 + 32 * 4);
});

test("shadow is black at 50% and shifts exactly 12px down toward facing", () => {
  assert.deepEqual(PLAYER_SHADOW_COLOR, [0, 0, 0]);
  assert.deepEqual(playerShadowOffset(1), { x: 12, y: 12 });
  assert.deepEqual(playerShadowOffset(-1), { x: -12, y: 12 });
  assert.equal(PLAYER_SHADOW_OFFSET, 12);
  assert.equal(PLAYER_SHADOW_DROP, 12);
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
  assert.match(app, /c\.setTransform\(1, 0, 0, 1, 0, 0\)/,
    "shadow is drawn without the camera zoom transform");
  assert.match(app, /shadowScreenCenterX/);
  assert.match(app, /shadowScreenBottomY/);
  assert.match(app, /c\.drawImage\(avatarShadow, shadowScreenX, shadowScreenY,/);
  assert.match(app, /const landS = s \* \(24 \/ 32\);/, "land tiles render at the 24-unit midpoint scale");
  const shadow = app.indexOf("c.drawImage(avatarShadow");
  const land = app.indexOf("if (state.landWorld) drawLandGround(w, h, ground, s, frame, zoom)");
  const player = app.indexOf("c.drawImage(avatar, playerRect.x");
  assert.ok(shadow < land && land < player,
    "shadow is behind the land and land is behind the player");
  assert.ok(player < app.indexOf("drawAncestralAura(s, rootX, ground, frame, \"front\""),
    "front ancestral effects remain above the player");
});
