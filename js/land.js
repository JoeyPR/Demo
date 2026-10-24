/* LAND: the LAND tab — a categorical selector for every foreground block in
   the land system (categories + one button per block). Selecting a block
   changes the land the player walks on; background blocks and block
   placement are intentionally not part of this planner. Selecting calls
   P.land.set(id); app.js renders the ground strip. */
(function(){
  const row = P.$('#optsrow'), cat = P.$('#category'), opts = P.$('#opts');
  let current = null;        /* selected block id (number) or 'none' */
  let blocks = null;        /* fg rows: [id,name,action,page,tx,ty,spread,collision,layer,flags?] */
  let shown = 0;             /* chunked rendering cursor */
  const CHUNK = 120;
  const CATS = [[14, 'Platforms'], [15, 'Bedrock'], [16, 'Lava'], [17, 'Foreground']];
  const pageImages = new Map(), pageLoads = new Map();

  P.land = {
    get key() { return current; },
    set(id) {
      current = id;
      P.store.set('land', id == null ? 'none' : String(id));
      P.emit('land', id);
    }
  };

  /* restore last selection (ground renders once app.js boots) */
  const saved = P.store.get('land', 'none');
  current = saved === 'none' ? 'none' : (Number.isFinite(+saved) ? +saved : 'none');

  /* ---------------- atlas page loading (thumbnails) ---------------- */
  function pageImage(name) {
    if (pageImages.has(name)) return Promise.resolve(pageImages.get(name));
    if (pageLoads.has(name)) return pageLoads.get(name);
    const load = new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { pageImages.set(name, img); res(img); };
      img.onerror = () => { pageImages.set(name, null); res(null); };
      img.src = 'sheets/tiles/' + name + '.png';
    });
    pageLoads.set(name, load);
    return load;
  }

  /* ---------------- category select + option buttons ---------------- */
  function sel() { return P.tabs.cur; }

  function buildLand() {
    /* show a loading state immediately if the tab is already open */
    if (sel() === 'land' && !blocks) {
      opts.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'empty';
      loading.textContent = 'Loading blocks…';
      opts.append(loading);
    }
    fetch('data/land-blocks.json?v=2').then(r => {
      if (!r.ok) throw Error(r.status);
      return r.json();
    }).then(list => {
      blocks = list;
      if (sel() === 'land') renderLandCat();
    }).catch(() => {
      blocks = null;
      if (sel() === 'land') {
        opts.replaceChildren();
        const err = document.createElement('div');
        err.className = 'empty';
        err.textContent = 'Blocks failed to load. ';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'wopt';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => { buildLand(); });
        err.append(retry);
        opts.append(err);
      }
      P.toast('Land list unavailable');
    });
  }

  function renderLandCat() {
    const c = cat.value || 'All';
    cat.replaceChildren();
    for (const label of ['All', ...CATS.map(x => x[1])]) {
      const op = document.createElement('option');
      op.value = label; op.textContent = label;
      cat.append(op);
    }
    if ([...cat.options].some(x => x.value === c)) cat.value = c;
    renderLandOpts();
  }

  function visibleBlocks() {
    if (!blocks) return [];
    const c = cat.value;
    if (c === 'All') return blocks;
    const action = (CATS.find(x => x[1] === c) || [])[0];
    return blocks.filter(b => b[2] === action);
  }

  function thumbEl(b) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    c.className = 'wprev';
    c.style.width = c.style.height = '40px';
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const draw = img => {
      if (!img) return;
      g.clearRect(0, 0, 32, 32);
      g.drawImage(img, b[4] * 32, b[5] * 32, 32, 32, 0, 0, 32, 32);
    };
    pageImage(b[3]).then(draw);
    return c;
  }

  function renderLandOpts() {
    if (!blocks) return;
    opts.replaceChildren();
    opts.className = 'wopts wopts-land';
    opts.hidden = false;
    shown = 0;
    const cur = current;
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'wopt' + (cur === 'none' ? ' on' : '');
    none.textContent = 'None';
    none.title = 'Default planner ground';
    none.addEventListener('click', () => { P.land.set('none'); renderLandOpts(); });
    opts.append(none);
    appendChunk(visibleBlocks());
  }

  function appendChunk(list) {
    const frag = document.createDocumentFragment();
    const end = Math.min(list.length, shown + CHUNK);
    for (; shown < end; shown++) {
      const b = list[shown];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wopt' + (current === b[0] ? ' on' : '');
      btn.title = b[1] + ' (#' + b[0] + ')';
      btn.dataset.id = b[0];
      btn.append(thumbEl(b));
      const n = document.createElement('span');
      n.textContent = b[1];
      btn.append(n);
      btn.addEventListener('click', () => { P.land.set(b[0]); P.toast(b[1]); renderLandOpts(); });
      frag.append(btn);
    }
    opts.append(frag);
    if (shown < list.length) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'wopt';
      more.textContent = '…';
      more.title = 'Show more blocks';
      more.addEventListener('click', () => { more.remove(); appendChunk(list); });
      opts.append(more);
    }
  }

  cat.addEventListener('change', () => {
    if (sel() === 'land') renderLandOpts();
  });

  P.on('tab', tab => {
    /* weather.js's handler runs first (it hides the row for any tab that is
       not weather/wrench); only land claims it back. */
    if (tab === 'land') { row.hidden = false; renderLandCat(); if (!blocks) buildLand(); }
  });

  /* saved tab already open on load (no 'tab' event fires after reload) */
  if (P.tabs.cur === 'land') { row.hidden = false; renderLandCat(); }

  buildLand();
})();
