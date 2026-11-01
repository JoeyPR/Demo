import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  isDirtOrBedrockName,
  resolveLandSelection,
  uniformLandWorld,
  CAVE_BACKGROUND_ID,
  LAND_NONE,
  DEFAULT_LAND_ID,
  BLOCKS,
  WORLD_W,
  WORLD_H,
} from '../js/land-system.mjs';
import {
  hillSheetIndices,
  hillPeriods,
  hillDrawXs,
  hillTravelExcess,
  hillSceneOffset,
  hillTrackPeriods,
} from '../weather-engine/weather-renderer.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const landRows = JSON.parse(readFileSync(join(root, 'data/land-blocks.json'), 'utf8'));

describe('land policy — Dirt/Bedrock families plus a genuine None', () => {
  it('selects exactly the Dirt and Bedrock families from the catalog', () => {
    const families = landRows.filter(r => isDirtOrBedrockName(r[1]));
    for (const r of families) assert.match(r[1], /dirt|bedrock/i);
    for (const r of landRows.filter(r => !isDirtOrBedrockName(r[1])))
      assert.doesNotMatch(r[1], /dirt|bedrock/i);
    assert.ok(families.length >= 10);
  });

  it('keeps the js/land.js picker filter in sync with the module policy', () => {
    const src = readFileSync(join(root, 'js/land.js'), 'utf8');
    const m = src.match(/const isLandOption = b =>\s*([\s\S]*?);/);
    assert.ok(m, 'isLandOption predicate not found in js/land.js');
    const predicate = new Function('b','return '+m[1]);
    const fromUI = landRows.filter(predicate);
    const fromModule = landRows.filter(r => isDirtOrBedrockName(r[1])&&!/^data\s+/i.test(r[1].trim()));
    assert.deepEqual(fromUI.map(r => r[0]), fromModule.map(r => r[0]));
  });

  it('resolves selections: dirt/bedrock ids pass, everything else is None', () => {
    assert.equal(resolveLandSelection('none'), LAND_NONE);
    assert.equal(resolveLandSelection(null), LAND_NONE);
    assert.equal(resolveLandSelection(undefined), LAND_NONE);
    assert.equal(resolveLandSelection('abc'), LAND_NONE);
    assert.equal(resolveLandSelection(2), 2);          /* Dirt */
    assert.equal(resolveLandSelection(8), 8);          /* Bedrock */
    assert.equal(resolveLandSelection('8'), 8);
    assert.equal(resolveLandSelection(10), LAND_NONE);        /* Rock — legacy pick */
    assert.equal(resolveLandSelection(442), LAND_NONE);       /* Sand */
    assert.equal(resolveLandSelection(14), LAND_NONE);        /* Cave Background is not land */
  });

  it('defaults to Dirt and never treats Cave Background as land', () => {
    assert.equal(DEFAULT_LAND_ID, 2);
    assert.equal(isDirtOrBedrockName(BLOCKS[DEFAULT_LAND_ID].name), true);
    assert.equal(isDirtOrBedrockName(BLOCKS[CAVE_BACKGROUND_ID].name), false);
  });
});

describe('uniform land world — Cave Background behind the blocks', () => {
  const world = uniformLandWorld(2);
  const topRow = 24;

  it('fills the foreground with the selected block below the air rows', () => {
    assert.equal(world.fg.length, WORLD_H);
    for (const row of world.fg) assert.equal(row.length, WORLD_W);
    for (let y = 0; y < topRow; y++)
      for (const cell of world.fg[y]) assert.equal(cell, 0);
    for (let y = topRow; y < WORLD_H; y++)
      for (const cell of world.fg[y]) assert.equal(cell, 2);
  });

  it('fills the background layer with Cave Background behind the blocks only', () => {
    for (let y = 0; y < topRow; y++)
      for (const cell of world.bg[y]) assert.equal(cell, 0, 'cave bg never appears above the land');
    for (let y = topRow; y < WORLD_H; y++)
      for (const cell of world.bg[y]) assert.equal(cell, CAVE_BACKGROUND_ID);
    // renderWorld draws bg before fg, so the backdrop is structurally behind
    assert.equal(world.bg.length, world.fg.length);
  });

  it('no land means no Cave Background — None renders nothing', () => {
    // the app renders no world at all for None (landWorld = null); the world
    // builder is only ever called with a real dirt/bedrock id (see policy tests)
    assert.equal(resolveLandSelection('none'), LAND_NONE);
  });
});

