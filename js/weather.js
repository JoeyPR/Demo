/* WEATHER: the WEATHER tab — a categorical selector for every weather in the
   growtopia-weather package (categories + one button per weather). Selecting a
   weather calls P.weather.set(key); the animated renderer is driven by
   app.js every frame. */
(function(){
  const el = P.$('#weather');
  const row = P.$('#optsrow'), cat = P.$('#category'), opts = P.$('#opts');
  let current = null;

  P.weather = {
    get key() { return current; },
    set(name) {
      current = name;
      el.dataset.w = name;
      P.store.set('weather', name);
      P.emit('weather', name);
    }
  };

  /* restore last selection (do not auto-download heavy configs yet) */
  const saved = P.store.get('weather', 'none');
  el.dataset.w = saved;
  current = saved;

  /* ---------------- category select + option buttons ---------------- */
  function sel() { return P.tabs.cur; }

  function buildWeather() {
    fetch('data/index.json').then(r => r.json()).then(list => {
      P.weatherCatalog = list;
      const seen = new Set();
      P.weatherGroups = [];
      for (const w of list) {
        const g = (w.name.split(/\s+/)[0] || 'Other');
        if (!seen.has(g)) { seen.add(g); P.weatherGroups.push(g); }
      }
      if (sel() === 'weather') renderWeatherCat();
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
    renderWeatherOpts();
  }

  function renderWeatherOpts() {
    if (!P.weatherCatalog) return;
    const c = cat.value;
    const list = P.weatherCatalog.filter(w => c === 'All' || (w.name.split(/\s+/)[0] || '') === c);
    opts.replaceChildren();
    opts.className = 'wopts';
    opts.hidden = false;
    const cur = P.store.get('weather', 'none');
    for (const w of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wopt' + (cur === w.key ? ' on' : '');
      b.textContent = w.name; b.title = w.name;
      b.addEventListener('click', () => { P.weather.set(w.key); P.toast(w.name); renderWeatherOpts(); });
      opts.append(b);
    }
    const none = document.createElement('button');
    none.type = 'button'; none.className = 'wopt' + (cur === 'none' ? ' on' : '');
    none.textContent = 'None'; none.title = 'No weather (default scene)';
    none.addEventListener('click', () => { P.weather.set('none'); renderWeatherOpts(); });
    opts.prepend(none);
  }

  cat.addEventListener('change', () => {
    if (sel() === 'weather') renderWeatherOpts();
  });

  P.on('tab', tab => {
    row.hidden = tab !== 'weather' && tab !== 'wrench';
    if (tab === 'weather') { renderWeatherCat(); if (!P.weatherCatalog) buildWeather(); }
  });

  buildWeather();
})();
