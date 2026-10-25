/* WEATHER DROPDOWN: the renovated weather picker — a dropdown button pinned
   to the bottom-right corner (of the screen on desktop, below the preview on
   mobile). The panel shows every weather as a fully rendered 1:1 square — a
   real still frame from the animation engine, not a color swatch. Thumbnails
   are rendered lazily (only visible tiles), queued, and cached. Selecting a
   weather calls P.weather.set(key); app.js renders the animated scene. */
(function(){
  'use strict';
  const TILE = 96;           /* logical render size of each square */
  let catalog = null;        /* data/index.json rows */
  let mods = null;          /* weather-engine modules (lazy) */
  const stillCache = new Map(); /* key -> composited TILE x TILE canvas */

  /* ---------------- button + panel scaffolding ---------------- */
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'dd-weather-btn'; btn.className = 'dd-btn'; btn.dataset.dd = 'weather';
  btn.innerHTML = '<span class="dd-thumb"><canvas width="34" height="34"></canvas></span><span>Weather</span><span class="dd-caret">▲</span>';
  const panel = document.createElement('div');
  panel.id = 'dd-weather-panel'; panel.className = 'dd-panel'; panel.dataset.dd = 'weather';
  panel.innerHTML =
    '<div class="dd-head"><strong>Weather</strong><select data-cat></select></div>' +
    '<div class="dd-body"><div class="dd-tiles" data-tiles></div></div>';
  document.body.append(btn, panel);
  const iconCv = btn.querySelector('canvas');
  const catSel = panel.querySelector('[data-cat]');
  const tilesEl = panel.querySelector('[data-tiles]');
  const bodyEl = panel.querySelector('.dd-body');

  /* shared still-frame renderer (cached) — app.js shows it as the preview
     while a newly selected weather's sheets are still loading */
  P.weatherThumb = renderStill;

  P.weather = {
    /* "None" was removed from the weathers — there is always a weather.
       A legacy saved 'none' normalizes to Sunny. */
    get key() {
      const saved = P.store.get('weather', 'sunny');
      return (!saved || saved === 'none') ? 'sunny' : saved;
    },
    set(name) {
      P.store.set('weather', name);
      P.emit('weather', name);
      updateIcon();
      markCurrent();
    }
  };

  /* ---------------- weather engine modules (lazy) ---------------- */
  async function getMods() {
    if (!mods) {
      const [r, cw] = await Promise.all([
        import('../weather-engine/weather-renderer.js'),
        import('../weather-engine/custom-weathers.js')
      ]);
      mods = { WeatherRenderer: r.WeatherRenderer, loadSheets: r.loadSheets, applyCloudFix: cw.applyCloudFix, CLOUD_FIX_KEYS: cw.CLOUD_FIX_KEYS };
    }
    return mods;
  }

  /* ---------------- still frame rendering (cached) ---------------- */
  async function renderStill(key) {
    if (stillCache.has(key)) return stillCache.get(key);
    const m = await getMods();
    const cfg = await (await fetch(`data/variants/base/${key}.json`)).json();
    if (CLOUD_FIX_PENDING.has(key)) m.applyCloudFix(cfg);   /* sunny/monochrome/spring */
    const imgs = await m.loadSheets(cfg, new URL('sheets/', location.href).href);
    const bg = document.createElement('canvas'), fg = document.createElement('canvas');
    bg.width = fg.width = TILE; bg.height = fg.height = TILE;
    const renderer = new m.WeatherRenderer(cfg, imgs, bg, fg);
    renderer.render(Math.round(cfg.loop * cfg.step * 0.4)); /* still frame */
    const out = document.createElement('canvas'); out.width = out.height = TILE;
    const ox = out.getContext('2d');
    ox.imageSmoothingEnabled = false;
    ox.drawImage(bg, 0, 0); ox.drawImage(fg, 0, 0);
    stillCache.set(key, out);
    return out;
  }
  const CLOUD_FIX_PENDING = new Set(['sunny', 'monochrome', 'spring']);

  /* ---------------- lazy tile queue ---------------- */
  /* visible tiles are rendered with a small pool of parallel workers so a
     row of thumbnails fills in quickly without hammering the network */
  const queue = [];          /* [{key, tile}] awaiting render */
  const WORKERS = 4;
  let active = 0;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const tile = e.target;
      io.unobserve(tile);
      queue.push({ key: tile.dataset.key, tile });
    }
    pump();
  }, { root: bodyEl, rootMargin: '96px' });

  function pump() {
    while (active < WORKERS && queue.length) {
      const job = queue.shift();
      active++;
      renderStill(job.key)
        .then(still => {
          if (job.tile.isConnected) {
            const cv = document.createElement('canvas');
            cv.width = cv.height = TILE;
            const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
            x.drawImage(still, 0, 0);
            const sq = job.tile.querySelector('.dd-sq');
            sq.replaceChildren(cv);
          }
        })
        .catch(() => { /* skip broken weather */ })
        .finally(() => { active--; pump(); });
    }
  }

  /* ---------------- panel content ---------------- */
  function build() {
    fetch('data/index.json').then(r => r.json()).then(list => {
      catalog = list;
      renderPanel();
      updateIcon();
    }).catch(() => P.toast('Weather list unavailable'));
  }

  function renderPanel() {
    if (!catalog) return;
    /* category select */
    const cur = catSel.value || 'All';
    const seen = new Set(), groups = [];
    for (const w of catalog) {
      const g = (w.name.split(/\s+/)[0] || 'Other');
      if (!seen.has(g)) { seen.add(g); groups.push(g); }
    }
    catSel.replaceChildren();
    for (const label of ['All', ...groups]) {
      const op = document.createElement('option');
      op.value = label; op.textContent = label;
      catSel.append(op);
    }
    if ([...catSel.options].some(x => x.value === cur)) catSel.value = cur;

    /* tiles — no "None" option: every weather is always active */
    const c = catSel.value;
    tilesEl.replaceChildren();
    const curKey = P.weather.key;
    for (const w of catalog) {
      if (c !== 'All' && (w.name.split(/\s+/)[0] || '') !== c) continue;
      tilesEl.append(makeTile(w.key, w.name, curKey));
    }
  }

  function makeTile(key, name, curKey) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dd-tile' + (key === curKey ? ' on' : '');
    b.dataset.key = key;
    b.title = name;
    const sq = document.createElement('span');
    sq.className = 'dd-sq';
    const loader = document.createElement('span');
    loader.className = 'dd-sq-loading';
    sq.append(loader);
    const label = document.createElement('span');
    label.className = 'dd-name';
    label.textContent = name;
    b.append(sq, label);
    b.addEventListener('click', () => { P.weather.set(key); });
    io.observe(b);
    return b;
  }

  function markCurrent() {
    const curKey = P.weather.key;
    for (const t of tilesEl.querySelectorAll('.dd-tile')) t.classList.toggle('on', t.dataset.key === curKey);
  }

  /* ---------------- button icon ---------------- */
  async function updateIcon() {
    const key = P.weather.key;
    try {
      const still = await renderStill(key);
      const x = iconCv.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.clearRect(0, 0, 34, 34);
      x.drawImage(still, 0, 0, 34, 34);
    } catch (err) { /* leave the icon blank */ }
  }

  /* ---------------- open/close ---------------- */
  function open() { renderPanel(); panel.classList.add('open'); btn.querySelector('.dd-caret').textContent = '▼'; }
  function close() { panel.classList.remove('open'); btn.querySelector('.dd-caret').textContent = '▲'; }
  btn.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
  document.addEventListener('click', e => {
    if (panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  catSel.addEventListener('change', renderPanel);

  build();
})();
