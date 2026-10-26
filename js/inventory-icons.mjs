
/* Demo-native inventory icon renderer.
   All runtime images are loaded from ../demo/assets/ and all per-item choices
   are read from ../demo/inventory-icons.json. The metadata is derived from
   Set Planner's decoded item records plus Planner's per-item icon indication,
   but neither external renderer nor its colorizer is imported here. */
const DATA_URL = new URL("../demo/inventory-icons.json", import.meta.url);
const ASSET_ROOT = new URL("../demo/assets/", import.meta.url);
let metadataPromise = null;
const imageCache = new Map();
const renderedCache = new Map();
const MAX_RENDERED = 512;
let warnings = 0;

function blankFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);
  return canvas;
}

function loadMetadata() {
  if (!metadataPromise) {
    metadataPromise = fetch(DATA_URL, { cache: "force-cache" }).then(response => {
      if (!response.ok) throw new Error("Demo icon metadata returned HTTP " + response.status);
      return response.json();
    }).then(data => {
      if (data?.schemaVersion !== 1 || !Array.isArray(data.items)) {
        throw new Error("Unexpected Demo inventory icon metadata schema");
      }
      return new Map(data.items.map(row => [String(row.id), row]));
    }).catch(error => {
      metadataPromise = null;
      throw error;
    });
  }
  return metadataPromise;
}

function assetName(value) {
  return String(value ?? "").replace(/\\/g, "/").split("/").pop() || "";
}

function loadSprite(filename) {
  const name = assetName(filename);
  if (!name) return Promise.reject(new Error("Missing local icon asset name"));
  if (!imageCache.has(name)) {
    imageCache.set(name, new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => {
        imageCache.delete(name);
        reject(new Error("Demo icon asset failed to load: " + name));
      };
      image.src = new URL(name, ASSET_ROOT).href;
    }));
  }
  return imageCache.get(name);
}

function candidatePixels(candidate, offsetX = 0, offsetY = 0) {
  const sx = Number(candidate?.sx ?? 0) + offsetX;
  const sy = Number(candidate?.sy ?? 0) + offsetY;
  const sw = Number(candidate?.w ?? 32);
  const sh = Number(candidate?.h ?? 32);
  if (![sx, sy, sw, sh].every(Number.isFinite) || sw <= 0 || sh <= 0) return null;
  return { sx, sy, sw, sh };
}

async function cropCandidate(candidate, offsetX = 0, offsetY = 0) {
  const image = await loadSprite(candidate?.file);
  const rect = candidatePixels(candidate, offsetX, offsetY);
  if (!rect || rect.sx < 0 || rect.sy < 0 ||
      rect.sx + rect.sw > image.naturalWidth ||
      rect.sy + rect.sh > image.naturalHeight) return null;
  const frame = blankFrame();
  const ctx = frame.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, 32, 32);
  return frame;
}

function parseTint(value, skin) {
  if (Array.isArray(value)) {
    const color = value.slice(0, 3).map(Number);
    return color.length === 3 && color.every(Number.isFinite)
      ? color.map(v => Math.max(0, Math.min(255, v))) : null;
  }
  if (value == null || value === "") return null;
  if (value === "s") {
    const color = Array.isArray(skin) ? skin.slice(0, 3).map(Number) : [];
    return color.length === 3 && color.every(Number.isFinite) ? color : [255, 206, 180];
  }
  const hex = String(value).replace(/^#/, "");
  if (!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
}

function tintFrame(frame, tint) {
  if (!tint) return frame;
  const color = tint.map(v => Math.max(0, Math.min(255, Number(v) || 0)));
  // Layer crops may be 64×64 or other native sizes. Preserve their dimensions;
  // forcing them through a 32×32 tint canvas cuts off edges before composition.
  const output = document.createElement("canvas");
  output.width = frame.width;
  output.height = frame.height;
  const ctx = output.getContext("2d", { alpha: true, willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame, 0, 0);
  const pixels = ctx.getImageData(0, 0, output.width, output.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = Math.round(pixels.data[i] * color[0] / 255);
    pixels.data[i + 1] = Math.round(pixels.data[i + 1] * color[1] / 255);
    pixels.data[i + 2] = Math.round(pixels.data[i + 2] * color[2] / 255);
  }
  ctx.putImageData(pixels, 0, 0);
  return output;
}

function hasPixels(frame) {
  const data = frame.getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, 32, 32).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  return false;
}

function compositeFrame(base, layer) {
  const ctx = base.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, 0, 0);
}

async function renderTintedCells(record, skin) {
  const candidate = record.tintCandidate;
  if (!candidate || !Array.isArray(record.iconTints) || !record.iconTints.length) return null;
  const frame = blankFrame();
  for (let i = 0; i < record.iconTints.length; i++) {
    const source = await cropCandidate(candidate, i * Number(candidate.strideX ?? candidate.w ?? 32), 0);
    if (!source) continue;
    const tinted = tintFrame(source, parseTint(record.iconTints[i], skin));
    compositeFrame(frame, tinted);
  }
  return hasPixels(frame) ? frame : null;
}

async function renderVerticalIcon(candidate) {
  const count = Math.max(1, Math.min(16, Number(candidate?.cellHeight) || 1));
  if (!candidate?.vertical || count < 2) return cropCandidate(candidate);
  const output = blankFrame();
  // Set Planner's icon tuple can indicate several vertical frames that must
  // be composited into one inventory icon. Paint bottom-to-top, matching the
  // legacy item-data order, while keeping every source cell at native pixels.
  for (let row = count - 1; row >= 0; row--) {
    const frame = await cropCandidate(candidate, 0, row * 32);
    if (frame) compositeFrame(output, frame);
  }
  return hasPixels(output) ? output : null;
}

async function renderSourceTint(record, candidate, frame) {
  if (!record.sourceTint?.length) return frame;
  const file = assetName(candidate?.file);
  const base = file.replace(/_icon\.png$/i, ".png");
  if (base !== record.sourceTintTarget && file !== record.sourceTintIconFile) return frame;
  return tintFrame(frame, record.sourceTint);
}

function cropIconFrame(source, x = 112, y = 112) {
  // iconLayers are positioned around (128,128) on a work canvas. Capture the
  // full native 32x32 icon cell; do not alpha-trim and enlarge its visible art.
  if (!source || x < 0 || y < 0 || x + 32 > source.width || y + 32 > source.height) return null;
  const output = blankFrame();
  const ctx = output.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, x, y, 32, 32, 0, 0, 32, 32);
  return output;
}

