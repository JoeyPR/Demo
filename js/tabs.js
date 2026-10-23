/* TABS: CUSTOM / ALL / WEATHER / WRENCH. The opts row is a categorical
   selector whose contents depend on the active tab:
   - ALL: slot category select for the item grid
   - WEATHER: weather categories + one button per weather
   - WRENCH: wrench styles / decorations menus */
(function(){
  const t = P.$('#tabs'), o = P.$('#opts'), cat = P.$('#category'), row = P.$('#optsrow');
  const tabs = [['custom', 'CUSTOM'], ['all', 'ALL'], ['weather', 'WEATHER'], ['wrench', 'WRENCH']];
  const slots = P.dat.slots;
  P.tabs = { get cur() { return P.store.get('tab', 'all'); } };
  P.on('open-tab', id => setTab(id));

  function sel() { return P.store.get('tab', 'all'); }
  function setTab(tab) {
    if (!tabs.some(x => x[0] === tab)) tab = 'all';
    P.store.set('tab', tab);
    for (const b of t.children) {
      b.classList.toggle('sel', b.dataset.tab === tab);
      b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
    }
    const grid = P.$('#grid'), custom = P.$('#custom-tools');
    row.hidden = tab === 'custom';
    o.hidden = tab !== 'weather' && tab !== 'wrench';
    cat.hidden = tab === 'weather' || tab === 'wrench' ? false : false;
    grid.hidden = tab !== 'all';
    custom.hidden = tab !== 'custom';
    P.$('#q').disabled = tab !== 'all';
    P.emit('tab', tab);
  }

  for (const [id, name] of tabs) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.dataset.tab = id; b.textContent = name;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => setTab(id));
    t.append(b);
  }

  /* ---------- ALL: slot categories ---------- */
  function renderSlotCat() {
    const c = cat.value;
    cat.replaceChildren();
    for (const [key, label] of [['all', 'All categories'], ...Object.entries(slots)]) {
      const op = document.createElement('option');
      op.value = key; op.textContent = label;
      cat.append(op);
    }
    if ([...cat.options].some(x => x.value === c)) cat.value = c;
    if (P.inv) P.inv.setCategory(cat.value);
  }

  /* ---------- WEATHER ---------- */
  function buildWeather() {
    fetch('data/index.json').then(r => r.json()).then(list => {
      P.weatherCatalog = list;
      const seen = new Set();
      P.weatherGroups = [];
      for (const w of list) {
        const g = (w.name.split(/\s+/)[0] || 'Other');
        if (!seen.has(g)) { seen.add(g); P.weatherGroups.push(g); }
      }
      P.emit('weather-list');
    }).catch(() => P.toast('Weather list unavailable'));
  }

  function renderWeatherCat() {
    const c = cat.value || 'All';
    cat.replaceChildren();
    for (const label of ['All', ...(P.weatherGroups || [])]) {
      const op = document.createElement('option');
      op.value = label; op.textContent = label;
      cat.append(op);
    }
    if ([...cat.options].some(x => x.value === c)) cat.value = c;
    cat.hidden = !(P.weatherGroups || []).length;
    renderWeatherOpts();
  }

  function renderWeatherOpts() {
    if (!P.weatherCatalog) return;
    const c = cat.value;
    const list = P.weatherCatalog.filter(w => c === 'All' || (w.name.split(/\s+/)[0] || '') === c);
    o.replaceChildren();
    o.className = 'wopts';
    const cur = P.store.get('weather', 'none');
    for (const w of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wopt' + (cur === w.key ? ' on' : '');
      b.textContent = w.name; b.title = w.name;
      b.addEventListener('click', () => { P.weather.set(w.key); P.toast(w.name); renderWeatherOpts(); });
      o.append(b);
    }
    const none = document.createElement('button');
    none.type = 'button'; none.className = 'wopt' + (cur === 'none' ? ' on' : '');
    none.textContent = 'None'; none.title = 'No weather (default scene)';
    none.addEventListener('click', () => { P.weather.set('none'); renderWeatherOpts(); });
    o.prepend(none);
  }

  /* ---------- WRENCH ---------- */
  function renderWrenchCat() {
    cat.replaceChildren();
    cat.hidden = false;
    for (const label of ['Styles', 'Decorations']) {
      const op = document.createElement('option');
      op.value = label.toLowerCase(); op.textContent = label;
      cat.append(op);
    }
    P.emit('wrench-cat', cat.value);
  }

  cat.addEventListener('change', () => {
    const tab = sel();
    if (tab === 'weather') renderWeatherOpts();
    if (tab === 'wrench') P.emit('wrench-cat', cat.value);
    if (tab === 'all' && P.inv) P.inv.setCategory(cat.value);
  });

  P.on('weather-list', () => { if (sel() === 'weather') renderWeatherCat(); });

  P.on('tab', tab => {
    if (tab === 'weather') renderWeatherCat();
    if (tab === 'wrench') renderWrenchCat();
    if (tab === 'custom') P.emit('custom-open');
    if (tab === 'all') { renderSlotCat(); P.inv && P.inv.refresh(); }
  });

  buildWeather();
  setTab(sel());
})();
