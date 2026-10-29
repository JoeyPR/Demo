import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { PLAYER_VISUAL_SCALE } from "../js/player-shadow.mjs";
import {
  clampCameraZoom,
  computeCameraLayout,
  projectCameraPoint,
  unprojectCameraPoint,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_DEFAULT,
} from '../js/camera.mjs';

const here = dirname(fileURLToPath(import.meta.url));

describe('camera zoom limits and defaults', () => {
  it('clamps zoom into [min, max]', () => {
    assert.equal(CAMERA_ZOOM_MIN, 1 / 1.28);
    assert.equal(CAMERA_ZOOM_MAX, 4);
    assert.equal(clampCameraZoom(0), CAMERA_ZOOM_MIN);
    assert.equal(clampCameraZoom(99), CAMERA_ZOOM_MAX);
    assert.equal(clampCameraZoom(1.2), 1.2);
  });

  it('falls back to the default zoom (close to the player) for invalid input', () => {
    assert.equal(CAMERA_ZOOM_DEFAULT, 1);
    assert.equal(clampCameraZoom(Number('x')), CAMERA_ZOOM_DEFAULT);
    assert.equal(clampCameraZoom(undefined), CAMERA_ZOOM_DEFAULT);
    assert.equal(clampCameraZoom(NaN), CAMERA_ZOOM_DEFAULT);
  });

  it('keeps js/preview.js in sync with the camera defaults', () => {
    const src = readFileSync(join(here, '../js/preview.js'), 'utf8');
    assert.match(src, /P\.camZoom = \{ v: 1, min: 1 \/ 1\.28, max: 4 \}/);
    assert.equal(CAMERA_ZOOM_DEFAULT, 1, 'default zoom must be close to the player');
  });
});

describe('computeCameraLayout — the singular camera', () => {
  const base = { width: 1920, height: 1080, scale: 4, frameY: 0, zoom: 1 };

  it('frames the full screen with the player standing on the ground line', () => {
    const layout = computeCameraLayout(base);
    assert.equal(layout.ground, 1080 / 2 + 16 * 4);
    assert.equal(layout.rootX, 1920 / 2 - 16 * 4);
    assert.equal(layout.rootY, layout.ground - 32 * 4);
  });

  it('pivots on the player midpoint while the ground stays below it', () => {
    const layout = computeCameraLayout(base);
    assert.equal(layout.cameraPivotX, base.width / 2);
    assert.equal(layout.cameraPivotY, base.height / 2 + (16 - 16 * PLAYER_VISUAL_SCALE) * base.scale);
    assert.equal(layout.ground, layout.cameraPivotY + 16 * PLAYER_VISUAL_SCALE * base.scale);
    assert.equal(layout.rootY + 32 * base.scale - 16 * PLAYER_VISUAL_SCALE * base.scale, layout.cameraPivotY);
  });

  it('has no camera-pan, head-clamp or post-zoom shift machinery', () => {
    const layout = computeCameraLayout(base);
    for (const key of ['cameraY', 'cameraOffsetY', 'topMargin', 'topUnits', 'framedTopY', 'groundCam'])
      assert.ok(!(key in layout), `legacy field ${key} must be gone`);
  });

  it('zooming does not move anything: fixed pose, identical positions at every zoom', () => {
    const poses = [];
    for (const zoom of [CAMERA_ZOOM_MIN, 0.9, 1, 1.5, 2, CAMERA_ZOOM_MAX]) {
      const l = computeCameraLayout({ ...base, zoom });
      poses.push(l);
      assert.equal(l.zoom, zoom);
    }
    const first = poses[0];
    for (const l of poses) {
      assert.equal(l.ground, first.ground);
      assert.equal(l.rootX, first.rootX);
      assert.equal(l.rootY, first.rootY);
      assert.equal(l.cameraPivotX, first.cameraPivotX);
      assert.equal(l.cameraPivotY, first.cameraPivotY);
    }
  });

  it('keeps the player midpoint fixed while zoom scales ground movement', () => {
    const standing = computeCameraLayout(base);
    const jumping = computeCameraLayout({ ...base, frameY: -18 });
    assert.equal(jumping.rootY, standing.rootY, "camera tracking keeps the player at center");
    assert.equal(jumping.rootY + 32 * base.scale - 16 * PLAYER_VISUAL_SCALE * base.scale, jumping.cameraPivotY);
    assert.equal(jumping.ground - standing.ground, 18 * base.scale);
    for (const zoom of [CAMERA_ZOOM_MIN, 1, CAMERA_ZOOM_MAX]) {
      const a = computeCameraLayout({ ...base, zoom });
      const b = computeCameraLayout({ ...base, zoom, frameY: -18 });
      const screenA = projectCameraPoint(0, a.ground, a.cameraPivotX, a.cameraPivotY, zoom);
      const screenB = projectCameraPoint(0, b.ground, b.cameraPivotX, b.cameraPivotY, zoom);
      assert.ok(Math.abs(screenB.y - screenA.y - 18 * base.scale * zoom) < 1e-9);
    }
  });

  it('throws on invalid input', () => {
    assert.throws(() => computeCameraLayout({ ...base, width: 'x' }), TypeError);
    assert.throws(() => computeCameraLayout({ ...base, scale: 0 }), RangeError);
    assert.throws(() => computeCameraLayout({ ...base, frameY: Infinity }), TypeError);
  });
});

