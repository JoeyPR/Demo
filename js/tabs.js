/* TABS: the planner tabs (Equipped / Favorites / Clothing / Custom).
   Weather and Land moved to corner dropdown buttons; the appearance tabs
   (Player Customization / Makeup) were removed with the rendering strip.
   The default tab at startup is Clothing. */
(function(){
  const TABS = [
    { id: 'equip',   label: 'Equipped' },
    { id: 'fav',     label: 'Favorites' },
    { id: 'cloth',   label: 'Clothing' },
    { id: 'custom',  label: 'Custom' }
  ];
  P.tabs = {
    list: TABS.map(t => t.id),
    cur: 'cloth',
    open(id){
      if (!TABS.some(t => t.id === id)) return;
      P.tabs.cur = id;
      P.store.set('tab', id);
      P.$('#main').dataset.t = id;

      /* Set visibility before notifying listeners. Grid refreshes need the
         real visible layout metrics, not a hidden grid's 1-column fallback. */
      const grid = P.$('#grid');
      if (grid) grid.hidden = false;

      document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === id)));
      P.emit('tab', id);
    }
  };
  for (const { id, label } of TABS) {
    const b = document.createElement('button');
    b.className = 'tab'; b.dataset.t = id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', label);
    b.title = label;
    const off = document.createElement('img'); off.className = 'off'; off.src = `img/tab-${id}.png`; off.alt = '';
    const on  = document.createElement('img'); on.className  = 'on';  on.src  = `img/tab-${id}-on.png`; on.alt = '';
    b.append(off, on);
    b.addEventListener('click', () => P.tabs.open(id));
    P.$('#tabs').appendChild(b);
  }
  P.on('open-tab', id => P.tabs.open(id));
  P.tabs.open(P.tabs.cur);   /* always start on the Clothes tab */
})();
