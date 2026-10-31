/* WEATHER BACKGROUND: one selectable Growtopia background block tiled behind
   the player. This is a separate wall layer from the animated Weather picker. */
(function() {
  'use strict';
  const DEFAULT_ID = 14; /* Cave Background */
  let catalog = [];
  let sheetCache = new Map();
  let currentFilter = '';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'dd-background-btn';
  btn.className = 'dd-btn';
  btn.dataset.dd = 'background';
  btn.setAttribute('aria-label', 'Choose weather background block');
  btn.innerHTML = '<span class="dd-thumb"><canvas width="32" height="32"></canvas></span><span>Background</span><span class="dd-caret">▲</span>';

  const panel = document.createElement('div');
  panel.id = 'dd-background-panel';
  panel.className = 'dd-panel';
  panel.dataset.dd = 'background';
  panel.innerHTML =
    '<div class="dd-head dd-bg-head"><strong>Weather Background</strong><input type="search" data-search placeholder="Search background blocks" autocomplete="off" spellcheck="false" aria-label="Search background blocks"></div>' +
    '<div class="dd-body"><div class="dd-bg-tiles" data-tiles></div></div>';

  document.body.append(btn, panel);
  const iconCanvas = btn.querySelector('canvas');
  const searchInput = panel.querySelector('[data-search]');
  const tilesEl = panel.querySelector('[data-tiles]');

  const sheet = texture => {
    if (sheetCache.has(texture)) return sheetCache.get(texture);
    const promise = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'sheets/tiles/' + texture;
    });
    sheetCache.set(texture, promise);
    return promise;
  };

  function drawBlock(canvas, block) {
    if (!canvas || !block) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sheet(block.texture).then(img => {
      if (!img || !canvas.isConnected && canvas !== iconCanvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, block.tx * 32, block.ty * 32, 32, 32,
        0, 0, canvas.width, canvas.height);
    });
  }

  function normalizeCatalog(rows) {
    const ids = new Set();
    const names = new Set();
    return (Array.isArray(rows) ? rows : [])
      .filter(row => row && row.kind === 'bg')
      .filter(row => Number.isInteger(Number(row.id)) && Number(row.id) > 0)
      .filter(row => typeof row.name === 'string' && row.name.trim())
      .filter(row => !/null_item|unavailable/i.test(row.name))
      .filter(row => typeof row.texture === 'string' && row.texture.trim() &&
        !/null_item|unavailable/i.test(row.texture))
      .filter(row => Number.isFinite(Number(row.tx)) && Number.isFinite(Number(row.ty)) &&
        Number.isInteger(Number(row.spread_type)) && Number(row.spread_type) >= 1)
      .filter(row => {
        const id = Number(row.id);
        const name = row.name.trim().toLowerCase();
        if (ids.has(id) || names.has(name)) return false;
        ids.add(id);
        names.add(name);
        return true;
      })
      .map(row => ({
        id: Number(row.id),
        name: row.name.trim(),
        texture: row.texture,
        tx: Number(row.tx),
        ty: Number(row.ty),
        spread_type: Number(row.spread_type),
        kind: 'bg'
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  P.background = {
    get key() {
      const saved = P.store.get('background', String(DEFAULT_ID));
      if (saved === 'none') return null;
      const id = Number(saved);
      return Number.isInteger(id) ? id : DEFAULT_ID;
    },
    set(id) {
      const block = catalog.find(row => row.id === Number(id));
      if (!block) return;
      P.store.set('background', String(block.id));
      P.emit('background', block.id);
      updateIcon();
      markCurrent();
      close();
    },
    get catalog() { return catalog.slice(); }
  };

  function updateIcon() {
    const id = P.background.key;
    const block = catalog.find(row => row.id === id) || catalog.find(row => row.id === DEFAULT_ID);
    if (block) drawBlock(iconCanvas, block);
    else {
      const ctx = iconCanvas.getContext('2d');
      ctx.clearRect(0, 0, 32, 32);
    }
  }

  function makeTile(block, selectedId) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'dd-tile dd-bg-tile' + (block.id === selectedId ? ' on' : '');
    tile.dataset.id = String(block.id);
    tile.title = block.name;
    const square = document.createElement('span');
    square.className = 'dd-sq';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    square.append(canvas);
    const label = document.createElement('span');
    label.className = 'dd-name';
    label.textContent = block.name;
    tile.append(square, label);
    drawBlock(canvas, block);
    tile.addEventListener('click', () => P.background.set(block.id));
    return tile;
  }

  function renderPanel() {
    const selected = P.background.key;
    const query = currentFilter.trim().toLowerCase();
    tilesEl.replaceChildren();
    const visible = catalog.filter(row => !query || row.name.toLowerCase().includes(query));
    const fragment = document.createDocumentFragment();
    for (const block of visible) fragment.append(makeTile(block, selected));
    tilesEl.append(fragment);
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'dd-bg-empty';
      empty.textContent = 'No background blocks found.';
      tilesEl.append(empty);
    }
  }

  function markCurrent() {
    const selected = String(P.background.key);
    for (const tile of tilesEl.querySelectorAll('.dd-bg-tile'))
      tile.classList.toggle('on', tile.dataset.id === selected);
  }

  function open() {
    renderPanel();
    panel.classList.add('open');
    btn.querySelector('.dd-caret').textContent = '▼';
  }
  function close() {
    panel.classList.remove('open');
    btn.querySelector('.dd-caret').textContent = '▲';
  }
  btn.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
  document.addEventListener('click', event => {
    if (panel.classList.contains('open') && !panel.contains(event.target) && !btn.contains(event.target))
      close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  searchInput.addEventListener('input', () => {
    currentFilter = searchInput.value;
    renderPanel();
    searchInput.focus({ preventScroll: true });
  });

  fetch('data/blocks.json').then(response => {
    if (!response.ok) throw new Error('Background block catalog unavailable (' + response.status + ')');
    return response.json();
  }).then(rows => {
    catalog = normalizeCatalog(rows);
    renderPanel();
    updateIcon();
  }).catch(error => {
    console.warn('[Background] Could not load selectable background blocks.', error);
    P.toast('Background block list unavailable');
  });
})();