/** Pixel-art player silhouette shadows derived from Growtopia's DropShadow
 * shader contract: source alpha becomes a solid color mask, shifted by an
 * offset. Effects are deliberately filtered before this projection.
 */
export const PLAYER_VISUAL_SCALE = 0.78; // character is slightly shorter than a full 32-unit land tile
export const PLAYER_SHADOW_OFFSET = 6; // exact output-pixel shift, mirrored by facing
export const PLAYER_SHADOW_DROP = 6; // exact output-pixel downward shift
export const PLAYER_SHADOW_OPACITY = 0.5; // 50% opacity
export const PLAYER_SHADOW_COLOR = Object.freeze([0, 0, 0]);

const excludedPass = /punch|aura|pet|particle|effect|visual|\bfx\b/i;
const excludedAtlas = /particle|effect|ancestral|artifact|aura|punch/i;

/** Return only opaque-sprite draw calls allowed to cast the player's shadow. */
export function getPlayerShadowCalls(calls, {
  ancestralId = null,
  punchingItemId = null,
  punching = false,
} = {}) {
  return calls.filter(call => {
    if (!call || !call.atlas || call.line) return false;
    if (call.owner != null && ancestralId != null && call.owner === ancestralId) return false;
    if (call.owner != null && punchingItemId != null && call.owner === punchingItemId) return false;
    if (call.xmlParticle || call.fxEngine || call.referenceFx || call.particle ||
        call.effect || call.effects || call.visual || call.visuals || call.pet ||
        call.add || call.shadow === false) return false;
    if (excludedPass.test(String(call.pass ?? ""))) return false;
    if (excludedAtlas.test(String(call.atlas))) return false;
    // Punch poses change the arm and hand silhouettes. They must not cast a
    // displaced copy; the torso and non-punch clothing continue to do so.
    if (punching && /arm|hand/i.test(String(call.pass ?? ""))) return false;
    return true;
  }).map(call => ({
    ...call,
    tint: [...PLAYER_SHADOW_COLOR],
    add: false,
  }));
}

/** Avatar destination rect: uniform scale around the rig's feet pivot (16,32). */
export function playerVisualRect(bounds, rootX, rootY, unitScale) {
  const k = PLAYER_VISUAL_SCALE * unitScale;
  return {
    x: rootX + (16 - 16 * PLAYER_VISUAL_SCALE) * unitScale + bounds.x * k,
    y: rootY + (32 - 32 * PLAYER_VISUAL_SCALE) * unitScale + bounds.y * k,
    width: bounds.width * k,
    height: bounds.height * k,
  };
}

/** Directional projection: facing right => bottom-right, left => bottom-left. */
export function playerShadowOffset(cameraZoom, facing) {
  // This helper is called inside the camera's zoom transform. Divide out that
  // transform so the final projected offset remains exactly 6 canvas pixels.
  const zoom = Number.isFinite(cameraZoom) && cameraZoom > 0 ? cameraZoom : 1;
  return {
    x: (facing < 0 ? -1 : 1) * PLAYER_SHADOW_OFFSET / zoom,
    y: PLAYER_SHADOW_DROP / zoom,
  };
}
