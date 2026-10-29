/* WRENCH UI: wrench styles and decorations with canvas previews, ported from
   the Website repo's wrench system. Rendered inside the Player Customization
   tab (P.wrenchUI.render(container)) — the old standalone tab is gone. */
(function(){
  'use strict';
  const SHEETS = 'demo/assets/';
  const SUPER_SUPPORTER_WRENCH = 'super-supporter';
  const quickWrenchImg = new Image(); quickWrenchImg.src = 'img/wrench-quick.png';
  const superWrenchImg = new Image(); superWrenchImg.src = 'img/wrench.png';
  let data = null;
  const imgCache = new Map();

  P.wrenchData = null;

  function sheet(name) {
    let im = imgCache.get(name);
    if (!im) {
      im = new Image();
      im.src = SHEETS + name;
      imgCache.set(name, im);
    }
    return im;
  }

  const ready = im => im.complete && im.naturalWidth > 0;

  /* 64x64 preview: draw the 32x32 cell trimmed and centered, like the site */
  function preview(entry, isStyle) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    c.className = 'wprev';
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const draw = () => {
      x.clearRect(0, 0, 64, 64);
      let sx = 0, sy = 0, im = null;
      if (isStyle && entry && entry[0] === SUPER_SUPPORTER_WRENCH) {
        const paint = () => {
          const tinted = document.createElement('canvas'); tinted.width = tinted.height = 32;
          const g = tinted.getContext('2d');
          g.drawImage(superWrenchImg, 0, 0, 32, 32);
          g.globalCompositeOperation = 'multiply';
          g.fillStyle = 'rgb(128,255,128)';
          g.fillRect(0, 0, 32, 32);
          g.globalCompositeOperation = 'destination-in';
          g.drawImage(superWrenchImg, 0, 0, 32, 32);
          x.drawImage(tinted, 0, 0, 32, 32, 8, 8, 48, 48);
        };
        if (ready(superWrenchImg)) paint(); else superWrenchImg.addEventListener('load', paint, { once: true });
        return c;
      } else if (isStyle && entry) {
        im = sheet(entry[2]); sx = entry[3] * 32; sy = entry[4] * 32;
      } else if (entry) {
        im = sheet(entry[2]); sx = entry[3] * 32; sy = entry[4] * 32;
      } else if (isStyle) {
        const paint = () => x.drawImage(quickWrenchImg, 0, 0, 32, 32, 8, 8, 48, 48);
        if (ready(quickWrenchImg)) paint(); else quickWrenchImg.addEventListener('load', paint, { once: true });
        return c;
      }
      if (im && ready(im)) x.drawImage(im, sx, sy, 32, 32, 8, 8, 48, 48);
    };
    const im = entry && entry[0] !== SUPER_SUPPORTER_WRENCH ? sheet(entry[2]) : null;
    /* addEventListener (not onload) so shared sheets never drop a callback */
    if (im && !ready(im)) im.addEventListener('load', draw, { once: true });
    draw();
    return c;
  }

  let which = 'styles';   /* 'styles' | 'decorations' — remembered per session */

  let lastContainer = null;

  function render(container) {
    lastContainer = container;
    const frag = document.createDocumentFragment();
    if (!data) {
      const loading = document.createElement('div');
      loading.className = 'empty wrench-ui-root';
      loading.textContent = 'Loading wrench options…';
      frag.append(loading);
      container.append(frag);
      return;
    }
    const st = P.plateConfig.get();

    /* Styles | Decorations toggle */
    const bar = document.createElement('div');
    bar.className = 'c-sections';
    for (const [key, label] of [['styles', 'Styles'], ['decorations', 'Decorations']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'c-section' + (which === key ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => { which = key; render(container); });
      bar.append(b);
    }
    frag.append(bar);

    const grid = document.createElement('div');
    grid.className = 'wrench-grid';
    const mk = (id, label, entry, isStyle) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wopt wrench-opt' + (id === (isStyle ? st.wrenchStyle : st.wrenchDecoration) ? ' on' : '');
      b.title = label;
      if (!entry && isStyle) b.append(preview(null, true));
      else if (!entry) b.append(document.createTextNode('None'));
      else b.append(preview(entry, isStyle));
      const name = document.createElement('span');
      name.className = 'wrench-opt-name';
      name.textContent = entry ? entry[1] : (isStyle ? 'Base' : 'None');
      b.append(name);
      b.addEventListener('click', () => {
        if (isStyle) P.plateConfig.setWrenchStyle(id);
        else P.plateConfig.setWrenchDecoration(id);
        render(container);
      });
      return b;
    };
    if (which === 'styles') {
      grid.append(mk(0, 'Wrench (base)', null, true));
      grid.append(mk(SUPER_SUPPORTER_WRENCH, 'Super Supporter Wrench',
        [SUPER_SUPPORTER_WRENCH, 'Super Supporter', 'img/wrench.png', 0, 0], true));
      for (const s of data.styles) grid.append(mk(s[0], s[1] + ' Wrench Style', s, true));
    } else {
      grid.append(mk(0, 'No decoration', null, false));
      for (const d of data.decorations) grid.append(mk(d[0], d[1] + ' Wrench Decoration', d, false));
    }
    frag.append(grid);
    /* replace only our own nodes, keeping the container's other children */
    for (const node of [...container.querySelectorAll('.wrench-ui-root')]) node.remove();
    const root = document.createElement('div');
    root.className = 'wrench-ui-root';
    root.append(frag);
    container.append(root);
  }

  P.wrenchUI = { render };

  fetch('data/wrench.json').then(r => r.json()).then(d => {
    data = d; P.wrenchData = d;
    P.emit('wrench-data');
    /* if the section is already open, swap the loading note for the options */
    if (lastContainer && lastContainer.isConnected) render(lastContainer);
  }).catch(() => P.toast('Wrench data unavailable'));
})();
