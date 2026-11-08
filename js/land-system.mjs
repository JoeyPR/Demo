/* ============================================================================
 * land.js — Growtopia-style foreground land system
 * ============================================================================
 * World generation, block rendering with directional connections (autotiling),
 * and player collision on a 32x32 block grid.
 *
 * HOW TO READ THIS FILE
 *   1. Constants        — the world is a grid of 32x32 px tiles
 *   2. BLOCKS           — what each item id is (name, atlas position, behavior)
 *   3. generateWorld()  — Growtopia's default world layout
 *   4. Autotiling       — how neighbors pick a tile's sprite variant
 *   5. renderWorld()    — drawing visible tiles from the atlas
 *   6. Physics          — stepPlayer(): the player stands EXACTLY on blocks
 *   7. Editing          — placeBlock()/removeBlock()
 *
 * Coordinate conventions (memorize these three rules):
 *   - World space is PIXELS, +x right, +y DOWN (screen direction).
 *   - Tile (tx, ty) covers pixels [tx*32 .. tx*32+32) x [ty*32 .. ty*32+32).
 *   - The player is an AABB: x,y is its TOP-LEFT corner; y+h is its FEET.
 *     "Standing exactly on top of a block" means: feet == ty*32 of the tile
 *     below, velocity zero. stepPlayer() guarantees this by snapping.
 *
 * Research sources: see docs/research-findings.md
 * ========================================================================== */

/* ------------------------------ 1. Constants ----------------------------- */

export const TILE = 32;        // every block is 32x32 px
export const WORLD_W = 100;    // standard Growtopia world: 100 x 60 tiles
export const WORLD_H = 60;     // (3200 x 1920 px)
export const WORLD_PX_W = WORLD_W * TILE;
export const WORLD_PX_H = WORLD_H * TILE;

/* Player physics — the Set Planner's own movement constants (verified
 * against its play mode; see ancestrals package docs). Units: px, seconds. */
export const PHYS = {
  SPEED: 250,       // max horizontal speed
  ACCEL: 1200,      // ground acceleration
  FRICTION: 1200,   // ground deceleration when no input
  GRAVITY: 1000,    // downward acceleration
  JUMP_V: 450,      // initial jump velocity (apex ~101 px = ~3.2 tiles)
  RISE_EXTRA: 5000, // extra gravity while rising and jump NOT held (jump-cut)
  MAX_FALL: 400,    // terminal fall speed
};

/* The player's collision box. NOTE: Growtopia's real hitbox size is not
 * public; 24x48 px is our documented choice (fits 1-wide corridors, 2-tall
 * gaps). x,y is the top-left corner of the box. */
export const PLAYER_W = 24;
export const PLAYER_H = 48;

/* ------------------------------- 2. BLOCKS ------------------------------- */
/* Item ids and atlas positions are Growtopia's real item data (see
 * docs/research-findings.md). `spread` selects the connection behavior:
 *   1 = single sprite (no connections)
 *   2 = 8-directional "47-blob" (the classic terrain look)
 *   3 = horizontal 4-variant strip (grass, platforms)
 *   4 = 5-variant directional attachment (W,N,E,S + standalone, e.g. gargoyles)
 *   5 = 4-directional 16-variant blob (lava)
 *   6 = fixed base sprite (decorative items — verified: RenderWorld returns (0,0))
 *   7 = vertical 4-variant strip (bottom/middle/top/isolated — lamp posts, pillars)
 *   9 = 4-variant directional attachment (E,W,S,N + standalone)
 *   8/10 = not documented in any source we found — approximated with the base
 *           sprite (flagged spreadApprox; 3 items total)
 * `collision`: 0 = passable, 1 = solid, 2 = platform (stand on top only).
 *   Exotic collision types (fire, water, slippery...) are approximated as
 *   passable and flagged physicsApprox — raw collisionType is kept on the block.
 * `atlas` = the tile-set origin INSIDE the page PNG, in 32px cells.
 * `page` = which atlas PNG the set lives in (default tiles_page1).
 *
 * The full 4,082-item catalog is generated into items.gen.js (from the
 * up-to-date items.dat dump in tools/items.txt) and merged in with
 * registerBlocks(). The hand-curated entries below are the world-generation
 * core — registerBlocks() verifies they stay consistent. */

