/* Pickup-box animation helpers. World positions use the preview's 32-unit coordinates. */
export const PICKUP_ATLAS_RECT = Object.freeze({ x: 160, y: 0, width: 20, height: 20 }); // X8, Y0
export const PICKUP_SIZE = 12;
export const PICKUP_HOVER_HEIGHT = -8.25;
export const PICKUP_SPAWN_DURATION = 400;
export const PICKUP_COLLECTION_DELAY = 500;
// Time spent flying toward the inventory after the initial half-second pause.
export const PICKUP_COLLECTION_DURATION = 750;
// The empty pickup frame clears faster than the icon's flight.
export const PICKUP_BOX_SHRINK_DURATION = 450;
export const PICKUP_ICON_ART_SIZE = 64 * 0.64 + 9;
export const PICKUP_DROP_VARY_MAX = 5;
export const PICKUP_PLAYER_HALF_WIDTH = 8;
export const PICKUP_PLAYER_HEIGHT = 32 * 0.78;
export const PICKUP_COLLECTION_TOTAL_DURATION = PICKUP_COLLECTION_DELAY + PICKUP_COLLECTION_DURATION;
export const PICKUP_FLOAT_AMPLITUDE = 0.8;
export const PICKUP_FLOAT_PERIOD = 1600;

const clamp01 = value => Math.min(1, Math.max(0, value));
const lerp = (a, b, t) => a + (b - a) * t;

/** Random radial offset measured in rendered pixels, bounded by 0–5px. */
export function pickupDropVary(random = Math.random) {
  const radius = clamp01(Number(random()) || 0) * PICKUP_DROP_VARY_MAX;
  const angle = clamp01(Number(random()) || 0) * Math.PI * 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, radius };
}

export function pickupPose(pickup, now, playerFrame) {
  const age = Math.max(0, now - pickup.spawnedAt);
  const targetX = pickup.worldX ?? pickup.targetX;
  const targetY = pickup.worldY ?? pickup.targetY ?? 0;
  if (pickup.collectAt != null) {
    const elapsed = Math.max(0, now - pickup.collectAt);
    // Growtopia-style pickup pause: keep the full box in place for 500 ms
    // before the icon launches and the empty box starts shrinking.
    if (elapsed < PICKUP_COLLECTION_DELAY) {
      return {
        x: targetX,
        y: targetY,
        scale: 1,
        bob: 0,
        progress: 0,
        iconProgress: 0,
        phase: "collect-delay",
      };
    }

    const flightElapsed = Math.max(0, elapsed - PICKUP_COLLECTION_DELAY);
    const progress = clamp01(flightElapsed / PICKUP_COLLECTION_DURATION);
    const boxProgress = clamp01(flightElapsed / PICKUP_BOX_SHRINK_DURATION);
    // The empty frame disappears sooner, while the item icon keeps flying
    // independently for the full duration of its curved trip.
    const boxEased = boxProgress * boxProgress * (3 - 2 * boxProgress);
    return {
      x: targetX,
      y: targetY,
      scale: 1 - boxEased,
      bob: 0,
      progress,
      iconProgress: progress,
      phase: progress >= 1 ? "collected" : "collecting",
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

/**
 * Smooth cubic arc for the item icon flying from the pickup to the inventory.
 * The first control point sends the icon briefly up/right out of the box; the
 * second brings it back left into the inventory target. sizeUnit scales the
 * arc naturally with preview scale and camera zoom.
 */
export function pickupIconFlightPose(start, target, progress, sizeUnit = 1) {
  const t = clamp01(progress);
  const inv = 1 - t;
  const horizontalDistance = Math.max(0, start.x - target.x);
  const c1x = start.x + Math.max(sizeUnit * 1.75, horizontalDistance * 0.25);
  const c1y = start.y - sizeUnit * 1.6;
  const c2x = target.x + Math.max(sizeUnit * 3.5, horizontalDistance * 0.5);
  const c2y = target.y - sizeUnit * 0.85;
  const cubic = (a, b, c, d) =>
    inv * inv * inv * a +
    3 * inv * inv * t * b +
    3 * inv * t * t * c +
    t * t * t * d;
  const fade = clamp01((t - 0.58) / 0.42);
  const smoothFade = fade * fade * (3 - 2 * fade);
  return {
    x: cubic(start.x, c1x, c2x, target.x),
    y: cubic(start.y, c1y, c2y, target.y),
    scale: 1 + 4 * Math.pow(t, 1.6),
    alpha: 1 - smoothFade,
    progress: t,
  };
}

export function pickupShouldCollect(pickup, now, playerFrame) {
  if (pickup.collectAt != null || now - pickup.spawnedAt < PICKUP_SPAWN_DURATION) return false;
  if (!playerFrame || !Number.isFinite(Number(playerFrame.x)) ||
      !Number.isFinite(Number(playerFrame.y))) return false;

  // Treat the visible pickup artwork as a 12-unit collision rectangle and the
  // player as the rendered 0.78-scale body footprint. Collect on first overlap,
  // including while airborne, rather than requiring the player center to enter a radius.
  const pose = pickupPose(pickup, now, playerFrame);
  const halfBox = PICKUP_SIZE * pose.scale / 2;
  const boxLeft = pose.x - halfBox;
  const boxRight = pose.x + halfBox;
  const boxTop = pose.y - PICKUP_SIZE * pose.scale;
  const boxBottom = pose.y;

  const playerX = Number(playerFrame.x);
  const playerY = Number(playerFrame.y);
  const playerLeft = playerX - PICKUP_PLAYER_HALF_WIDTH;
  const playerRight = playerX + PICKUP_PLAYER_HALF_WIDTH;
  const playerTop = playerY - PICKUP_PLAYER_HEIGHT;
  const playerBottom = playerY;

  return playerRight >= boxLeft && playerLeft <= boxRight &&
    playerBottom >= boxTop && playerTop <= boxBottom;
}
