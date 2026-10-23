/* WRENCH UI: the WRENCH tab — wrench styles and decorations menus with
   canvas previews, ported from the Website repo's wrench system. */
(function(){
  'use strict';
  const SHEETS = 'demo/assets/';
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
      if (isStyle && entry) { im = sheet(entry[2]); sx = entry[3] * 32; sy = entry[4] * 32; }
      else if (entry) { im = sheet(entry[2]); sx = entry[3] * 32; sy = entry[4] * 32; }
      else if (isStyle) {
        /* base wrench: green tint */
        im = document.createElement('canvas'); im.width = 32; im.height = 32;
        const g = im.getContext('2d');
        const src = new Image(); src.src = 'img/wrench.png';
        const paint = () => {
          g.drawImage(src, 0, 0);
          g.globalCompositeOperation = 'multiply';
          g.fillStyle = 'rgb(128,255,128)';
          g.fillRect(0, 0, 32, 32);
          g.globalCompositeOperation = 'destination-in';
          g.drawImage(src, 0, 0);
          x.drawImage(im, 0, 0, 32, 32, 8, 8, 48, 48);
        };
        if (src.complete) paint(); else src.onload = paint;
        return c;
      }
      if (im && ready(im)) x.drawImage(im, sx, sy, 32, 32, 8, 8, 48, 48);
    };
    const im = entry ? sheet(entry[2]) : null;
    if (im && !ready(im)) im.onload = draw;
    draw();
    return c;
  }

  function render(which) {
    const o = P.$('#opts');
    if (!data) return;
    const st = P.plateConfig.get();
    o.replaceChildren();
    o.className = 'wopts wopts-wrench';
    const mk = (id, label, entry, isStyle, isBase) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wopt wrench-opt' + (id === (isStyle ? st.wrenchStyle : st.wrenchDecoration) ? ' on' : '');
      b.title = label;
      if (isBase || !entry) b.append(document.createTextNode(isBase ? 'Wrench' : 'None'));
      else b.append(preview(entry, isStyle));
      b.addEventListener('click', () => {
        if (isStyle) P.plateConfig.setWrenchStyle(id);
        else P.plateConfig.setWrenchDecoration(id);
        render(which);
      });
      return b;
    };
    if (which === 'styles') {
      o.append(mk(0, 'No wrench icon', null, true, false));
      o.append(mk(32, 'Wrench', null, true, true));
      for (const s of data.styles) o.append(mk(s[0], s[1] + ' Wrench Style', s, true, false));
    } else {
      o.append(mk(0, 'No decoration', null, false, false));
      for (const d of data.decorations) o.append(mk(d[0], d[1] + ' Wrench Decoration', d, false, false));
    }
  }

  P.on('wrench-cat', which => render(which));
  P.on('wrench-data', () => { if (!P.$('#optsrow').hidden) render(P.store.get('wrenchCat', 'styles')); });

  fetch('data/wrench.json').then(r => r.json()).then(d => {
    data = d; P.wrenchData = d;
    P.emit('wrench-data');
  }).catch(() => P.toast('Wrench data unavailable'));
})();