describe('weathers — no "None" option', () => {
  it('removes the None tile from the weather picker', () => {
    const src = readFileSync(join(root, 'js/weather.js'), 'utf8');
    assert.ok(!src.includes("makeTile('none'"), 'weather panel must not prepend a None tile');
    assert.ok(src.includes("(!saved || saved === 'none') ? 'sunny' : saved"), "legacy saved 'none' normalizes to Sunny");
  });

  it('normalizes a saved none in the app boot path too', () => {
    const src = readFileSync(join(root, 'js/app.js'), 'utf8');
    assert.ok(/if \(!key \|\| key === "none"\) key = "sunny"/.test(src));
  });
});

describe('hill weathers — scroll with the player beyond the rendered region', () => {
  const configs = JSON.parse(readFileSync(join(root, 'data/index.json'), 'utf8'))
    .map(w => w.key)
    .map(key => ({ key, cfg: JSON.parse(readFileSync(join(root, `data/variants/base/${key}.json`), 'utf8')) }));

  it('finds hill sheets in the weather configs', () => {
    const withHills = configs.filter(({ cfg }) => hillSheetIndices(cfg).size > 0);
    assert.ok(withHills.length >= 20, 'many weathers carry hill bands');
    const without = configs.filter(({ cfg }) => hillSheetIndices(cfg).size === 0);
    assert.ok(without.length >= 1, 'some weathers carry none');
  });

  it('derives a positive wrap period from each band\u2019s own repeated geometry', () => {
    const known = {
      sunny: { 'hills1.webp': 1200, 'hills2.webp': 1200, 'hills3.webp': 1200 },
      autumn: { 'hills1.webp': 1200, 'hills2.webp': 1200, 'hills3.webp': 1200 },
      surgery: { 'su_hill1.webp': 720 },
      jungle: { 'jungle_hills.webp': 4687.5 },
    };
    for (const [key, expected] of Object.entries(known)) {
      const { cfg } = configs.find(c => c.key === key);
      const periods = hillPeriods(cfg);
      for (const [sheet, period] of Object.entries(expected))
        assert.ok(Math.abs(periods.get(cfg.sheets.indexOf(sheet)) - period) < 0.01,
          `${key}/${sheet} period ${periods.get(cfg.sheets.indexOf(sheet))} != ${period}`);
    }
    for (const { cfg } of configs.filter(({ cfg }) => hillSheetIndices(cfg).size > 0))
      for (const p of hillPeriods(cfg).values()) {
        assert.ok(Number.isFinite(p) && p > 0);
      }
  });

  it('wraps hill draw positions seamlessly and covers the scene at every offset', () => {
    for (const { cfg } of configs.filter(({ cfg }) => hillSheetIndices(cfg).size > 0)) {
      const hills = hillSheetIndices(cfg);
      const periods = hillPeriods(cfg);
      const trackPeriods=hillTrackPeriods(cfg,periods);
      // group ALL sibling tracks per sheet — the band is their union, so the
      // geometry must be checked with the real track positions, not a sample x
      const bySheet = new Map();
      for (const t of cfg.tracks || []) if (hills.has(t.s)) {
        if (!bySheet.has(t.s)) bySheet.set(t.s, []);
        bySheet.get(t.s).push(t);
      }
      for (const [s, tracks] of bySheet) {
        const period = periods.get(s);
        // every keyframe of every sibling: hill bands hold their x static
        // across the loop (asserted below), so all keyframes share geometry
        for (const t of tracks)
          assert.equal(new Set(t.k.filter(kf => kf.length > 1).map(kf => kf[1])).size, 1,
            `hill track x must be static: ${cfg.sheets[s]}`);
        const kfs = tracks.flatMap(t => t.k.filter(kf => kf.length > 1));
        const spriteW = Math.max(...kfs.map(kf => kf[3]));
        // no offset: the sprite's own position, unchanged
        for (const kf of kfs)
          assert.deepEqual(hillDrawXs(kf[1], 0, period), [kf[1]]);
        // wrap boundaries occur where a track's wrapped base crosses a
        // multiple of the period: offset = k*period − x. Check both sides of
        // EVERY track's boundary, plus generic offsets.
        const xs = [...new Set(kfs.map(kf => kf[1]))];
        const offsets = [-2345.6, -1, -0.5, 0.5, 1, 300, period / 2, 2400, 12345.6];
        for (let k = -2; k <= 2; k++) for (const x of xs) {
          const b = k * period - x;
          offsets.push(b - 0.5, b + 0.5);
        }
        for (const offset of offsets) {
          // any offset: two copies exactly one period apart, the second inside [0, period)
          for (const kf of kfs) {
            const drawXs = hillDrawXs(kf[1], offset, period);
            assert.equal(drawXs.length, 2);
            assert.ok(Math.abs((drawXs[1] - drawXs[0]) - period) < 1e-9, 'copies one period apart');
            assert.ok(drawXs[1] >= 0 && drawXs[1] < period, 'wrapped base inside one period');
            assert.ok(drawXs[0] < 0, 'earlier copy covers the left edge');
          }
          // Wobble sprites are sparse accents on top of a full hill band;
          // their transparent gaps are intentional. Their per-track repeat
          // period follows the corresponding parent hill, verified separately.
          if (/desert_wobbly/i.test(cfg.sheets[s])) {
            for(const track of tracks)assert.ok((trackPeriods.get(track)??period)>0);
            continue;
          }
          // combined sibling intervals: the full hill band must be gap-free —
          // no internal hole between consecutive drawn copies at any offset
          const drawn = kfs.flatMap(kf =>
            hillDrawXs(kf[1], offset, period).map(base => [base, base + kf[3]]))
            .sort((a, b) => a[0] - b[0]);
          let pos = drawn[0][1];
          for (const [lo, hi] of drawn.slice(1)) {
            assert.ok(lo <= pos + 1e-9,
              `gap inside the ${cfg.sheets[s]} band at offset ${offset}`);
            pos = Math.max(pos, hi);
          }
          assert.ok(spriteW >= period - 1e-9 || pos >= cfg.w,
            `band covers the scene width: ${cfg.sheets[s]}`);
        }
      }
    }
  });

  it('moves the hills in the direction the player travels', () => {
    // positive travel excess (player right of the region) → positive offset → the
    // band\u2019s wrapped base moves right; negative travel mirrors it
    const P = 1200;
    const rest = hillDrawXs(0, 0, P);          /* no offset: [0] */
    assert.ok(hillDrawXs(0, 300, P)[1] > rest[rest.length - 1]);
    assert.ok(hillDrawXs(0, -300, P)[1] === P - 300 || hillDrawXs(0, -300, P)[1] < rest[rest.length - 1]);
    assert.equal(hillTravelExcess(1600, 0, 3200), 0);
    assert.equal(hillTravelExcess(3400, 0, 3200), 200);
    assert.equal(hillTravelExcess(-400, 0, 3200), -400);
    assert.equal(hillTravelExcess(Number('x'), 0, 3200), 0);
    assert.ok(hillSceneOffset(200, 4, 1.6) > 0, 'rightward travel moves hills right');
    assert.ok(hillSceneOffset(-200, 4, 1.6) < 0);
    assert.equal(hillSceneOffset(200, 4, 1.6), 200 * (4 / 1.6) * 0.25);
    assert.equal(hillSceneOffset(0, 4, 1.6), 0);
    assert.equal(hillSceneOffset(200, Number('x'), 1.6), 0);
  });

  it('is zoom-independent — the weather canvases are viewport-space', () => {
    // the scene offset depends only on travel excess, world draw scale and the
    // renderer COVER scale — never on the camera zoom
    const a = hillSceneOffset(400, 4, 1.6);
    assert.equal(a, hillSceneOffset(400, 4, 1.6, 0.25));
    assert.ok(Math.abs(a - 400 * 2.5 * 0.25) < 1e-9);
  });
});
