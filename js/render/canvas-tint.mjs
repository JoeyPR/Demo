/* Canvas tint: multiply RGB by the tint (0..255) while preserving alpha.
   If the canvas is tainted (cross-origin host that serves images without a
   CORS header — e.g. a redirecting static proxy), getImageData throws; fall
   back to the untinted pixels so the sprite still draws instead of killing
   the whole character. Same-origin hosts get the full tint. */
export function tintPixelBuffer(canvas, tint) {
  if (!tint) return canvas;
  const out = document.createElement("canvas");
  out.width = canvas.width; out.height = canvas.height;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0);
  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, out.width, out.height);
  } catch (taintError) {
    if (!tintPixelBuffer.warned) {
      tintPixelBuffer.warned = true;
      console.warn("[canvas-tint] canvas is tainted (cross-origin images); drawing untinted.", taintError);
    }
    return out; // already holds the untinted copy
  }
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = Math.round(pixels.data[i] * tint[0] / 255);
    pixels.data[i + 1] = Math.round(pixels.data[i + 1] * tint[1] / 255);
    pixels.data[i + 2] = Math.round(pixels.data[i + 2] * tint[2] / 255);
  }
  ctx.putImageData(pixels, 0, 0);
  return out;
}