export const BLOCKS = {
  0:   { name: 'air',              spread: 1, atlas: [16, 1],  collision: 0 },
  2:   { name: 'dirt',             spread: 2, atlas: [8, 20],  collision: 1 },
  4:   { name: 'lava',             spread: 5, atlas: [4, 6],   collision: 1 },
  6:   { name: 'main door',       spread: 1, atlas: [17, 1],  collision: 0 },
  8:   { name: 'bedrock',         spread: 2, atlas: [0, 26],  collision: 1 },
  10:  { name: 'rock',            spread: 1, atlas: [15, 1],  collision: 1 },
  14:  { name: 'cave background', spread: 2, atlas: [24, 26], collision: 0 },
  16:  { name: 'grass',           spread: 3, atlas: [0, 6],   collision: 0 },
  52:  { name: 'wooden background', spread: 2, atlas: [0, 20], collision: 0 },
  102: { name: 'wooden platform', spread: 3, atlas: [0, 8],   collision: 2 },
  104: { name: 'rock background', spread: 2, atlas: [16, 26], collision: 0 },
  116: { name: 'bricks',          spread: 2, atlas: [8, 26],  collision: 1 },
  336: { name: 'stone wall',      spread: 2, atlas: [16, 20], collision: 1 },
  380: { name: 'lava rock',       spread: 2, atlas: [24, 20], collision: 1 },
  442: { name: 'sand',            spread: 2, atlas: [8, 14],  collision: 1 },
  728: { name: 'clouds',          spread: 2, atlas: [24, 14], collision: 1 },
};

/* Merge generated catalog rows into BLOCKS. Row format (see items.gen.js):
 *   [id, name, action, page, tx, ty, spread, collisionType, layer, flag?]
 * The raw `collisionType` is kept on the block alongside the physics mapping
 * (0 pass / 1 solid / 2 platform; undocumented types approximated as passable
 * and flagged physicsApprox). Rows flagged 'unsupported-artwork' are retained
 * for completeness but marked unsupported (not renderable). Call once at boot:
 * registerBlocks(GROWTOPIA_ITEMS). */
export function registerBlocks(rows) {
  rulesRevision++;
  for (const row of rows) {
    const [id, name, action, page, tx, ty, spread, collisionType, layer, flags = ''] = row;
    const collision = collisionType === 1 ? 1 : collisionType === 2 ? 2 : 0;
    const fl = String(flags).split(';');
    const clamp = fl.find(f => f.startsWith('blob-clamp:'));
    const anim = fl.find(f => f.startsWith('anim:'));   // 'anim:MSxFRAMESxD'
    const tint = fl.find(f => f.startsWith('tint:')); // 'tint:R,G,B'
    let animMs = 0, animFrames = 0, animDir = null;
    if (anim) {
      const m = /^anim:(\d+)x(\d+)x([vh])$/.exec(anim);
      if (m) { animMs = +m[1]; animFrames = +m[2]; animDir = m[3]; }
    }
    let tintRgb = null;
    if (tint) {
      const m = /^tint:(\d+),(\d+),(\d+)$/.exec(tint);
      if (m) tintRgb = [+m[1], +m[2], +m[3]];
    }
    BLOCKS[id] = {
      name: String(name).toLowerCase(),
      spread, atlas: [tx, ty], collision, collisionType,
      page, action, layer,
      eligible: true,                        // catalog row: selectable + placeable
      unsupported: fl.includes('unsupported-artwork'),
      twoDir: fl.includes('two-direction'),  // FLIPPED flag: placeable facing left/right
      blobClamp: clamp ? parseInt(clamp.split(':')[1], 10) : null, // clamped blob rows
      animMs, animFrames, animDir,           // frames stacked below ('v') / right ('h')
      tintRgb,                               // grayscale art colored by the client
      physicsApprox: collisionType !== 0 && collisionType !== 1 && collisionType !== 2,
      spreadApprox: spread === 8 || spread === 10,
    };
  }
  return BLOCKS;
}

