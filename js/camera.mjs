/* THE CAMERA — follow the player's live world position without edge clamps.
   The avatar's visual center remains the zoom focus while world layers move
   relative to cameraWorldX/cameraWorldY. The ground line stays 16 units below
   this center so zooming does not swing the player's body away from the focus. */

export const CAMERA_ZOOM_MIN = 1 / 1.28; // at most 1.28× farther out than default
export const CAMERA_ZOOM_MAX = 4; // close-up zoom for detailed inspection
export const CAMERA_ZOOM_DEFAULT = 1;

export function clampCameraZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return CAMERA_ZOOM_DEFAULT;
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
 * Camera layout for the current player position.
 * frameX/frameY are continuous world coordinates, not viewport coordinates.
 * The camera tracks them every frame and does not clamp to an edge. Horizontal
 * world layers consume cameraWorldX; the ground line moves by -frameY so the
 * player remains on the camera's vertical focus while jumping/falling.
 */
export function computeCameraLayout({ width, height, scale, frameX = 0, frameY, zoom }) {
  for (const [name, value] of Object.entries({ width, height, scale, frameX, frameY })) {
    if (!Number.isFinite(value)) throw new TypeError('Camera layout ' + name + ' must be finite');
  }
  if (scale <= 0 || width <= 0 || height <= 0) {
    throw new RangeError('Camera layout dimensions and scale must be positive');
  }

  const z = clampCameraZoom(zoom);
  const cameraPivotX = width / 2;
  const cameraPivotY = height / 2;
  const cameraWorldX = frameX;
  const cameraWorldY = frameY;
  // Keep the original ground position, but pivot zoom through the player's
  // midpoint instead of the feet: feet = center + 16 logical units.
  const ground = cameraPivotY + 16 * scale - cameraWorldY * scale;
  const rootX = cameraPivotX - 16 * scale;
  // Compensate for ground-line travel so the avatar stays attached to the
  // camera focus even while its world Y coordinate changes.
  const rootY = ground - 32 * scale + cameraWorldY * scale;

  return {
    ground, rootX, rootY,
    cameraPivotX, cameraPivotY, zoom: z,
    cameraWorldX, cameraWorldY,
  };
}
