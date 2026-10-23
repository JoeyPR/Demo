/**
 * Clone an existing renderer definition for a related item.
 *
 * spriteAliases maps SOURCE sprite name -> TARGET sprite name.
 * atlasAliases maps normalized source atlas name -> target atlas name.
 * frameOverrides sets a target sprite's default cell; trackFrames maps an
 * animation track name to an explicit replacement cell list, preserving order.
 * Confirm target atlas cells and frame order before using any adaptation.
 */
export function createRendererAdapter(baseRenderer, {
  name,
  family = baseRenderer?._meta?.family,
  spriteAliases = {},
  atlasAliases = {},
  frameOverrides = {},
  trackFrames = {},
  timingScale = 1,
  offset = [0, 0],
  passOverrides = {},
  matchingItems = []
} = {}) {
  if (!baseRenderer) throw new TypeError("baseRenderer is required");
  if (!(timingScale > 0) || !Number.isFinite(timingScale)) {
    throw new RangeError("timingScale must be finite and > 0");
  }
  if (!Array.isArray(offset) || offset.length < 2 || !offset.slice(0, 2).every(Number.isFinite)) {
    throw new TypeError("offset must be [x, y] with finite numbers");
  }

  const renderer = structuredClone(baseRenderer);
  renderer._meta = {
    ...renderer._meta,
    name: name ?? ((baseRenderer._meta?.name ?? "Renderer") + "Adapter"),
    family,
    adaptedFrom: baseRenderer._meta?.name,
    matchingItems,
    adapter: { spriteAliases, atlasAliases, frameOverrides, trackFrames, timingScale, offset, passOverrides }
  };

  const aliases = {};
  for (const [sourceName, targetName] of Object.entries(spriteAliases)) {
    const def = renderer.sprites?.[sourceName];
    if (!def) throw new Error("Unknown source sprite: " + sourceName);
    aliases[targetName] = {
      ...structuredClone(def),
      atlas: atlasAliases[def.atlas] ?? def.atlas,
      frame: frameOverrides[targetName] ?? def.frame
    };
  }
  for (const def of Object.values(renderer.sprites ?? {})) {
    def.atlas = atlasAliases[def.atlas] ?? def.atlas;
  }
  renderer.sprites = { ...renderer.sprites, ...aliases };

  const remap = sourceName => spriteAliases[sourceName] ?? sourceName;
  for (const track of renderer.animations ?? []) {
    if (track.a?.sprite) track.a.sprite = remap(track.a.sprite);
    if (track.a?.animTime && Number.isFinite(Number(track.a.animTime))) {
      track.a.animTime = String(Number(track.a.animTime) * timingScale);
    }
    const requestedFrames = track.a?.name ? trackFrames[track.a.name] : null;
    if (requestedFrames) {
      const frameNodes = (track.c ?? []).filter(child => child.tag === "Frame");
      if (frameNodes.length !== requestedFrames.length) {
        throw new Error("Track " + track.a.name + " expects " + frameNodes.length +
          " Frame nodes but trackFrames supplied " + requestedFrames.length);
      }
      frameNodes.forEach((node, index) => {
        const cell = requestedFrames[index];
        if (!Array.isArray(cell) || cell.length < 2 || !cell.slice(0, 2).every(Number.isFinite)) {
          throw new TypeError("trackFrames cell must be [x, y] for track " + track.a.name);
        }
        node.v = String(cell[0]) + "," + String(cell[1]);
      });
    }
  }

  const rules = renderer.rules;
  for (const hook of rules?.c ?? []) {
    if (passOverrides[hook.tag]) hook.tag = passOverrides[hook.tag];
    walkVisualNodes(hook, remap, offset);
  }

  // Particle positions are authored on emitters, separately from SpriteRender offsets.
  if (offset[0] !== 0 || offset[1] !== 0) {
    for (const system of renderer.particles ?? []) {
      const emitter = (system.c ?? []).find(child => child.tag === "Emitter");
      if (!emitter) continue;
      let offsetSet = (emitter.c ?? []).find(child => child.tag === "Set" && child.a?.name === "offset");
      if (!offsetSet) {
        offsetSet = { tag: "Set", a: { name: "offset" }, v: "0,0" };
        emitter.c = [...(emitter.c ?? []), offsetSet];
      }
      const xy = String(offsetSet.v ?? "0,0").split(",").map(Number);
      if (xy.length >= 2 && xy.slice(0, 2).every(Number.isFinite)) {
        offsetSet.v = String(xy[0] + offset[0]) + "," + String(xy[1] + offset[1]);
      }
    }
  }
  return renderer;
}

function walkVisualNodes(node, remap, offset) {
  if (!node) return;
  if (node.tag === "SpriteRender" && node.a) {
    if (node.a.name) node.a.name = remap(node.a.name);
    if (offset[0] !== 0 || offset[1] !== 0) {
      const xy = String(node.a.offset ?? "0,0").split(",").map(Number);
      if (xy.length >= 2 && xy.slice(0, 2).every(Number.isFinite)) {
        node.a.offset = String(xy[0] + offset[0]) + "," + String(xy[1] + offset[1]);
      }
    }
  }
  for (const child of node.c ?? []) walkVisualNodes(child, remap, offset);
}