/* Background-wall catalog. The Demo data/blocks.json rows are objects whose
   kind is "bg"; they share the same source atlas geometry as foreground land,
   but are always non-colliding and rendered through world.bg. Preserve each
   block's own spread type so its atlas variants remain correct. */

/* (Rendering strip) tintedAtlas removed — tinted tile rasterization. */


/* --------------------------- 3. World generation -------------------------- */

/* A world is two layers of item ids:
 *   world.fg[y][x]  foreground (solid land the player stands on)
 *   world.bg[y][x]  background (rendered behind, never collides)
 * Growtopia's default layout (GTPS docs, corroborated by the wiki):
 *   rows 0-23  air
 *   row 24     surface: dirt, with bedrock + Main Door at the spawn column
 *   rows 25-35 dirt (+ random cave background)
 *   rows 36-53 rock (+ random cave background)
 *   rows 54-59 bedrock (indestructible floor)
 *   lava appears in layers 7-10 below the surface (rows 31-34), in patches. */

// Tiny seeded RNG (mulberry32) so a seed always makes the same world.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateWorld(seed = 1) {
  const rng = makeRng(seed);
  const fg = [], bg = [];
  for (let y = 0; y < WORLD_H; y++) {
    fg.push(new Array(WORLD_W).fill(0));
    bg.push(new Array(WORLD_W).fill(0));
  }
  const world = { seed, fg, bg };

  const SURFACE = 24;         // row of the grass-topped dirt surface
  const DOOR_X = 50;          // main door column (center of the world)

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (y < SURFACE) continue;                       // air
      if (y >= 54) fg[y][x] = 8;                       // bedrock floor
      else if (y >= 36) {                              // rock layer
        fg[y][x] = 10;
        if (rng() < 0.55) bg[y][x] = 14;               // random cave bg
      } else {                                         // dirt layer (25-35)
        fg[y][x] = 2;
        if (rng() < 0.55) bg[y][x] = 14;
      }
    }
  }
  // The surface row: bedrock + Main Door at the spawn column (wiki: a single
  // bedrock block sits under the Main Door; the door itself is passable).
  fg[SURFACE][DOOR_X] = 8;
  fg[SURFACE - 1][DOOR_X] = 6;   // the door sprite, standing on the surface

  // Lava patches, layers 7-10 below the surface (rows 31-34).
  for (let i = 0; i < 14; i++) {
    const cx = 4 + Math.floor(rng() * (WORLD_W - 8));
    const cy = 31 + Math.floor(rng() * 3);      // rows 31-33...
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) {
      if (rng() < 0.8) fg[cy + dy][cx + dx] = 4; // ...spanning up to row 34
    }
  }
  return world;
}

/* (Rendering strip) Autotiling variant selection, the world draw list,
   tile animation frames and renderWorld removed. The world grid, block
   definitions and collision stay — the player still walks and stands on land. */

/* ------------------------- Planner land policy ---------------------------- */
/* The preview's land picker offers only the Dirt and Bedrock families plus a
 * genuine "None" (no land at all). Cave Background is a backdrop, not land:
 * it fills the world's background layer BEHIND the selected foreground
 * blocks and is not drawn when there is no land. */

export const CAVE_BACKGROUND_ID = 14;
export const DEFAULT_BACKGROUND_ID = CAVE_BACKGROUND_ID;
export const LAND_NONE = 'none';
export const DEFAULT_LAND_ID = 2;   /* Dirt — the default land */


/* A land option is any block whose name is from the Dirt or Bedrock family. */
export function isDirtOrBedrockName(name) {
  return typeof name === 'string' && /dirt|bedrock/i.test(name);
}

/* Resolve a stored land selection to LAND_NONE or a block id. 'none'/null
 * stay None; unknown, unsupported or non-dirt/bedrock ids (legacy picks)
 * normalize to None. */
