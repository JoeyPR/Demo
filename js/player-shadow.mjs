/** Shadow projection constants from Growtopia's DropShadow shader contract.
 *  After the rendering strip only the shared constants and the fixed offset
 *  projection remain — the Drop system's pickup shadows consume them. */
export const PLAYER_VISUAL_SCALE = 1; // native 32-unit player rig and world tiles share one scale
export const PLAYER_SHADOW_OFFSET = 12; // fixed leftward output-pixel shift
export const PLAYER_SHADOW_DROP = 12; // exact output-pixel downward shift
export const PLAYER_SHADOW_OPACITY = 0.5; // 50% opacity
export const PLAYER_SHADOW_COLOR = Object.freeze([0, 0, 0]);

/** Fixed left-directional projection. Facing never changes the shadow offset. */
export function playerShadowOffset(_facing) {
  return { x: -PLAYER_SHADOW_OFFSET, y: PLAYER_SHADOW_DROP };
}