test('camera-space touch aiming is the inverse of the draw transform', () => {
  const pivotX = 960, pivotY = 540 + (16 - 16 * PLAYER_VISUAL_SCALE) * 4;   /* rendered player center */
  for (const zoom of [CAMERA_ZOOM_MIN, 0.9, 1, 1.5, 2, CAMERA_ZOOM_MAX]) {
    const source = { x: 123.25, y: 987.5 };
    const screen = projectCameraPoint(source.x, source.y, pivotX, pivotY, zoom);
    const restored = unprojectCameraPoint(screen.x, screen.y, pivotX, pivotY, zoom);
    assert.ok(Math.abs(restored.x - source.x) < 1e-9);
    assert.ok(Math.abs(restored.y - source.y) < 1e-9);
  }
});

test('zoom is applied around the pivot only — the draw transform has no translation side effects', () => {
  // The world transform is translate(p); scale(z); translate(-p): a point AT the
  // pivot is invariant at every zoom; every other point scales toward it.
  for (const zoom of [CAMERA_ZOOM_MIN, 1, CAMERA_ZOOM_MAX]) {
    const p = { x: 960, y: 540 + (16 - 16 * PLAYER_VISUAL_SCALE) * 4 };
    const at = projectCameraPoint(p.x, p.y, p.x, p.y, zoom);
    assert.equal(at.x, p.x);
    assert.equal(at.y, p.y);
  }
});


test('land source window is centered on camera world X before zoom is applied', () => {
  const app = readFileSync(join(here, '../js/app.js'), 'utf8');
  assert.ok(app.includes("Math.floor(cameraWorldX - lw / 2)"));
  assert.ok(app.includes("const dx = (w - lw * landS) / 2"));
  assert.ok(app.includes("ctx.drawImage(landCanvas, 0, 0, lw, lh, dx, ground, lw * landS, lh * landS)"));
});

test('pickup rendering projects its world point once outside the world zoom transform', () => {
  const app = readFileSync(join(here, '../js/app.js'), 'utf8');
  assert.ok(app.includes("drawPickups(c, frame, s, cameraPivotX, cameraPivotY, zoom)"));
  assert.ok(app.includes("(16 * PLAYER_VISUAL_SCALE + pose.y - frame.y - pose.bob) * scale * zoom"));
  assert.ok(!app.includes("PICKUP_SIZE * scale * pose.scale + pose.scale / safeZoom"));
});
