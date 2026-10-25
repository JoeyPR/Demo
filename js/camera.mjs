/* THE CAMERA — one singular system. The preview frames the entire screen and
   the world is drawn under a single player-centered zoom transform:

     translate(pivotX, pivotY); scale(zoom); translate(-pivotX, -pivotY)

   The pivot is the point on the ground under the player's center (the player
   is horizontally centered, so pivotX is the viewport's midline and pivotY is
   the ground line). Zooming therefore scales the scene toward/away from the
   player's feet without moving anything: the ground line, the player and the
   land's top edge stay exactly where they are; only their sizes change.
   There is deliberately NO camera-pan, head-clamp or post-zoom shift — the
   old computeCameraLayout cameraY/topMargin machinery was removed with the
   renovation. Real movement (walking scroll, jump displacement) is preserved
   because it is drawn in world coordinates under the same transform. */

export const CAMERA_ZOOM_MIN = 0.5;
export const CAMERA_ZOOM_MAX = 2;
/* Default zoom is 1 (100%): close to the player, not far away. js/preview.js
   seeds P.camZoom.v from this value — keep the two in sync (guarded by test). */
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
 * The single camera layout. Pure geometry, no zoom-dependent side effects:
 * for a fixed pose every returned position is identical at every zoom —
 * zooming never moves the ground, the player root or the land's top edge.
 *
 * frameY is the player's real vertical displacement in world units (jump),
 * applied to rootY only. The pivot never chases the jump, so a jump still
 * visibly moves the player (displacement scaled by zoom, like every other
 * world distance).
 */
export function computeCameraLayout({ width, height, scale, frameY, zoom }) {
  for (const [name, value] of Object.entries({ width, height, scale, frameY })) {
    if (!Number.isFinite(value)) throw new TypeError('Camera layout ' + name + ' must be finite');
  }
  if (scale <= 0 || width <= 0 || height <= 0) {
    throw new RangeError('Camera layout dimensions and scale must be positive');
  }

  const z = clampCameraZoom(zoom);
  const ground = height / 2 + 16 * scale;
  const rootX = width / 2 - 16 * scale;
  const rootY = ground - 32 * scale + frameY * scale;
  /* Pivot: the ground point under the player's center. rootX + 16*scale is
     the player's midline, which is exactly width/2; pivotY is the ground
     line, so zooming pins the player's feet and the land's top surface. */
  const cameraPivotX = width / 2;
  const cameraPivotY = ground;

  return {
    ground, rootX, rootY,
    cameraPivotX, cameraPivotY, zoom: z,
  };
}
