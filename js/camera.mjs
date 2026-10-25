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

/** Keep the preview's upper framing boundary correct after camera zoom. */
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
  const basePivotY = baseRootY + 16 * scale;
  const baseTopY = ground - 32 * scale + frameY * scale + topUnits * scale;
  const projectedTopY = basePivotY + (baseTopY - basePivotY) * z;

  // cameraY is non-positive. Moving the world down by -cameraY keeps the
  // transformed head/nameplate below the upper preview edge at every zoom.
  const cameraY = Math.min(0, projectedTopY - topMargin);
  const groundCam = ground - cameraY;
  const rootY = groundCam - 32 * scale + frameY * scale;
  const cameraPivotX = rootX + 16 * scale;
  const cameraPivotY = rootY + 16 * scale;

  return {
    ground, cameraY, groundCam, rootX, rootY,
    cameraPivotX, cameraPivotY, zoom: z,
    framedTopY: baseTopY - cameraY,
  };
}
