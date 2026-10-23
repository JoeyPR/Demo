/* TABS: the six planner tabs (Equipped / Favorites / Clothing / Custom /
   Player Customization / Makeup) + Weather and Wrench. Image tabs exactly
   like the donor; weather + wrench reuse the same chrome. */
(function(){
  const TABS = [
    { id: 'equip',   label: 'Equipped' },
    { id: 'fav',     label: 'Favorites' },
    { id: 'cloth',   label: 'Clothing' },
    { id: 'custom',  label: 'Custom' },
    { id: 'player',  label: 'Player Customization' },
    { id: 'makeup',  label: 'Makeup' },
    { id: 'weather', label: 'Weather' },
    { id: 'wrench',  label: 'Wrench' }
  ];
  P.tabs = {
    list: TABS.map(t => t.id),
    cur: P.store.get('tab', 'equip'),
    open(id){
      if (!TABS.some(t => t.id === id)) return;
      P.tabs.cur = id;
      P.store.set('tab', id);
      P.$('#main').dataset.t = id;
      P.$$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === id));
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
  P.tabs.open(P.tabs.cur);
})();
