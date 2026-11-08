/* SIDE: search switch + STORE/DROP/INFO/FAV acting on the focused item. */
(function(){
  const side = P.$('#side'), sw = P.$('#sw'), main = P.$('#main'), q = P.$('#q');
  const nonSearchableTabs = new Set(['equip', 'custom', 'player', 'makeup']);

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
    info(it)  { P.emit('info-request', it); },
    fav(it)   { P.emit('fav-toggle', it); }
  };
  P.$$('.sbtn').forEach(b => b.onclick = () => {
    /* STORE is disabled for now */
    if (b.dataset.a === 'store') return;
    const it = P.inv.focus || P.inv.sel;
    /* Fist/Wrench are core tools, not drop-able inventory items. */
    if (!it) return P.toast('Select an item first');
    if (it.tool) {
      if (b.dataset.a === 'drop') return P.blackbox?.("You can't drop that.");
      if (b.dataset.a === 'info') { A.info(it); return; }
      return;
    }
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
