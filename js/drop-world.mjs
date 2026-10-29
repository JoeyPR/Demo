/* Pickup-box animation helpers. World positions use the preview's 32-unit coordinates. */
export const PICKUP_ATLAS_RECT = Object.freeze({ x: 160, y: 0, width: 20, height: 20 }); // X8, Y0
export const PICKUP_SIZE = 12;
export const PICKUP_HOVER_HEIGHT = -8.25;
export const PICKUP_SPAWN_DURATION = 400;
export const PICKUP_COLLECTION_DURATION = 360;
export const PICKUP_FLOAT_AMPLITUDE = 0.8;
export const PICKUP_FLOAT_PERIOD = 1600;

const clamp01 = value => Math.min(1, Math.max(0, value));
const lerp = (a, b, t) => a + (b - a) * t;

export function pickupPose(pickup, now, playerFrame) {
  const age = Math.max(0, now - pickup.spawnedAt);
  const targetX = pickup.worldX ?? pickup.targetX;
  const targetY = pickup.worldY ?? pickup.targetY ?? 0;
  if (pickup.collectAt != null) {
    const progress = clamp01((now - pickup.collectAt) / PICKUP_COLLECTION_DURATION);
    // The collection effect shrinks the box at its fixed drop point. Never
    // animate its world coordinates toward the moving player/camera.
    const eased = progress * progress * (3 - 2 * progress);
    return {
      x: targetX,
      y: targetY,
      scale: 1 - eased,
      bob: 0,
      progress,
      phase: "collecting",
    };
  }

  // The reference animation scales the pickup from tiny to full size over roughly four frames.
  const progress = clamp01(age / PICKUP_SPAWN_DURATION);
  const grow = Math.max(0.04, progress * progress);
  const arc = Math.sin(progress * Math.PI) * 4.2;
  const y = lerp(pickup.startY ?? targetY, targetY, progress) - arc;
  const bobAge = Math.max(0, age - PICKUP_SPAWN_DURATION);
  const bob = age < PICKUP_SPAWN_DURATION
    ? 0
    : Math.sin((bobAge / PICKUP_FLOAT_PERIOD) * 2 * Math.PI) * PICKUP_FLOAT_AMPLITUDE;
  return {
    x: lerp(pickup.startX ?? targetX, targetX, grow),
    y,
    scale: grow,
    bob,
    progress,
    phase: progress < 1 ? "spawning" : "floating",
  };
}

export function pickupShouldCollect(pickup, now, playerFrame, reach = 5) {
  if (pickup.collectAt != null || now - pickup.spawnedAt < PICKUP_SPAWN_DURATION) return false;
  if (!playerFrame || !playerFrame.ground) return false;
  const playerY = Number(playerFrame.y ?? 0);
  const targetX = Number(pickup.worldX ?? pickup.targetX);
  const targetY = Number(pickup.worldY ?? pickup.targetY ?? 0);
  const droppedGroundY = targetY - PICKUP_HOVER_HEIGHT;
  return Math.abs(playerFrame.x - targetX) <= reach &&
    Math.abs(playerY - droppedGroundY) <= 4;
}
