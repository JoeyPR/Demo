import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, clampCameraZoom,
  computeCameraLayout, projectCameraPoint, unprojectCameraPoint,
} from '../js/camera.mjs';

const near = (actual, expected, epsilon = 1e-8) => assert.ok(
  Math.abs(actual - expected) <= epsilon,
  'expected ' + actual + ' to be within ' + epsilon + ' of ' + expected,
);

test('zoom clamps to the preview control limits and handles invalid values', () => {
  assert.equal(clampCameraZoom(-10), CAMERA_ZOOM_MIN);
  assert.equal(clampCameraZoom(10), CAMERA_ZOOM_MAX);
  assert.equal(clampCameraZoom(Number.NaN), 1);
});

test('100% zoom preserves the baseline vertical framing calculation', () => {
  const input = { width: 1920, height: 1080, scale: 4, frameY: -60, topUnits: -35, zoom: 1 };
  const layout = computeCameraLayout(input);
  const ground = input.height / 2 + 16 * input.scale;
  const freeTop = ground - 32 * input.scale + input.frameY * input.scale + input.topUnits * input.scale;
  assert.equal(layout.cameraY, Math.min(0, freeTop - 6));
});

test('zoomed-in framing keeps the projected head/nameplate below the upper edge', () => {
  for (const zoom of [1.15, 1.5, 2]) {
    const layout = computeCameraLayout({
      width: 1920, height: 1080, scale: 4, frameY: -60, topUnits: -35, zoom,
    });
    const projectedTop = projectCameraPoint(
      0, layout.framedTopY, 0, layout.cameraPivotY, zoom,
    ).y;
    assert.ok(projectedTop >= 6 - 1e-8, 'zoom ' + zoom + ' clipped the top at ' + projectedTop);
    if (layout.cameraY < 0) {
      assert.ok(Math.abs(projectedTop - 6) <= 1e-8, 'framed top should rest at the margin');
    } else {
      assert.ok(projectedTop > 6, 'zoom ' + zoom + ' shifted the scene unnecessarily');
    }
  }
});

test('zooming out avoids unnecessary camera follow when the projected top is visible', () => {
  const layout = computeCameraLayout({
    width: 1920, height: 1080, scale: 4, frameY: -60, topUnits: -35, zoom: 0.5,
  });
  assert.equal(layout.cameraY, 0);
  const projectedTop = projectCameraPoint(0, layout.framedTopY, 0, layout.cameraPivotY, 0.5).y;
  assert.ok(projectedTop > 6);
});

test('camera-space touch aiming is the inverse of the draw transform', () => {
  const pivotX = 960, pivotY = 420;
  for (const zoom of [0.5, 0.75, 1, 1.5, 2]) {
    const source = { x: 123.25, y: 987.5 };
    const screen = projectCameraPoint(source.x, source.y, pivotX, pivotY, zoom);
    const restored = unprojectCameraPoint(screen.x, screen.y, pivotX, pivotY, zoom);
    assert.ok(Math.abs(restored.x - source.x) < 1e-8);
    assert.ok(Math.abs(restored.y - source.y) < 1e-8);
  }
});
