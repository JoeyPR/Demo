import { BLOCKS, TILE, WORLD_W, WORLD_H, renderWorld, animFrame } from './land-system.mjs';

// Rasterize static terrain only when its cells, adjacent cells, art or animation
// frame change. Fingerprints include a one-cell halo for connected textures.
export class WorldRenderer {
  constructor({ createCanvas = () => document.createElement('canvas'), chunkTiles = 8, maxChunks = 128 } = {}) {
    if (!Number.isInteger(chunkTiles) || chunkTiles < 1 || !Number.isInteger(maxChunks) || maxChunks < 1) throw Error('Invalid terrain cache budget');
    Object.assign(this, { createCanvas, chunkTiles, maxChunks });
    this.world = null; this.chunks = new Map(); this.imageIds = new WeakMap(); this.nextImageId = 1;
    this.stats = { rasterized: 0, hits: 0, draws: 0 };
  }
  invalidate() { this.chunks.clear(); }
  fingerprint(world, atlas, tx, ty, now) {
    const parts = [], n = this.chunkTiles;
    let complete = true;
    for (const layer of ['bg', 'fg']) {
      for (let y = Math.max(0, ty - 1); y < Math.min(WORLD_H, ty + n + 1); y++) {
        for (let x = Math.max(0, tx - 1); x < Math.min(WORLD_W, tx + n + 1); x++) {
          const id = world[layer][y][x], def = BLOCKS[id];
          parts.push(id, world.flip?.[`${layer}:${x},${y}`] ?? 0);
          if (!id || !def || def.unsupported) continue;
          const image = typeof atlas === 'function' ? atlas(def.page || 'tiles_page1') : atlas;
          if (!image) { complete = false; continue; }
          if (!this.imageIds.has(image)) this.imageIds.set(image, this.nextImageId++);
          parts.push(this.imageIds.get(image), animFrame(def, now), def.spread, def.atlas.join(','), def.tintRgb?.join(',') ?? '', def.blobClamp ?? '');
        }
      }
    }
    return { key: parts.join(':'), complete };
  }
  draw(ctx, world, atlas, camX, camY, viewW, viewH, now = 0) {
    if (!world) return;
    if (![camX, camY, viewW, viewH, now].every(Number.isFinite) || viewW <= 0 || viewH <= 0) throw Error('Invalid terrain viewport');
    if (this.world !== world) { this.world = world; this.invalidate(); }
    const size = this.chunkTiles * TILE;
    const x0 = Math.max(0, Math.floor(camX / size)), y0 = Math.max(0, Math.floor(camY / size));
    const x1 = Math.min(Math.ceil(WORLD_W / this.chunkTiles) - 1, Math.floor((camX + viewW - .00001) / size));
    const y1 = Math.min(Math.ceil(WORLD_H / this.chunkTiles) - 1, Math.floor((camY + viewH - .00001) / size));
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(0, 0, viewW, viewH); ctx.clip(); ctx.imageSmoothingEnabled = false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const id = `${x},${y}`, stamp = this.fingerprint(world, atlas, x * this.chunkTiles, y * this.chunkTiles, now);
        let chunk = this.chunks.get(id);
        if (!chunk || chunk.key !== stamp.key) {
          const canvas = chunk?.canvas ?? this.createCanvas();
          canvas.width = Math.min(size, WORLD_W * TILE - x * size);
          canvas.height = Math.min(size, WORLD_H * TILE - y * size);
          const layer = canvas.getContext('2d'); layer.imageSmoothingEnabled = false;
          renderWorld(layer, world, atlas, x * size, y * size, canvas.width, canvas.height, now);
          chunk = { canvas, key: stamp.key }; this.stats.rasterized++;
        } else this.stats.hits++;
        this.chunks.delete(id);
        if (stamp.complete) this.chunks.set(id, chunk);
        while (this.chunks.size > this.maxChunks) this.chunks.delete(this.chunks.keys().next().value);
        ctx.drawImage(chunk.canvas, x * size - camX, y * size - camY); this.stats.draws++;
      }
    } finally { ctx.restore(); }
  }
}
