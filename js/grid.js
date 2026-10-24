/* GRID: the Demo catalog + the planner's eight custom placeholders, filtered
   by the planner tabs (Equipped / Favorites / Clothing / Custom). Thumbnails
   are drawn from the Demo sprite atlases (P.thumb); clicking equips through
   the Demo rendering engine. */
(function(){
  const g = P.$('#grid');
  let searchOn = P.store.get('searchOn', true);
  let favs = new Set(P.store.get('favs', []));
  let all = [];            /* decorated items: tab / eq / fav flags */
  let render = [], renderStart = 0;
  const step = 96;
  const more = document.createElement('button'); more.id = 'more'; more.textContent = '…';

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
        (!q || it.name.toLowerCase().includes(q) || String(it.id) === q));
      renderStart = 0;
      renderBoxes();
    }
  };

  function markEquipped() {
    const eq = P.equippedIds || new Set();
    for (const b of g.querySelectorAll('.box')) b.classList.toggle('sel', eq.has(+b.dataset.id));
  }

  function boxEl(it) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'box' + (it.gone ? ' gone' : '') + (favs.has(it.id) ? ' fav' : '') +
      (P.ancestralIds && P.ancestralIds.has(it.id) ? ' art' : '');
    b.dataset.id = it.id;
    if (it.slot != null) b.dataset.slot = it.slot;
    b.title = it.name + ' (#' + it.id + ')';
    const ic = document.createElement('span'); ic.className = 'ic';
    const thumbEl = P.thumb ? P.thumb(it, 64) : null;
    if (thumbEl) ic.append(thumbEl);
    else { const ph = document.createElement('span'); ph.className = 'ph'; ph.textContent = '?'; ic.append(ph); }
    b.append(ic);
    const n = document.createElement('span'); n.className = 'n';
    n.textContent = it.name;
    b.append(n);
    const ck = document.createElement('img'); ck.className = 'ck o'; ck.src = 'img/chk.png'; ck.alt = '';
    b.append(ck);
    if (favs.has(it.id)) {
      const fv = document.createElement('img'); fv.className = 'fv'; fv.src = 'img/fav-box.png'; fv.alt = '';
      b.append(fv);
    }
    return b;
  }

  function renderBoxes() {
    if (!render.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No items found.';
      g.replaceChildren(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    const slice = render.slice(renderStart, renderStart + step);
    for (const it of slice) frag.append(boxEl(it));
    g.replaceChildren(frag);
    if (render.length > renderStart + step) {
      more.addEventListener('click', () => { renderStart += step; renderBoxes(); }, { once: true });
      g.append(more);
    }
    markEquipped();
    markFocus();
  }

  /* quick drawer: 4 regular item boxes showing the first four equipped
     pieces (slot order) — click to unequip. NOT favorites. */
  function renderQuick() {
    const quick = P.$('#quick');
    quick.replaceChildren();
    const eq = [...(P.equippedIds || new Set())]
      .map(id => P.inv.itemById(id)).filter(Boolean)
      .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
    for (let i = 0; i < 4; i++) {
      const it = eq[i];
      if (it) {
        const b = boxEl(it);
        b.classList.add('sel', 'qbox');
        b.classList.remove('art');   /* the top drawer always shows regular boxes */
        b.addEventListener('click', () => { P.emit('equip', { id: it.id }); });
        quick.append(b);
      } else {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'box reg empty qbox';
        b.disabled = true;
        quick.append(b);
      }
    }
  }

  /* mark the focused box (double-tap equip: first click focuses, second
     click equips/unequips — the planner's yellow-brackets behavior) */
  function markFocus() {
    const f = P.inv.focus;
    for (const b of g.querySelectorAll('.box')) b.classList.toggle('focus', !!f && +b.dataset.id === f.id);
  }

  g.addEventListener('click', e => {
    const b = e.target.closest('.box');
    if (!b || b.id === 'more') return;
    const item = P.inv.itemById(+b.dataset.id);
    if (!item) return;
    if (item.wearable === false) { P.toast(item.name + ' is a placeholder — custom clothing is not rendered by this engine.'); return; }
    /* box-focus double-tap: clicking a different box moves the focus; clicking
       the focused box again equips it (or unequips if already worn) */
    const wasFocused = P.inv.focus && P.inv.focus.id === item.id;
    P.inv.focus = item;
    markFocus();
    if (!wasFocused) return;
    const equipped = (P.equippedIds || new Set()).has(item.id);
    P.emit('equip', { id: +b.dataset.id, unequip: equipped });
  });

  P.on('equip-state', markEquipped);
  P.on('equip-state', renderQuick);
  P.on('catalog', () => { build(); P.inv.refresh(); renderQuick(); });
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
  renderQuick();
  P.inv.refresh();
})();