async function renderWebsiteLayers(layers, skin = null, baseFrame = null) {
  if (!Array.isArray(layers) || !layers.length) return null;
  // Mirrors Set Planner GT's iconLayers placement data locally; no remote
  // renderer/runtime is used. The original source sheets are in Demo's assets.
  const work = document.createElement("canvas");
  work.width = work.height = 320;
  const ctx = work.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 320, 320);
  let drew = false;
  for (const layer of layers) {
    try {
      const image = await loadSprite(layer.a);
      const sx = Number(layer.sx ?? 0), sy = Number(layer.sy ?? 0);
      const sw = Number(layer.sw ?? 32), sh = Number(layer.sh ?? 32);
      if (sx < 0 || sy < 0 || sw <= 0 || sh <= 0 ||
          sx + sw > image.naturalWidth || sy + sh > image.naturalHeight) continue;
      const crop = document.createElement("canvas");
      crop.width = Math.max(1, Math.round(sw));
      crop.height = Math.max(1, Math.round(sh));
      const cropCtx = crop.getContext("2d", { alpha: true });
      cropCtx.imageSmoothingEnabled = false;
      cropCtx.drawImage(image, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
      const tinted = tintFrame(crop, parseTint(layer.t, skin));
      const [kx0, ky0] = Array.isArray(layer.k) ? layer.k : [1, 1];
      const kx = Number(kx0) || 1, ky = Number(ky0) || 1;
      const [flipX, flipY] = Array.isArray(layer.f) ? layer.f : [0, 0];
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(layer.o ?? 1)));
      ctx.globalCompositeOperation = layer.add ? "lighter" : "source-over";
      ctx.translate(128 + Number(layer.x ?? 0), 128 + Number(layer.y ?? 0));
      if (Number(layer.r)) ctx.rotate(Number(layer.r) * Math.PI / 180);
      ctx.scale(kx * (flipX ? -1 : 1), ky * (flipY ? -1 : 1));
      ctx.drawImage(tinted, -Number(layer.ax ?? 0.5) * sw, -Number(layer.ay ?? 0.5) * sh, sw, sh);
      ctx.restore();
      drew = true;
    } catch {
      // Missing secondary art does not prevent the primary item icon rendering.
    }
  }
  // Website's iconLayers are background/secondary artwork. Keep their native
  // transforms, then paint the selected per-item icon source on top instead
  // of returning the secondary layers as if they were the entire icon.
  if (baseFrame) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(baseFrame, 112, 112);
    ctx.restore();
    drew = true;
  }
  return drew ? cropIconFrame(work, 112, 112) : null;
}

