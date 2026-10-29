/* SIDE: search switch + STORE/DROP/INFO/FAV/WRENCH/EXPORT acting on the
   focused item. WRENCH jumps to the wrench section of the Player
   Customization tab; EXPORT saves a player PNG. */
(function(){
  const side = P.$('#side'), sw = P.$('#sw'), main = P.$('#main'), q = P.$('#q');
  const nonSearchableTabs = new Set(['custom', 'player', 'makeup']);

  const setSw = on => {
    on = !!on && !nonSearchableTabs.has(P.tabs.cur);
    sw.setAttribute('aria-checked', String(on));
    side.classList.toggle('srch', on);
    main.classList.toggle('search-disabled', !on);
    q.disabled = !on;
    if (!on) q.value = '';
    P.store.set('searchOn', on);
    // Sync the grid's cached search state with tab-driven enable/disable.
    P.emit('searchOn', on);
  };

  sw.disabled = true; sw.tabIndex = -1; sw.onclick = null;
  P.on('tab', id => setSw(!nonSearchableTabs.has(id)));
  setSw(!nonSearchableTabs.has(P.tabs.cur));

  const A = {
    store(it) { it.gone = true; P.inv.sel = null; P.toast('Stored ' + it.name); },   /* disabled below */
    drop(it)  { it.gone = true; P.inv.sel = null; P.toast('Dropped ' + it.name); },
    info(it)  { P.toast(`${it.name} · #${it.id} · ${it.script ? 'XML renderer' : 'sprite item'}`); },
    fav(it)   { P.emit('fav-toggle', it); },
    wrench()  { P.emit('focus-wrench'); P.emit('open-tab', 'player'); }
  };
  P.$$('.sbtn').forEach(b => b.onclick = () => {
    if (b.dataset.a === 'export') return; /* handled by app.js */
    /* STORE is disabled for now */
    if (b.dataset.a === 'store') return;
    /* WRENCH routes to the wrench section — no item focus needed */
    if (b.dataset.a === 'wrench') { A.wrench(); return; }
    const it = P.inv.focus || P.inv.sel;
    /* the Fist/Wrench tool focus is protected — it is not an item */
    if (!it || it.tool) return P.toast('Select an item first');
    if (b.dataset.a === 'drop') {
      P.emit('drop-request', it);
      return;
    }
    A[b.dataset.a](it);
    if (it.gone) P.inv.focus = null;
    P.inv.refresh();
    P.emit('act', { a: b.dataset.a, it });
  });
  document.querySelector('.sbtn[data-a=store]').disabled = true;
})();
