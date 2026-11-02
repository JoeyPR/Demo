/* SIDE: search switch + STORE/DROP/INFO/FAV/WRENCH/EXPORT acting on the
   focused item. Item WRENCH opens its generated item-specific dialog. */
(function(){
  const side = P.$('#side'), sw = P.$('#sw'), main = P.$('#main'), q = P.$('#q');
  const wrenchButton = P.$('.sbtn[data-a="wrench"]');

  function hasWrenchControls(item) {
    if (!item || item.tool || item.gone || item.wearable === false) return false;
    const definition = item.wrenchDefinition;
    if (!definition) return false;
    const hasControl = control => !!control?.type && control.type !== 'heading';
    return (definition.sharedControls || []).some(hasControl) ||
      (definition.sections || []).some(section => (section.controls || []).some(hasControl));
  }
  function syncWrenchAvailability(item) {
    const focused = item === undefined ? (P.inv.focus || P.inv.sel) : item;
    const available = hasWrenchControls(focused);
    wrenchButton.disabled = !available;
    wrenchButton.setAttribute('aria-disabled', String(!available));
    wrenchButton.title = available ? 'Customize this item' : 'No Wrench settings for this item';
  }
  P.on('item-focus', syncWrenchAvailability);
  P.on('catalog', () => syncWrenchAvailability());
  P.on('equip-state', () => syncWrenchAvailability());
  P.on('tab', () => syncWrenchAvailability());
  syncWrenchAvailability();
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
    if (b.dataset.a === 'export') return; /* handled by app.js */
    /* STORE is disabled for now */
    if (b.dataset.a === 'store') return;
    /* Item WRENCH acts on the focused item, not the nameplate Wrench. */
    if (b.dataset.a === 'wrench') {
      const focused = P.inv.focus || P.inv.sel;
      if (!hasWrenchControls(focused)) {
        syncWrenchAvailability(focused);
        return;
      }
      P.emit('item-wrench-request', focused);
      return;
    }
    const it = P.inv.focus || P.inv.sel;
    /* Fist/Wrench are core tools, not drop-able inventory items. */
    if (!it) return P.toast('Select an item first');
    if (it.tool) {
      if (b.dataset.a === 'drop') return P.blackbox?.("You can't drop that.");
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
