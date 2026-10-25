import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
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
    assert.equal(CAMERA_ZOOM_MIN, 0.5);
    assert.equal(CAMERA_ZOOM_MAX, 2);
    assert.equal(clampCameraZoom(0), CAMERA_ZOOM_MIN);
    assert.equal(clampCameraZoom(4), CAMERA_ZOOM_MAX);
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
    const m = src.match(/P\.camZoom = \{ v: ([\d.]+), min: ([\d.]+), max: ([\d.]+) \}/);
    assert.ok(m, 'P.camZoom literal not found in js/preview.js');
    assert.equal(+m[1], CAMERA_ZOOM_DEFAULT, 'default zoom must be close to the player');
    assert.equal(+m[2], CAMERA_ZOOM_MIN);
    assert.equal(+m[3], CAMERA_ZOOM_MAX);
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

  it('pivots on the ground point under the player (their midline)', () => {
    const layout = computeCameraLayout(base);
    assert.equal(layout.cameraPivotX, base.width / 2);
    assert.equal(layout.cameraPivotY, layout.ground);
  });

  it('has no camera-pan, head-clamp or post-zoom shift machinery', () => {
    const layout = computeCameraLayout(base);
    for (const key of ['cameraY', 'cameraOffsetY', 'topMargin', 'topUnits', 'framedTopY', 'groundCam'])
      assert.ok(!(key in layout), `legacy field ${key} must be gone`);
  });

  it('zooming does not move anything: fixed pose, identical positions at every zoom', () => {
    const poses = [];
    for (const zoom of [0.5, 0.75, 1, 1.5, 2]) {
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

  it('preserves real jump displacement and scales it with zoom around the pivot', () => {
    const standing = computeCameraLayout(base);
    const jumping = computeCameraLayout({ ...base, frameY: -18 });
    // pre-transform positions are the same jump at every zoom...
    assert.equal(jumping.rootY - standing.rootY, -18 * base.scale);
    for (const zoom of [0.5, 1, 2]) {
      const a = computeCameraLayout({ ...base, zoom });
      const b = computeCameraLayout({ ...base, zoom, frameY: -18 });
      // ...and on screen the separation scales with zoom (pivot is the ground line)
      assert.ok(Math.abs((b.rootY - a.rootY) * zoom - (-18 * base.scale) * zoom) < 1e-9);
    }
  });

  it('throws on invalid input', () => {
    assert.throws(() => computeCameraLayout({ ...base, width: 'x' }), TypeError);
    assert.throws(() => computeCameraLayout({ ...base, scale: 0 }), RangeError);
    assert.throws(() => computeCameraLayout({ ...base, frameY: Infinity }), TypeError);
  });
});

test('camera-space touch aiming is the inverse of the draw transform', () => {
  const pivotX = 960, pivotY = 604;   /* viewport midline, ground line */
  for (const zoom of [0.5, 0.75, 1, 1.5, 2]) {
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
  for (const zoom of [0.5, 1, 2]) {
    const p = { x: 960, y: 604 };
    const at = projectCameraPoint(p.x, p.y, p.x, p.y, zoom);
    assert.equal(at.x, p.x);
    assert.equal(at.y, p.y);
  }
});
