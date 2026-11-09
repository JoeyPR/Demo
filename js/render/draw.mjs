/* DRAW — atlas blits from the native player renderer's draw list.
   The setplanner reference packs all items into per-vertex-band sprites; our
   fx blobs record absolute (sx, sy, sw, sh) atlas rectangles in source pixels,
   x/y anchor positions in 32-unit logical rig coordinates, ax/ay anchor
   fractions, and a u draw band. We project each call into a local rig-space
   canvas whose origin is the player root, then blit that onto the entity
   canvas through the camera projection. Tint multiplies RGB and preserves
   alpha (per-item, never a whole-composite tint). */

import { tintPixelBuffer } from "./canvas-tint.mjs";

export class PlayerAtlas {
  constructor() { this.images = new Map(); }
  async ensure(names) {
    await Promise.all(names.map(async name => {
      if (this.images.has(name)) return;
      const img = new Image();
      img.src = new URL(`../../atlas/${encodeURIComponent(name)}`, import.meta.url).href;
      await img.decode().catch(() => {});
      this.images.set(name, img);
    }));
  }
  get(name) { return this.images.get(name); }
  has(name) { return this.images.has(name) && (this.images.get(name).naturalWidth ?? 0) > 0; }
}

/* Sprite matrix: anchor the (sw, sh) source rect at (x, y) with (ax, ay). */
function spriteMatrix(record) {
  const sw = record.sw ?? 32, sh = record.sh ?? 32;
  const ax = record.ax ?? 0.5, ay = record.ay ?? 0.5;
  return [1, 0, 0, 1, (record.x ?? 0) - sw * ax, (record.y ?? 0) - sh * ay];
}

/* Helper: skin-relative tint (multiply RGB preserve alpha), used when the
   caller passes a literal rgb array or "SKIN" sentinel. */

function applyMatrix(ctx, m) {
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
}

/* Compose two affine matrices (column-vector, canvas order). */
function mul(a, b) {
  return [
    a[0]*b[0] + a[2]*b[1],
    a[1]*b[0] + a[3]*b[1],
    a[0]*b[2] + a[2]*b[3],
    a[1]*b[2] + a[3]*b[3],
    a[0]*b[4] + a[2]*b[5] + a[4],
    a[1]*b[4] + a[3]*b[5] + a[5]
  ];
}

/* Draw one call list onto a ctx. `skin` is the current skin rgb (tint for the
   base pieces tagged "SKIN"). `tintCache` caches per-call tinted crops. */
export function drawPlayerCalls(ctx, calls, atlases, skin) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const call of calls) {
    const img = atlases.get(call.atlas);
    if (!img) continue;
    const m = mul(IDENT, call.matrix ?? spriteMatrix(call));
    applyMatrix(ctx, m);
    ctx.globalAlpha = call.o ?? 1;
    let tint = null;
    if (call.tint === "SKIN") tint = skin.slice(0, 3);
    else if (Array.isArray(call.tint)) tint = call.tint.slice(0, 3);
    if (tint) {
      // tint per-call crop, cached on the image by (sx,sy,sw,sh,tint)
      if (!img.__tints) img.__tints = new Map();
      const key = `${call.sx},${call.sy},${call.sw},${call.sh},${tint.join(",")}`;
      let crop = img.__tints.get(key);
      if (!crop) {
        const c = document.createElement("canvas");
        c.width = call.sw; c.height = call.sh;
        const cc = c.getContext("2d", { willReadFrequently: true });
        cc.imageSmoothingEnabled = false;
        cc.drawImage(img, call.sx, call.sy, call.sw, call.sh, 0, 0, call.sw, call.sh);
        crop = tintPixelBuffer(c, tint);
        img.__tints.set(key, crop);
      }
      ctx.drawImage(crop, 0, 0);
    } else {
      // alpha-only tint would be handled above; otherwise blit the raw cell
      ctx.drawImage(img, call.sx, call.sy, call.sw, call.sh, 0, 0, call.sw, call.sh);
    }
  }
  ctx.restore();
}

const IDENT = [1, 0, 0, 1, 0, 0];