async function renderProfileLayers(record, candidates, skin = null) {
  const layers = record.profileLayers;
  if (!Array.isArray(layers) || !layers.length) return null;
  const frame = blankFrame();
  const ctx = frame.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;
  for (const layer of layers) {
    try {
      const name = assetName(layer.path);
      const image = await loadSprite(name);
      const cellX = Math.max(0, Number(layer.cellX) || 0);
      const cellY = Math.max(0, Number(layer.cellY) || 0);
      const fw = Math.max(1, Number(layer.frameWidth) || 32);
      const fh = Math.max(1, Number(layer.frameHeight) || 32);
      if (cellX * fw + fw > image.naturalWidth || cellY * fh + fh > image.naturalHeight) continue;
      const crop = blankFrame();
      crop.getContext("2d", { alpha: true }).drawImage(image, cellX * fw, cellY * fh, fw, fh, 0, 0, 32, 32);
      compositeFrame(frame, tintFrame(crop, parseTint(layer.color ?? layer.tint, skin)));
    } catch {}
  }
  return hasPixels(frame) ? frame : null;
}

async function renderPairedFeet(candidate) {
  const primary = await cropCandidate(candidate);
  if (!primary || !hasPixels(primary)) return primary;
  const cx = Number(candidate.cellX ?? 0), cy = Number(candidate.cellY ?? 0);
  const fw = Number(candidate.strideX ?? candidate.w ?? 32), fh = Number(candidate.strideY ?? candidate.h ?? 32);
  const verticalY = cy % 2 === 0 ? cy + 1 : cy - 1;
  const vertical = await cropCandidate(candidate, 0, (verticalY - cy) * fh).catch(() => null);
  const horizontalX = cx ^ 1;
  const horizontal = await cropCandidate(candidate, (horizontalX - cx) * fw, 0).catch(() => null);
  let first = primary, second = null;
  if (vertical && hasPixels(vertical)) {
    second = vertical;
    if (cy % 2 !== 0) [first, second] = [vertical, primary];
  } else if (horizontal && hasPixels(horizontal)) {
    second = horizontal;
    if (cx % 2 !== 0) [first, second] = [horizontal, primary];
  }
  const output = blankFrame();
  compositeFrame(output, first);
  if (second) compositeFrame(output, second);
  return output;
}

const PREHISTORIC_SPRITE = "p_prehistoric.png";
const PREHISTORIC_COLORS = Object.freeze({ red: 0, green: 1, brown: 2, grey: 3, gray: 3 });
const PREHISTORIC_SPECIES = Object.freeze([
  "pteranodon", "pterosaurus", "pteranus rex", "pteratops",
  "apatodon", "apatosaurus", "apatos rex", "apatoceratops",
  "tyranodon", "tyranopatos", "tyrannosaurus", "tyranotops",
  "triceradon", "tripatosaurus", "tricerus rex", "triceratops",
]);

function prehistoricCell(item) {
  // Official dinosaur pets have sixteen species IDs per color. The sprite sheet
  // stores colors as X columns (red/green/brown/grey) and species as Y rows.
  // Seed IDs are odd and deliberately excluded from this pet-icon override.
  const id = Number(item?.id ?? item?.raw?.id);
  if (Number.isInteger(id) && id >= 3952 && id <= 4078 && id % 2 === 0) {
    const offset = id - 3952;
    const column = Math.floor(offset / 32);
    const row = Math.floor((offset % 32) / 2);
    if (column >= 0 && column < 4 && row >= 0 && row < PREHISTORIC_SPECIES.length)
      return { column, row };
  }

  // Name-based fallback allows equivalent catalogs to use different item IDs.
  const name = String(item?.name ?? item?.raw?.name ?? "").toLowerCase();
  if (!/\\bpet\\b/.test(name) || /\\bseed\\b/.test(name)) return null;
  const row = PREHISTORIC_SPECIES.findIndex(species => name.includes(species));
  if (row < 0) return null;
  const color = Object.keys(PREHISTORIC_COLORS).find(key => name.includes(key));
  return { column: color ? PREHISTORIC_COLORS[color] : 0, row };
}

async function renderPrehistoricIcon(cell) {
  if (!cell) return null;
  // The sprite's original 32×32 cells contain complete, clean icons. Crop only
  // the requested species row and color column; the live PetEngine is untouched.
  return cropCandidate({
    file: PREHISTORIC_SPRITE,
    sx: cell.column * 32,
    sy: cell.row * 32,
    w: 32,
    h: 32,
  });
}

