/* RENDER CONTENT — the decrypted setplanner content pipeline.
   Every protected d/ blob was decrypted ahead of time (tools/decrypt-blobs.py)
   into a plain self-contained file, so the demo never talks to a key server:
   everything loads instantly with a plain fetch. Item fx blobs are large, so
   they are stored gzip-compressed and inflated with the browser's built-in
   DecompressionStream. */

const cache = new Map();

async function loadJson(url) {
  if (cache.has(url)) return cache.get(url);
  const pending = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ": HTTP " + res.status);
    if (url.endsWith(".gz")) {
      const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    return res.json();
  })();
  cache.set(url, pending);
  return pending;
}

/* Item fx tracks (position/scale/rotation/color keyframes, loops every 10s). */
export const itemFx = id => loadJson(`render/data/fx/${id}.json.gz`);

/* Compiled Growtopia ItemRenderer scripts (wings, auras, capes, ...). */
export const itemRenderer = name =>
  loadJson(`render/data/renderers/${encodeURIComponent(name)}.json`);

/* Punch styles (31) and the punch index/ids meta blob. */
export const punchStyle = n => loadJson(`render/data/punch/${n}.json`);
export const punchMeta = () => loadJson("render/data/punch-meta.json");

/* Emote poses (dance, fold-arms, ...). */
export const emotes = () => loadJson("render/data/emotes.json");

/* Weather presets (81) — the setplanner weather-parallax track data. */
export const weatherPreset = key => loadJson(`weather/${key}.json`);

/* World kit data (tile rules, block kinds, item sheets, break data). */
export const worldRules = () => loadJson("world/rules.json");