export function resolveLandSelection(value) {
  if (value == null || value === LAND_NONE) return LAND_NONE;
  const id = Number(value);
  if (!Number.isFinite(id)) return LAND_NONE;
  const def = BLOCKS[id];
  if (!def || def.unsupported || !isDirtOrBedrockName(def.name)) return LAND_NONE;
  return id;
}

/* Uniform land world for the preview: rows 0..topRow-1 air, topRow..bottom
 * filled with `blockId` in the foreground and Cave Background behind it in
 * the background layer (renderWorld draws bg first, so it sits behind the
 * blocks). The top row picks up the block's top-edge autotile variant;
 * world-edge columns read as connected so scrolling wraps cleanly. */
export function uniformLandWorld(blockId, topRow = 24, backgroundId = CAVE_BACKGROUND_ID) {
  const fg = [], bg = [];
  for (let y = 0; y < WORLD_H; y++) {
    fg.push(new Array(WORLD_W).fill(y < topRow ? 0 : blockId));
    bg.push(new Array(WORLD_W).fill(y < topRow ? 0 : (backgroundId ?? 0)));
  }
  return { seed: 1, fg, bg, flip: {} };
}

/* A full-viewport wall of one selected background block. Every tile is in the
   background layer, matching Cave Background's non-colliding wall behavior. */

/* ------------------------------ 6. Physics ------------------------------- */
/* Collision queries. Solid = collision 1 (blocks). Platforms (2) are handled
 * specially in stepPlayer: you land on top only while falling. */

export function blockAt(world, tx, ty, layer = 'fg') {
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return 0;
  return world[layer][ty][tx];
}
export function isSolidTile(world, tx, ty) {
  const id = blockAt(world, tx, ty);
  return !!BLOCKS[id] && BLOCKS[id].collision === 1;
}
export function isPlatformTile(world, tx, ty) {
  const id = blockAt(world, tx, ty);
  return !!BLOCKS[id] && BLOCKS[id].collision === 2;
}

/* One physics step. `input` = { left, right, jump } booleans; dt in seconds.
 * Axis-separated movement: X first, then Y — resolving Y second is what makes
 * landing EXACT: when falling into a tile we snap the feet to the tile top
 * (a multiple of 32) and zero the velocity. No epsilon, no jitter. */
export function stepPlayer(p, input, dt, world) {
  dt = Math.min(dt, 0.05);   // supported timestep (callers may pass raw frame dt)
  // --- horizontal ---
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    p.vx += dir * PHYS.ACCEL * dt;
    p.facing = dir;
  } else {
    const s = Math.sign(p.vx);
    p.vx -= s * PHYS.FRICTION * dt;
    if (Math.sign(p.vx) !== s) p.vx = 0;
  }
  p.vx = Math.max(-PHYS.SPEED, Math.min(PHYS.SPEED, p.vx));
  moveAxisX(p, p.vx * dt, world);

  // --- vertical ---
  if (p.grounded && input.jump) {
    p.vy = -PHYS.JUMP_V;
    p.grounded = false;
  }
  const rising = p.vy < 0;
  let g = PHYS.GRAVITY;
  if (rising && !input.jump) g += PHYS.RISE_EXTRA;   // jump-cut (planner behavior)
  p.vy = Math.min(PHYS.MAX_FALL, p.vy + g * dt);
  moveAxisY(p, p.vy * dt, world);
}

function moveAxisX(p, dx, world) {
  p.x += dx;
  const top = Math.floor(p.y / TILE), bot = Math.floor((p.y + PLAYER_H - 1) / TILE);
  if (dx > 0) {                                   // moving right: check right edge
    const tx = Math.floor((p.x + PLAYER_W) / TILE);
    for (let ty = top; ty <= bot; ty++) {
      if (isSolidTile(world, tx, ty)) { p.x = tx * TILE - PLAYER_W; p.vx = 0; break; }
    }
  } else if (dx < 0) {                            // moving left: check left edge
    const tx = Math.floor(p.x / TILE);
    for (let ty = top; ty <= bot; ty++) {
      if (isSolidTile(world, tx, ty)) { p.x = (tx + 1) * TILE; p.vx = 0; break; }
    }
  }
  // world bounds
  p.x = Math.max(0, Math.min(WORLD_PX_W - PLAYER_W, p.x));
}

