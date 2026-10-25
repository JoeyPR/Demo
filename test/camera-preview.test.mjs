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

test('camera layout matches fe5851f scale-before-layout behavior at every zoom', () => {
  const width = 1920, height = 1080, scale = 4, frameY = -60, topUnits = -35;
  for (const zoom of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
    const layout = computeCameraLayout({ width, height, scale, frameY, topUnits, zoom });
    const scaled = scale * zoom;
    const baselineGround = height / 2 + 16 * scaled;
    const baselineRootY = baselineGround - 32 * scaled + frameY * scaled;
    const baselineFreeTop = baselineRootY + topUnits * scaled;
    const baselineCameraY = Math.min(0, baselineFreeTop - 6);

    near(layout.cameraY, baselineCameraY);
    near(layout.cameraPivotX, width / 2);
    near(layout.cameraPivotY, height / 2);
    near(projectCameraPoint(0, layout.groundCam, 0, height / 2, zoom).y,
      baselineGround - baselineCameraY);
    near(projectCameraPoint(0, layout.rootY, 0, height / 2, zoom).y,
      baselineRootY - baselineCameraY);
    const projectedTop = projectCameraPoint(0, layout.framedTopY, 0, height / 2, zoom).y;
    near(projectedTop, baselineFreeTop - baselineCameraY);
    assert.ok(projectedTop >= 6 - 1e-8, 'zoom ' + zoom + ' clipped the head/nameplate');
    if (baselineCameraY < 0) near(projectedTop, 6);
  }
});

test('jump displacement scales with zoom instead of being absorbed by the pivot', () => {
  const input = { width: 1920, height: 1080, scale: 4, topUnits: -5, zoom: 1.5 };
  const grounded = computeCameraLayout({ ...input, frameY: 0 });
  const jumping = computeCameraLayout({ ...input, frameY: -10 });
  const groundedRoot = projectCameraPoint(0, grounded.rootY, 0, input.height / 2, input.zoom).y;
  const jumpingRoot = projectCameraPoint(0, jumping.rootY, 0, input.height / 2, input.zoom).y;
  near(jumpingRoot - groundedRoot, -10 * input.scale * input.zoom);
});

test('zooming out avoids unnecessary camera follow when the projected top is visible', () => {
  const layout = computeCameraLayout({
    width: 1920, height: 1080, scale: 4, frameY: -60, topUnits: -35, zoom: 0.5,
  });
  assert.equal(layout.cameraY, 0);
  const projectedTop = projectCameraPoint(0, layout.framedTopY, 0, 540, 0.5).y;
  assert.ok(projectedTop > 6);
});

test('camera-space touch aiming is the inverse of the draw transform', () => {
  const pivotX = 960, pivotY = 420;
  for (const zoom of [0.5, 0.75, 1, 1.5, 2]) {
    const source = { x: 123.25, y: 987.5 };
    const screen = projectCameraPoint(source.x, source.y, pivotX, pivotY, zoom);
    const restored = unprojectCameraPoint(screen.x, screen.y, pivotX, pivotY, zoom);
    near(restored.x, source.x);
    near(restored.y, source.y);
  }
});
