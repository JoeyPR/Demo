/* GRID: renders the Demo catalog into boxes. Thumbnails are drawn from the
   Demo sprite atlases (exposed by app.js as P.thumb). Clicking equips the
   item through the Demo rendering engine. */
(function(){
  const g = P.$('#grid');
  let category = 'all';
  let searchOn = P.store.get('searchOn', true);
  let favs = new Set(P.store.get('favs', []));
  let render = [], renderStart = 0;
  const step = 96;
  const more = document.createElement('button'); more.id = 'more'; more.textContent = '…';

  P.inv = {
    sel: null, focus: null,
    setCategory(c) { category = c; P.inv.refresh(); },
    catOf(it) { return 'slot' + it.slot; },
    find(name) { return (P.catalog && P.catalog.items.find(i => i.name === name)) || null; },
    itemById(id) { return (P.catalog && P.catalog.items.find(i => i.id === id)) || null; },
    refresh() {
      const q = (searchOn ? P.$('#q').value : '').trim().toLowerCase();
      render = ((P.catalog && P.catalog.items) || []).filter(it => {
        if (it.gone) return false;
        if (category !== 'all' && String(it.slot) !== category) return false;
        if (!q) return true;
        return it.name.toLowerCase().includes(q) || String(it.id) === q;
      });
      renderStart = 0;
      renderBoxes();
    }
  };

  function markEquipped() {
    const eq = P.equippedIds || new Set();
    for (const b of g.querySelectorAll('.box')) b.classList.toggle('sel', eq.has(+b.dataset.id));
  }

  function renderBoxes() {
    const frag = document.createDocumentFragment();
    const slice = render.slice(renderStart, renderStart + step);
    for (const it of slice) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'box' + (it.gone ? ' gone' : '') + (favs.has(it.id) ? ' fav' : '');
      b.dataset.id = it.id; b.dataset.slot = it.slot;
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
      frag.append(b);
    }
    g.replaceChildren(frag);
    if (render.length > renderStart + step) {
      more.addEventListener('click', () => { renderStart += step; renderBoxes(); }, { once: true });
      g.append(more);
    }
    markEquipped();
  }

  function renderQuick() {
    const quick = P.$('#quick');
    const list = [...favs].slice(0, 8).map(id => P.inv.itemById(id)).filter(Boolean);
    quick.replaceChildren();
    for (const it of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'box';
      b.dataset.id = it.id; b.title = it.name;
      const ic = document.createElement('span'); ic.className = 'ic';
      const thumbEl = P.thumb ? P.thumb(it, 64) : null;
      if (thumbEl) ic.append(thumbEl);
      b.append(ic);
      const ck = document.createElement('img'); ck.className = 'ck o'; ck.src = 'img/chk.png'; ck.alt = '';
      b.append(ck);
      b.addEventListener('click', () => P.emit('equip', { id: it.id }));
      quick.append(b);
    }
    if (!list.length) {
      const hint = document.createElement('span');
      hint.className = 'quick-hint'; hint.textContent = 'FAV boxes appear here';
      quick.append(hint);
    }
  }

  g.addEventListener('click', e => {
    const b = e.target.closest('.box');
    if (!b || b.id === 'more') return;
    P.inv.focus = P.inv.itemById(+b.dataset.id);
    P.emit('equip', { id: +b.dataset.id });
  });

  P.on('equip-state', markEquipped);
  P.on('catalog', () => { P.inv.refresh(); renderQuick(); });
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
    renderQuick();
  });

  P.$('#q').addEventListener('input', () => P.inv.refresh());

  renderQuick();
  P.inv.refresh();
})();