function moveAxisY(p, dy, world) {
  const feetBefore = p.y + PLAYER_H;
  p.y += dy;
  p.grounded = false;
  const left = Math.floor(p.x / TILE), right = Math.floor((p.x + PLAYER_W - 1) / TILE);
  if (dy > 0) {                                   // falling: check feet
    const ty = Math.floor((p.y + PLAYER_H) / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolidTile(world, tx, ty)) {
        // EXACT LANDING: feet snap to the tile top (a multiple of TILE).
        p.y = ty * TILE - PLAYER_H;
        p.vy = 0;
        p.grounded = true;
        return;
      }
      if (isPlatformTile(world, tx, ty) && feetBefore <= ty * TILE + 0.001) {
        // one-way platform: only when the feet started above its top
        p.y = ty * TILE - PLAYER_H;
        p.vy = 0;
        p.grounded = true;
        return;
      }
    }
  } else if (dy < 0) {                            // rising: check head
    const ty = Math.floor(p.y / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolidTile(world, tx, ty)) {
        p.y = (ty + 1) * TILE;                    // head bumps the tile bottom
        p.vy = 0;
        return;
      }
    }
  }
  // grounded check when standing still on ground (dy == 0 case handled here
  // via gravity: after gravity is applied dy>0 next frame; but also probe):
  if (dy === 0) {
    const ty = Math.floor((p.y + PLAYER_H + 1) / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolidTile(world, tx, ty)) { p.grounded = true; break; }
    }
  }
}

/* ------------------------------ 7. Editing ------------------------------- */
/* Placing/removing is just writing the grid — variants update automatically
 * on the next render because they are computed FROM neighbors every frame.
 * Placement over the player is rejected (Growtopia does the same). */

export function canPlace(world, tx, ty, id, layer = 'fg', player = null) {
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return false;
  // eligibility boundary: only catalog-registered, renderable blocks may be
  // placed — unknown ids, system tiles, unsupported-artwork rows, and
  // hand-curated-only defs (e.g. the world-gen spawn door) are rejected here.
  // Hand-curated defs still RENDER (world generation writes them directly).
  if (!BLOCKS[id] || BLOCKS[id].unsupported || BLOCKS[id].eligible !== true) return false;
  if (world[layer][ty][tx] !== 0) return false;
  if (player && BLOCKS[id] && BLOCKS[id].collision === 1) {
    // solid blocks may not overlap the player (Growtopia rejects this too)
    const overlap = tx * TILE < player.x + PLAYER_W && (tx + 1) * TILE > player.x
                 && ty * TILE < player.y + PLAYER_H && (ty + 1) * TILE > player.y;
    if (overlap) return false;
  }
  return true;
}
export function placeBlock(world, tx, ty, id, layer = 'fg', player = null) {
  if (!canPlace(world, tx, ty, id, layer, player)) return false;
  world[layer][ty][tx] = id;
  // two-direction items record the PLACER's facing at placement time (the
  // game's "placed in two directions, depending on the direction you're
  // facing" mechanic): the sprite renders mirrored when placed facing left.
  const def = BLOCKS[id];
  if (!world.flip) world.flip = {};
  const key = layer + ':' + tx + ',' + ty;
  if (def.twoDir && player && player.facing === -1) world.flip[key] = 1;
  else delete world.flip[key];
  return true;
}
export function removeBlock(world, tx, ty, layer = 'fg') {
  if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return false;
  if (world[layer][ty][tx] === 0) return false;
  world[layer][ty][tx] = 0;
  if (world.flip) delete world.flip[layer + ':' + tx + ',' + ty];
  return true;
}

/* Player spawn: on the Main Door column, feet exactly on the surface (row 24). */
export function spawnPlayer() {
  const x = 50 * TILE + (TILE - PLAYER_W) / 2;   // centered on the door column
  return { x, y: 24 * TILE - PLAYER_H, vx: 0, vy: 0, grounded: true, facing: 1 };
}
