export const CAMERA_ZOOM_MIN = 0.5;
export const CAMERA_ZOOM_MAX = 2;

export function clampCameraZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, zoom));
}

export function projectCameraPoint(x, y, pivotX, pivotY, zoom) {
  const z = clampCameraZoom(zoom);
  return {
    x: pivotX + (x - pivotX) * z,
    y: pivotY + (y - pivotY) * z,
  };
}

export function unprojectCameraPoint(x, y, pivotX, pivotY, zoom) {
  const z = clampCameraZoom(zoom);
  return {
    x: pivotX + (x - pivotX) / z,
    y: pivotY + (y - pivotY) / z,
  };
}

/**
 * Keep the zoom transform equivalent to the pre-camera-scope renderer:
 * zoom scales the actor's position, jump displacement, ground and nameplate
 * together. The pivot is the stable viewport center, not the moving actor.
 * cameraY is a post-zoom screen-space shift used to keep the head/plate visible.
 */
export function computeCameraLayout({ width, height, scale, frameY, topUnits, zoom, topMargin = 6 }) {
  for (const [name, value] of Object.entries({ width, height, scale, frameY, topUnits, topMargin })) {
    if (!Number.isFinite(value)) throw new TypeError('Camera layout ' + name + ' must be finite');
  }
  if (scale <= 0 || width <= 0 || height <= 0) {
    throw new RangeError('Camera layout dimensions and scale must be positive');
  }

  const z = clampCameraZoom(zoom);
  const ground = height / 2 + 16 * scale;
  const rootX = width / 2 - 16 * scale;
  const baseRootY = ground - 32 * scale + frameY * scale;
  const baseTopY = baseRootY + topUnits * scale;

  // Mirror the legacy layout, where world scale was multiplied by zoom before
  // the camera-follow clamp was calculated.
  const cameraPivotX = width / 2;
  const cameraPivotY = height / 2;
  const projectedTopY = cameraPivotY + (baseTopY - cameraPivotY) * z;
  const cameraY = Math.min(0, projectedTopY - topMargin);
  // Coordinates passed through the shared canvas transform need the inverse
  // offset so the resulting on-screen translation remains exactly -cameraY.
  const cameraOffsetY = -cameraY / z;
  const groundCam = ground + cameraOffsetY;
  const rootY = baseRootY + cameraOffsetY;

  return {
    ground, cameraY, cameraOffsetY, groundCam, rootX, rootY,
    cameraPivotX, cameraPivotY, zoom: z,
    framedTopY: baseTopY + cameraOffsetY,
  };
}