async function makeFrame(record, fallbackItem, skin) {
  const candidates = Array.isArray(record?.candidates) ? record.candidates : [];
  let frame = null;
  if (record?.iconTints?.length && record.tintCandidate) {
    try {
      frame = await renderTintedCells(record, skin);
      if (!frame || !hasPixels(frame)) frame = null;
    } catch {}
  }
  if (!frame && record?.profileLayers?.length) {
    // Profile-layer instructions are explicit per-item icon metadata. Treat
    // them as a primary source, but still allow any extra Website icon layers
    // to be composed around them below.
    try {
      const composite = await renderProfileLayers(record, candidates, skin);
      if (composite && hasPixels(composite)) frame = composite;
    } catch {}
  }
  if (!frame) {
    let lastError = null;
    for (const candidate of candidates) {
      try {
        const candidateFrame = record?.iconRule === "paired-feet.static-composition"
          ? await renderPairedFeet(candidate)
          : candidate.vertical ? await renderVerticalIcon(candidate) : await cropCandidate(candidate);
        if (!candidateFrame || !hasPixels(candidateFrame)) continue;
        frame = await renderSourceTint(record, candidate, candidateFrame);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    // Demo-only last resort: use its catalog atlas cell rather than a
    // question-mark placeholder. Coordinates remain catalog-native.
    if (!frame) {
      const atlas = assetName(fallbackItem?.atlas);
      if (atlas) {
        try {
          const x = Number(fallbackItem?.x ?? 0), y = Number(fallbackItem?.y ?? 0);
          const candidateFrame = await cropCandidate({ file: atlas, sx: x * 32, sy: y * 32, w: 32, h: 32 });
          if (candidateFrame && hasPixels(candidateFrame)) frame = candidateFrame;
        } catch (error) {
          lastError = error;
        }
      }
    }
    if (!frame && warnings++ < 5) console.warn("Demo could not resolve an inventory icon from its local sprite data.", {
      id: fallbackItem?.id, name: fallbackItem?.name, error: lastError
    });
  }

  // Website's iconLayers are secondary visual layers; they must never replace
  // the icon sheet/profile cell selected for the item. Compose them together
  // in the same coordinate space, preserving each layer's offsets and tint.
  if (Array.isArray(record?.iconLayers) && record.iconLayers.length) {
    try {
      const composed = await renderWebsiteLayers(record.iconLayers, skin, frame);
      if (composed && hasPixels(composed)) frame = composed;
    } catch {}
  }
  return frame && hasPixels(frame) ? frame : blankFrame();
}

function paintContained(canvas, frame) {
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // The 64x64 backing canvas is 2x density for the full 32x32 source cell.
  // Draw the entire cell, including transparent margins; never scale its
  // alpha-bounded artwork to fill the inventory slot.
  ctx.drawImage(frame, 0, 0, 32, 32, 0, 0, 64, 64);
}

export async function renderDemoInventoryIcon(canvas, item, skin = null) {
  if (!(canvas instanceof HTMLCanvasElement) || !item) return;
  // A 2× internal canvas gives the 32×32 source a crisp inventory-sized output.
  if (canvas.width !== 64 || canvas.height !== 64) {
    canvas.width = 64;
    canvas.height = 64;
  }
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 64, 64);
  const token = Symbol("demo-inventory-icon");
  canvas.__demoIconToken = token;

  const prehistoric = prehistoricCell(item);
  if (prehistoric) {
    const frame = await renderPrehistoricIcon(prehistoric);
    if (canvas.__demoIconToken !== token) return;
    // Dinosaur pet icons always use the provided clean sprite sheet; don't fall
    // back to the marked game atlas if that image fails to load.
    paintContained(canvas, frame ?? blankFrame());
    return;
  }

  try {
    const items = await loadMetadata();
    if (canvas.__demoIconToken !== token) return;
    const record = items.get(String(Number(item.id)));
    const skinKey = Array.isArray(skin) ? skin.slice(0, 3).join(",") : "";
    const hasSkinTint = record?.iconTints?.includes("s")
      || record?.iconLayers?.some(layer => layer.t === "s")
      || record?.profileLayers?.some(layer => layer.color === "s" || layer.tint === "s");
    const cacheKey = String(Number(item.id)) + (hasSkinTint ? "|" + skinKey : "");
    let frame = renderedCache.get(cacheKey);
    if (!frame) {
      frame = await makeFrame(record, item, skin);
      if (canvas.__demoIconToken !== token) return;
      renderedCache.set(cacheKey, frame ?? blankFrame());
      if (renderedCache.size > MAX_RENDERED) renderedCache.delete(renderedCache.keys().next().value);
    }
    if (canvas.__demoIconToken !== token) return;
    paintContained(canvas, frame ?? blankFrame());
  } catch (error) {
    if (warnings++ < 5) console.error("Demo inventory icon metadata failed to load.", error);
    // Use the local item's atlas as a fallback if metadata is unavailable.
    try {
      const frame = await cropCandidate({
        file: assetName(item.atlas),
        sx: (Number(item.x) || 0) * 32,
        sy: (Number(item.y) || 0) * 32,
        w: 32, h: 32
      });
      if (canvas.__demoIconToken === token && frame) paintContained(canvas, frame);
    } catch {}
  }
}
