/* LAND DROPDOWN: the renovated land picker — a dropdown button pinned to the
   bottom-left corner (of the screen on desktop, below the preview on mobile).
   The panel lists every foreground block as a square tile drawn from the
   shared tile-sheet pages, chunked so a huge catalog never blocks the UI.
   Selecting a block calls P.land.set(id); app.js renders the ground strip.
   There is deliberately no "None" option — Dirt is the default land. */
(function(){
  'use strict';
  let blocks = null;        /* fg rows: [id,name,action,page,tx,ty,...] */
  let shown = 0;            /* chunked rendering cursor */
  let chunkPending = false;
  const CHUNK = 150;
  const CATS = [[14, 'Platforms'], [15, 'Bedrock'], [16, 'Lava'], [17, 'Foreground']];
  const DEFAULT_LAND = 2;  /* Dirt */
  const pageImages = new Map(), pageLoads = new Map();

  /* ---------------- button + panel scaffolding ---------------- */
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'dd-land-btn'; btn.className = 'dd-btn'; btn.dataset.dd = 'land';
  btn.innerHTML = '<span class="dd-thumb"><canvas width="32" height="32"></canvas></span><span>Land</span><span class="dd-caret">▲</span>';
  const panel = document.createElement('div');
  panel.id = 'dd-land-panel'; panel.className = 'dd-panel'; panel.dataset.dd = 'land';
  panel.innerHTML =
    '<div class="dd-head"><strong>Land</strong><select data-cat></select></div>' +
    '<div class="dd-body"><div class="dd-tiles dd-tiles-land" data-tiles></div></div>';
  document.body.append(btn, panel);
  const iconCv = btn.querySelector('canvas');
  const catSel = panel.querySelector('[data-cat]');
  const tilesEl = panel.querySelector('[data-tiles]');
  const bodyEl = panel.querySelector('.dd-body');

  P.land = {
    get key() {
      const saved = P.store.get('land', null);
      if (saved == null || saved === 'none') return DEFAULT_LAND;
      return Number.isFinite(+saved) ? +saved : DEFAULT_LAND;
    },
    set(id) {
      P.store.set('land', String(id));
      P.emit('land', id);
      updateIcon();
      markCurrent();
    }
  };

  /* ---------------- tile-sheet page loading ---------------- */
  function pageImage(name) {
    if (pageImages.has(name)) return Promise.resolve(pageImages.get(name));
    if (pageLoads.has(name)) return pageLoads.get(name);
    const load = new Promise(res => {
      const img = new Image();
      img.onload = () => { pageImages.set(name, img); res(img); };
      img.onerror = () => { pageImages.set(name, null); res(null); };
      img.src = 'sheets/tiles/' + name + '.png';
    });
    pageLoads.set(name, load);
    return load;
  }

  function drawBlock(cv, b, size) {
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const draw = img => {
      if (!img) return;
      g.clearRect(0, 0, size, size);
      g.drawImage(img, b[4] * 32, b[5] * 32, 32, 32, 0, 0, size, size);
    };
    pageImage(b[3]).then(draw);
  }

  /* ---------------- chunked tile rendering ---------------- */
  function visibleBlocks() {
    if (!blocks) return [];
    const c = catSel.value;
    if (!c || c === 'All') return blocks;
    const action = (CATS.find(x => x[1] === c) || [])[0];
    return blocks.filter(b => b[2] === action);
  }

  function makeTile(b, curId) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'dd-tile' + (b[0] === curId ? ' on' : '');
    el.dataset.id = String(b[0]);
    el.title = b[1];
    const sq = document.createElement('span');
    sq.className = 'dd-sq';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    sq.append(cv);
    const label = document.createElement('span');
    label.className = 'dd-name';
    label.textContent = b[1];
    el.append(sq, label);
    drawBlock(cv, b, 32);
    el.addEventListener('click', () => P.land.set(b[0]));
    return el;
  }

  function pumpChunks() {
    if (chunkPending || !blocks) return;
    chunkPending = true;
    requestAnimationFrame(() => {
      chunkPending = false;
      const list = visibleBlocks();
      const curId = P.land.key;
      while (shown < list.length && tilesEl.querySelectorAll('.dd-tile').length < 4000) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < CHUNK && shown < list.length; i++, shown++) frag.append(makeTile(list[shown], curId));
        tilesEl.append(frag);
        if (shown < list.length) { pumpChunks(); return; }
      }
    });
  }

  function renderPanel() {
    if (!blocks) return;
    const cur = catSel.value || 'All';
    catSel.replaceChildren();
    for (const label of ['All', ...CATS.map(x => x[1])]) {
      const op = document.createElement('option');
      op.value = label; op.textContent = label;
      catSel.append(op);
    }
    if ([...catSel.options].some(x => x.value === cur)) catSel.value = cur;
    shown = 0;
    tilesEl.replaceChildren();
    pumpChunks();
  }

  function markCurrent() {
    const curId = P.land.key;
    for (const t of tilesEl.querySelectorAll('.dd-tile')) t.classList.toggle('on', +t.dataset.id === curId);
  }

  /* ---------------- button icon ---------------- */
  function updateIcon() {
    const id = P.land.key;
    const b = blocks && blocks.find(x => x[0] === id);
    if (b) drawBlock(iconCv, b, 32);
  }

  /* ---------------- load ---------------- */
  function build() {
    fetch('data/land-blocks.json?v=2').then(r => {
      if (!r.ok) throw Error(r.status);
      return r.json();
    }).then(list => {
      blocks = list;
      renderPanel();
      updateIcon();
    }).catch(() => P.toast('Land list unavailable'));
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
