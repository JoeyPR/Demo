/* GRID: the Demo catalog + the planner's eight custom placeholders, filtered
   by the planner tabs (Equipped / Favorites / Clothing / Custom).
   The clothing grid is VIRTUALIZED: only nearby rows are mounted, and boxes
   shared between scroll windows keep their existing thumbnail DOM to avoid blinking.
   Box-focus flow (every item box, quick drawer included):
     click 1 -> box-focus | click 2 -> equipped (focus consumed)
     equipped: click 1 -> box-focus | click 2 -> unequipped (focus consumed) */
(function(){
  const g = P.$('#grid');
  const filterButton = P.$('#filter-button');
  const filterPanel = P.$('#filter-panel');
  let activeFilter = String(P.store.get('filterCategory', 'all'));
  let searchOn = P.store.get('searchOn', true);
  let favs = new Set(P.store.get('favs', []));
  let all = [];            /* decorated items: tab / eq / fav flags */
  let render = [];
  /* virtualization: #grid (scroll container) > #grid-inner (full height) >
     #grid-window (positioned grid holding only the visible rows) */
  const inner = document.createElement('div'); inner.id = 'grid-inner';
  const win = document.createElement('div'); win.id = 'grid-window';
  inner.append(win); g.append(inner);
  let m = null;            /* column metrics */
  let firstRow = -1, lastRow = -1;
  const mounted = new Map();  /* item index -> persistent box element */

  /* the planner's custom clothing placeholders — present in the Custom tab,
     not wearable by the Demo engine (official catalog items only) */
  const CUSTOMS = ['Custom Tee 1', 'Custom Tee 2', 'Custom Pants', 'Custom Shoes',
    'Custom Hat', 'Custom Coat', 'Custom Wings', 'Custom Halo']
    .map((name, i) => ({ id: 200001 + i, name, tab: 'custom', kind: 'cloth',
      qty: 1, fav: false, eq: false, gone: false, wearable: false, slot: null }));

  function build() {
    all = ((P.catalog && P.catalog.items) || []).map(it => (it.tab = 'cloth', it));
    for (const c of CUSTOMS) if (!all.some(it => it.id === c.id)) all.push(c);
    syncFlags();
  }
  function syncFlags() {
    const eq = P.equippedIds || new Set();
    for (const it of all) { it.eq = eq.has(it.id); it.fav = favs.has(it.id); }
  }

  /* Category list derives from slot values present in the loaded catalog.
     P.dat supplies display labels; actual filter membership comes from items. */
  function filterOptions() {
    const bySlot = new Map();
    for (const it of all) {
      if (it.tab === 'custom' || !Number.isInteger(it.slot)) continue;
      const value = String(it.slot);
      if (!bySlot.has(value)) {
        const names = P.dat?.slots || {};
        const rawLabel = names[value] || ('Slot ' + value);
        const label = ({ Hat: 'Hats', Shirt: 'Shirts', Hair: 'Hairs', Ancestral: 'Artifacts' })[rawLabel] || rawLabel;
        bySlot.set(value, { value, label });
      }
    }
    return [
      { value: 'all', label: 'All Categories' },
      ...[...bySlot.values()].sort((a, b) => Number(a.value) - Number(b.value))
    ];
  }

  function setFilterOpen(open) {
    filterPanel.hidden = !open;
    filterButton.setAttribute('aria-expanded', String(open));
  }

  function renderFilterOptions() {
    const options = filterOptions();
    if (!options.some(option => option.value === activeFilter)) {
      activeFilter = 'all';
      P.store.set('filterCategory', activeFilter);
    }
    filterPanel.replaceChildren();
    for (const option of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter-option';
      b.dataset.filter = option.value;
      b.setAttribute('aria-pressed', String(option.value === activeFilter));
      b.textContent = option.label;
      b.addEventListener('click', () => {
        activeFilter = option.value;
        P.store.set('filterCategory', activeFilter);
        renderFilterOptions();
        setFilterOpen(false);
        P.inv.refresh();
      });
      filterPanel.append(b);
    }
    filterButton.title = 'Filter clothing categories — ' +
      (options.find(option => option.value === activeFilter)?.label || 'All Categories');
  }

  filterButton.addEventListener('click', () => setFilterOpen(filterPanel.hidden));
  document.addEventListener('pointerdown', e => {
    if (!filterPanel.hidden && !filterPanel.contains(e.target) && !filterButton.contains(e.target))
      setFilterOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !filterPanel.hidden) {
      setFilterOpen(false);
      filterButton.focus();
    }
  });
  /* donor visibility rule: equip shows equipped, fav shows favorites,
     cloth/custom show items belonging to the tab */
  function visible(it) {
    const tab = P.tabs.cur;
    if (tab === 'equip') return it.eq;
    if (tab === 'fav') return it.fav;
    return it.tab === tab;
  }

  P.inv = {
    sel: null, focus: null,
    find(name) { return all.find(i => i.name === name) || null; },
    itemById(id) { return all.find(i => i.id === id) || null; },
    refresh() {
      const q = (searchOn ? P.$('#q').value : '').trim().toLowerCase();
      syncFlags();
      render = all.filter(it => !it.gone && visible(it) &&
        (activeFilter === 'all' || String(it.slot) === activeFilter) &&
        (!q || it.name.toLowerCase().includes(q) || String(it.id) === q));
      g.scrollTop = 0;
      renderWindow(true);
    }
  };

  function markEquipped() {
    const eq = P.equippedIds || new Set();
    for (const b of win.querySelectorAll('.box')) b.classList.toggle('sel', eq.has(+b.dataset.id));
    for (const b of P.$('#quick').querySelectorAll('.box')) if (b.dataset.id) b.classList.toggle('sel', eq.has(+b.dataset.id));
  }

  function boxEl(it) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'box' + (it.gone ? ' gone' : '') + (favs.has(it.id) ? ' fav' : '') +
      (P.ancestralIds && P.ancestralIds.has(it.id) ? ' art' : '');
    b.dataset.id = it.id;
    if (it.slot != null) b.dataset.slot = it.slot;
    b.setAttribute('aria-label', it.name + ' (#' + it.id + ')');
    b._it = it;
    const ic = document.createElement('span'); ic.className = 'ic';
    const n = document.createElement('span'); n.className = 'n';
    const ck = document.createElement('img'); ck.className = 'ck o'; ck.src = 'img/chk.png'; ck.alt = '';
    const ckArt = document.createElement('img'); ckArt.className = 'ck p'; ckArt.src = 'img/chk-art.png'; ckArt.alt = '';
    b.append(ic, n, ck, ckArt);
    if (favs.has(it.id)) {
      const fv = document.createElement('img'); fv.className = 'fv'; fv.src = 'img/fav-box.png'; fv.alt = '';
      b.append(fv);
    }
    fillBox(b);
    return b;
  }

  /* mount a box's thumbnail + name (only called when the box is seen) */
  function fillBox(b) {
    const it = b._it;
    if (!it) return;
    const ic = b.querySelector('.ic');
    if (ic && !ic.firstChild) {
      const thumbEl = P.thumb ? P.thumb(it, 64) : null;
      if (thumbEl) ic.append(thumbEl);
      else { const ph = document.createElement('span'); ph.className = 'ph'; ph.textContent = '?'; ic.append(ph); }
    }
    const n = b.querySelector('.n');
    if (n && !n.textContent) n.textContent = it.name;   /* kept as metadata; the label itself is hidden (names never show) */
  }
  function layoutMetrics() {
    const cs = getComputedStyle(win);
    let spec = cs.gridTemplateColumns;
    /* a hidden grid keeps its specified value — expand `repeat(n, w)` ourselves */
    const rep = spec.match(/repeat\(\s*(\d+)\s*,\s*([^)]+)\)/);
    if (rep) spec = Array.from({ length: +rep[1] }, () => rep[2]).join(' ');
    const cols = spec.split(' ').map(parseFloat).filter(v => v > 0);
    return {
      n: Math.max(1, cols.length),
      colW: cols[0] || 100,
      rowGap: parseFloat(cs.rowGap) || 0,
      /* square boxes (aspect-ratio 1) + the row gap = one row's height */
      rowH: (cols[0] || 100) + (parseFloat(cs.rowGap) || 0),
      padTop: parseFloat(cs.paddingTop) || 0,
      padBottom: parseFloat(cs.paddingBottom) || 0
    };
  }

  function renderWindow(force) {
    if (!render.length) {
      mounted.clear();
      win.replaceChildren();
      inner.style.height = '0px';
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No items found.';
      win.append(empty);
      firstRow = lastRow = -1;
      return;
    }
    if (!m) m = layoutMetrics();
    const rows = Math.ceil(render.length / m.n);
    inner.style.height = Math.ceil(m.padTop + rows * m.rowH + m.padBottom) + 'px';
    const st = g.scrollTop, vh = g.clientHeight;
    const f = Math.max(0, Math.floor((st - m.padTop) / m.rowH) - 2);
    const l = Math.min(rows - 1, Math.ceil((st + vh - m.padTop) / m.rowH) + 2);
    if (!force && f === firstRow && l === lastRow) return;
    firstRow = f; lastRow = l;
    win.style.top = (firstRow * m.rowH) + 'px';   /* retain overlap between scroll windows */
    if (win.firstElementChild?.classList.contains('empty')) win.replaceChildren();

    const wanted = new Set();
    const ordered = [];
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = 0; col < m.n; col++) {
        const idx = row * m.n + col;
        if (idx >= render.length) break;
        let b = mounted.get(idx);
        if (b && +b.dataset.id !== render[idx].id) {
          b.remove();
          mounted.delete(idx);
          b = null;
        }
        if (!b) {
          b = boxEl(render[idx]);
          mounted.set(idx, b);
        } else {
          syncBox(b, render[idx]);
        }
        wanted.add(idx);
        ordered.push(b);
      }
    }

    for (const [idx, b] of mounted) {
      if (!wanted.has(idx)) {
        b.remove();
        mounted.delete(idx);
      }
    }
    /* Insert only new or misplaced nodes. Shared rows keep the same canvas and
       thumbnail DOM, avoiding a remove/recreate flash on every scroll step. */
    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i];
      const current = win.children[i];
      if (current !== b) win.insertBefore(b, current || null);
    }
    markEquipped();
    markFocus();
  }

  g.addEventListener('scroll', () => renderWindow(false), { passive: true });
  if (window.ResizeObserver) new ResizeObserver(() => { m = null; renderWindow(true); }).observe(g);

  function syncBox(b, it) {
    b._it = it;
    b.classList.toggle('gone', !!it.gone);
    b.classList.toggle('fav', favs.has(it.id));
    b.classList.toggle('art', !!(P.ancestralIds && P.ancestralIds.has(it.id)));
    if (it.slot != null) b.dataset.slot = it.slot;
    else delete b.dataset.slot;
    const fv = b.querySelector('.fv');
    if (favs.has(it.id)) {
      if (!fv) {
        const star = document.createElement('img');
        star.className = 'fv'; star.src = 'img/fav-box.png'; star.alt = '';
        b.append(star);
      }
    } else if (fv) fv.remove();
    const n = b.querySelector('.n');
    if (n) n.textContent = it.name;
  }

  /* ---------------- box-focus activation (the four-click state machine) --- */
  function activate(item) {
    toolArmed = false;                       /* any real-item activation resets the tool sequence */
    const f = P.inv.focus;
    if (f && !f.tool && f.id === item.id) {
      P.inv.focus = null;                      /* consume the focus */
      P.emit('equip', { id: item.id });        /* equipped -> unequips, else equips */
    } else {
      P.inv.focus = item;
    }
    markFocus();
  }

  g.addEventListener('click', e => {
    const b = e.target.closest('.box');
    if (!b) return;
    const item = P.inv.itemById(+b.dataset.id);
    if (!item) return;
    if (item.wearable === false) { P.toast(item.name + ' is a placeholder — custom clothing is not rendered by this engine.'); return; }
    activate(item);
  });

  /* ---------------- quick drawer ---------------------------------------- */
  /* slot 0: the protected Fist/Wrench tool box — box-focus on the first click,
     Fist <-> Wrench swap on every click after that, and the sequence restarts
     (focus, then swap) whenever anything outside the box is activated. The
     box itself is rebuilt on every render, so the sequence state lives at
     module level; a capture-phase pointerdown resets it when the press starts
     outside the box (before any click handler can rebuild the DOM). */
  let toolArmed = false;
  document.addEventListener('pointerdown', e => {
    if (toolArmed && !(e.target.closest && e.target.closest('#quick .box.tool'))) toolArmed = false;
  }, true);

  function toolBox() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'box qbox tool';
    b.dataset.tool = '1';
    b.setAttribute('aria-label', 'Fist / Wrench tool — click for box focus, click again to swap');
    const ic = document.createElement('span'); ic.className = 'ic';
    const img = document.createElement('img');
    const setToolArt = on => {
      img.src = on ? 'img/wrench-quick.png' : 'img/fist.png';
      img.alt = on ? 'Wrench' : 'Fist';
      img.className = on ? 'art-wrench' : 'art-fist';
    };
    setToolArt(P.plateConfig.get().wrenchOn);
    ic.append(img);
    b.append(ic);
    b.addEventListener('click', () => {
      P.inv.focus = { tool: true };
      markFocus();
      if (!toolArmed) { toolArmed = true; return; }   /* first click: box-focus only */
      const pc = P.plateConfig.get();
      const on = !pc.wrenchOn;
      P.plateConfig.setWrenchOn(on);
      if (on && !pc.growId.trim()) P.toast('Type your GrowID in Player Customization to pull up the wrench.');
      setToolArt(on);
    });
    return b;
  }

  function renderQuick() {
    const quick = P.$('#quick');
    quick.replaceChildren();
    quick.append(toolBox());

    // Equipped items stay in the main inventory grid only. Keep the three
    // top-drawer item boxes empty rather than duplicating the equipped gear.
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'box reg empty qbox';
      b.setAttribute('aria-label', 'Empty quick slot — equipped items stay in the inventory');
      b.addEventListener('click', () => {
        P.tabs.open('cloth');
        if (!P.$('#q').disabled) P.$('#q').focus();
        P.toast('Equipped items are listed in the inventory.');
      });
      quick.append(b);
    }
    markFocus();
  }

  /* mark the focused box (yellow brackets) in the inventory and quick drawer tool box */
  function markFocus() {
    const f = P.inv.focus;
    for (const b of win.querySelectorAll('.box')) b.classList.toggle('focus', !!f && !f.tool && +b.dataset.id === f.id);
    for (const b of P.$$('#quick .box')) {
      if (b.classList.contains('tool')) b.classList.toggle('focus', !!f && !!f.tool);
      else if (b.dataset.id) b.classList.toggle('focus', !!f && !f.tool && +b.dataset.id === f.id);
    }
  }

  P.on('equip-state', markEquipped);
  P.on('equip-state', renderQuick);
  P.on('plate-update', renderQuick);
  P.on('catalog', () => { build(); renderFilterOptions(); P.inv.refresh(); renderQuick(); });
  P.on('tab', () => P.inv.refresh());
  P.on('searchOn', on => {
    searchOn = on;
    if (searchOn) P.$('#q').focus();
    P.inv.refresh();
  });
  P.on('fav-toggle', it => {
    if (!it) return;
    if (favs.has(it.id)) { favs.delete(it.id); P.toast('Unfavorited ' + it.name); }
    else { favs.add(it.id); P.toast('Favorited ' + it.name); }
    P.store.set('favs', [...favs]);
    syncFlags(); renderQuick(); P.inv.refresh();
  });

  P.$('#q').addEventListener('input', () => P.inv.refresh());

  build();
  renderFilterOptions();
  renderQuick();
  P.inv.refresh();
})();
