/* PLATE: the Website repo's player plate system — GrowID + titles + role icon +
   country flag + guild banner & role tag + wrench. Faithful port of the site's
   buildParts (R$) and draw (_0) with its data: 24 titles, conflict groups,
   name styles (legend / l125 / g4g / mentor / dr / party), guild roles and
   wrench styles/decorations. Drawn above the player every frame by app.js. */
(function () {
  'use strict';

  /* ---------------- data (ported from the Website repo) ---------------- */
  const GUILD_ROLES = {
    elder:  { text: '(GE)', colour: [255, 238, 125] },
    co:     { text: '(GC)', colour: [255, 202, 111] },
    leader: { text: '(GL)', colour: [25, 185, 255] }
  };
  /* name styles: shadow {at, rgba|code|same}, rgba fill, letters (party), swell */
  const STYLES = {
    legend: { shadow: { at: 2, code: true } },
    l125:   { rgba: [0, 255, 255, 150], shadow: { at: 2, rgba: [3, 98, 134, 150] }, swell: [1, 0.175] },
    mentor: { rgba: [247, 148, 30, 255], shadow: { at: 2, rgba: [249, 240, 111, 200] } },
    dr:     { rgba: [255, 0, 0, 255] },
    party:  { letters: [[255, 11, 223], [255, 217, 11], [133, 255, 169]], shadow: { at: 2, rgba: [0, 0, 0, 50] } },
    g4g:    { shadow: { at: 1.2, same: true }, swell: [0.9, 0.175] }
  };
  const CODE_COLORS = { 2: [73, 252, 0], 4: [255, 39, 29] };  /* legend shadow code */
  const TITLES = [
    { key: 'immortal', name: 'Immortal', after: 'immortal', legendary: true },
    { key: 'legend', name: 'Legendary', flag: 'legend', plateFlag: 'img/titles/legend.png', suffix: ' of Legend', size: 1.15, legendary: true },
    { key: 'dr', name: 'Dr.', prefix: 'Dr.' },
    { key: 'l125', name: 'Level 125' },
    { key: 'g4g', name: 'Grow4Good', flag: 'g4g' },
    { key: 'party', name: 'Party Animal' },
    { key: 'mentor', name: 'Mentor', flag: 'mentor', plateFlag: 'img/titles/mentor.png' },
    { key: 'cc', name: 'Content Creator', flag: 'ccBadge' },
    { key: 'tt', name: 'TikTok Creator', flag: 'ttBadge' },
    { key: 'thanks', name: 'Thanksgiving', both: 'feather' },
    { key: 'old', name: '10-Year', both: 'popper' },
    { key: 'gold', name: 'Gold Grow Royal', both: 'gold' },
    { key: 'silver', name: 'Silver Grow Royal', both: 'silver' },
    { key: 'bronze', name: 'Bronze Grow Royal', both: 'bronze' },
    { key: 'award', name: 'Award-Winning', both: 'award' },
    { key: 'winter', name: 'Royal Winter', both: 'winter' },
    { key: 'pblo', name: 'PBL Organizer', after: 'pblOrganizer' },
    { key: 'pblm', name: 'PBL Moderator', after: 'pblModerator' },
    { key: 'dgb', name: 'Dungeons Bronze', after: 'dungeonBronze' },
    { key: 'dgs', name: 'Dungeons Silver', after: 'dungeonSilver' },
    { key: 'dgg', name: 'Dungeons Gold', after: 'dungeonGold' },
    { key: 'dgr', name: 'Dungeons Ruby', after: 'dungeonRuby' },
    { key: 'dge', name: 'Dungeons Emerald', after: 'dungeonEmerald' },
    { key: 'dgsa', name: 'Dungeons Sapphire', after: 'dungeonSapphire' }
  ];
  const titleByKey = Object.fromEntries(TITLES.map(t => [t.key, t]));
  /* conflict groups: at most one title per group (K6 on the site) */
  const CONFLICTS = [
    ['l125', 'party'],
    ['g4g', 'party'],
    ['thanks', 'old', 'gold', 'silver', 'bronze', 'award', 'winter', 'immortal', 'dgb', 'dgs', 'dgg', 'dgr', 'dge', 'dgsa'],
    ['pblo', 'pblm'],
    ['legend', 'party']
  ];
  const inConflict = (a, b) => a !== b && CONFLICTS.some(g => g.includes(a) && g.includes(b));
  /* decorations that render centered on the wrench (a$ on the site) */
  const CENTERED_DECORATIONS = new Set([15542, 15688, 15940, 15988, 16056, 16156, 16222, 15554, 14890, 15772, 14574, 14590, 15134, 15420, 15012, 15510, 14712, 14822]);
  const BASE_WRENCH = 32;                    /* the plain green wrench (L0) */
  const TITLES_DIR = 'img/titles/', FLAGS_DIR = 'img/flags/', SHEETS_DIR = 'demo/assets/';

  /* ---------------- state ---------------- */
  const DEFAULTS = {
    growId: '', flag: 'us', role: '', titles: [],
    guildRole: '', guildFlag: 0, wrenchStyle: 0, wrenchDecoration: 0,
    wrenchOn: false          /* the Fist/Wrench quick box: wrench only shows with a GrowID */
  };
  let state = Object.assign({}, DEFAULTS, P.store.get('plate', {}));
  if (!Array.isArray(state.titles)) state.titles = [];
  if (typeof state.wrenchOn !== 'boolean') state.wrenchOn = !!(state.wrenchStyle || state.wrenchDecoration);
  const save = () => { P.store.set('plate', state); P.emit('plate-update'); };

  /* ---------------- wrench data + sheets ---------------- */
  let wrenchData = null;                     /* data/wrench.json */
  fetch('data/wrench.json').then(r => r.json()).then(d => { wrenchData = d; P.emit('plate-update'); }).catch(() => {});
  const sheetCache = new Map();
  function sheet(name) {
    let im = sheetCache.get(name);
    if (!im) {
      im = new Image();
      im.src = SHEETS_DIR + name;
      sheetCache.set(name, im);
    }
    return im;
  }
  const wrenchEntry = (kind, id) => wrenchData?.[kind]?.find(e => e[0] === id);
  const ready = im => im && (im.complete && im.naturalWidth > 0);

  /* green base wrench canvas (z6 on the site) */
  const baseWrenchImg = new Image(); baseWrenchImg.src = 'img/wrench.png';
  let baseWrenchCanvas = null;
  function baseWrench() {
    if (baseWrenchCanvas || !ready(baseWrenchImg)) return baseWrenchCanvas;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    g.drawImage(baseWrenchImg, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgb(128,255,128)';
    g.fillRect(0, 0, 32, 32);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(baseWrenchImg, 0, 0);
    baseWrenchCanvas = c;
    return c;
  }

  /* ---------------- image cache (t$ on the site) ---------------- */
  const imageCache = new Map();
  function img(src) {
    let im = imageCache.get(src);
    if (!im) {
      im = new Image();
      im.src = src;
      im.onload = () => P.emit('plate-update');
      imageCache.set(src, im);
    }
    return ready(im) ? im : null;
  }

  /* multiply tint of a whole image (V6 on the site) */
  const tintCache = new Map();
  function tintImage(im, rgb) {
    const key = im.src + rgb.join(',');
    let c = tintCache.get(key);
    if (!c) {
      if (tintCache.size > 200) tintCache.clear();
      c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = 'rgb(' + rgb + ')';
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(im, 0, 0);
      tintCache.set(key, c);
    }
    return c;
  }

  /* guild flag: any item's picture (H0 on the site) — drawn from the Demo atlases */
  const guildFlagCache = new Map();
  function guildFlag(itemId) {
    if (!itemId) return null;
    if (guildFlagCache.has(itemId)) return guildFlagCache.get(itemId);
    let canvas = null;
    const item = P.catalog && P.catalog.items.find(i => i.id === itemId);
    if (item && P.thumb) {
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const g = canvas.getContext('2d');
      const src = P.thumb(item, 64);
      if (src) g.drawImage(src, 0, 0, 64, 64, 0, 0, 32, 32);
    }
    guildFlagCache.set(itemId, canvas);
    return canvas;
  }

  /* ---------------- color cyclers (s$ / f0 on the site) ---------------- */
  const osc = (period, t) => Math.abs(Math.sin(2 * Math.PI * (t % period) / period));
  const rainbow = (t, seed = 0) => [16000, 12000, 20000].map(w => Math.trunc(128 + 127 * osc(w + seed, t)));
  const descenderPenalty = s => /[()[\]{}|gjpqy]/.test(s) ? 25 : /[$_]/.test(s) ? 24 : /[,/;\\]/.test(s) ? 23 : /[%Q]/.test(s) ? 22 : 21;

  /* guild tag width with small-caps scaling ($6 / X7 on the site) */
  const CAPS = 0.88;
  const withCaps = s => [...s].map(ch => [ch, /[A-Z]/.test(ch)]);
  function tagWidth(ctx, text, size) {
    let w = 0;
    for (const [ch, cap] of withCaps(text)) {
      ctx.font = '700 ' + (cap ? size * CAPS : size) + "px 'Century Gothic GT', 'Century Gothic', sans-serif";
      w += ctx.measureText(ch).width;
    }
    ctx.font = '700 ' + size + "px 'Century Gothic GT', 'Century Gothic', sans-serif";
    return w;
  }

  /* ---------------- buildParts (R$ on the site) ---------------- */
  function buildParts() {
    if (!state.growId.trim()) return null;
    const sel = state.titles.map(k => titleByKey[k]).filter(Boolean);
    const parts = [];
    if (state.role) parts.push({ img: FLAGS_DIR + 'role-' + state.role + '.png', role: true });
    for (const t of sel) if (t.left) parts.push({ img: TITLES_DIR + t.left + '.png' });
    const both = sel.filter(t => t.both);
    const badgeTitle = ['g4g', 'mentor', 'legend', 'tt', 'cc'].map(k => sel.find(t => t.key === k && t.flag)).find(Boolean);
    const badgeImg = badgeTitle && (badgeTitle.plateFlag ?? TITLES_DIR + badgeTitle.flag + '.png');
    const guildImg = state.guildFlag && !sel.some(t => t.key === 'tt' || t.key === 'cc') ? guildFlag(state.guildFlag) : null;
    if (guildImg) parts.push({ img: guildImg, guild: true });
    else if (badgeImg) parts.push({ img: badgeImg, badge: badgeTitle.key });
    else if (state.flag) parts.push({ img: FLAGS_DIR + state.flag + '.png', flag: true });
    for (const t of sel) if (t.after) parts.push({ img: TITLES_DIR + t.after + '.png', after: true });
    for (const t of both) parts.push({ img: TITLES_DIR + t.both + '.png' });
    const prefix = sel.find(t => t.prefix)?.prefix ?? '';
    const suffix = sel.find(t => t.suffix)?.suffix ?? '';
    const has = k => state.titles.includes(k);
    const legendary = sel.some(t => t.legendary);
    const styleKey = has('g4g') ? 'g4g' : legendary ? 'legend' : has('l125') ? 'l125' : has('mentor') ? 'mentor' : has('dr') ? 'dr' : has('party') ? 'party' : null;
    const style = styleKey ? STYLES[styleKey] : null;
    const swell = styleKey === 'g4g' && legendary ? null : style?.swell ?? null;
    const code = CODE_COLORS[has('dr') && has('legend') ? 4 : 2];
    const hasTextOrStyle = !!styleKey || sel.some(t => t.prefix || t.suffix);
    const guildRole = GUILD_ROLES[state.guildRole];
    const tagSeparate = guildRole && !hasTextOrStyle;
    parts.push({
      text: prefix + state.growId.trim() + suffix + (guildRole && !tagSeparate ? ' ' + guildRole.text : ''),
      style: styleKey, colour: [255, 255, 255], alpha: 1,
      scale: swell ? swell[0] + swell[1] * osc(8000, EPOCH + clock) : 1,
      grow: swell ? swell[0] + swell[1] - 1 : 0,
      code, ms: EPOCH + clock
    });
    if (tagSeparate) parts.push({ text: guildRole.text, colour: guildRole.colour, alpha: 1, tag: true });
    for (const t of both) parts.push({ img: TITLES_DIR + t.both + '.png', mirror: true });
    if (state.wrenchOn && state.growId.trim()) parts.push({ wrench: true });
    return { parts, size: 7.5 * Math.max(1, ...sel.map(t => t.size ?? 1)) };
  }

  /* ---------------- draw (_0 on the site) ---------------- */
  let clock = 0;                               /* ms, set each frame via draw() */
  const EPOCH = 10000000;

  /* draw(ctx, cx, baselineY, scale, t): cx = character center x on canvas,
     baselineY = the plate's text baseline. Returns the measured width. */
  function draw(k, p, cx, baselineY, measureOnly) {
    const built = buildParts();
    if (!built) return 0;
    const parts = built.parts;
    const PR = built.size * p;                 /* text font size */
    const Pq = 1.6 * p;                       /* icon line gap */
    k.save();
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.font = "700 " + PR + "px 'Century Gothic GT', 'Century Gothic', sans-serif";
    k.textBaseline = 'alphabetic';
    const joined = parts.filter(x => x.text !== undefined).map(x => x.text).join(' ');
    const PN = descenderPenalty(joined) / 21;
    const PG = PR * 1.25 * PN;                /* title icon height */
    const Pt = k.measureText(joined);
    const PA = Pt.actualBoundingBoxAscent + Pt.actualBoundingBoxDescent;
    const PI = k.measureText('A').actualBoundingBoxAscent / 14;  /* pixel unit */
    const PB = descenderPenalty(joined) * PI; /* icon size unit */
    const L1 = 13.125 * PI;
    const iconCenterY = () => baselineY - 19 * PI + PB / 2;
    const pow2 = im => 2 ** Math.ceil(Math.log2(Math.max(im.naturalWidth ?? im.width, im.naturalHeight ?? im.height, 1)));
    const sizeOf = part => {
      const im = resolveImg(part);
      if (part.guild) return [1.5 * PB * (im ? (im.naturalWidth ?? im.width) / (im.naturalHeight ?? im.height) : 1), 1.5 * PB];
      if (part.role || part.flag || part.badge) return im ? [PB * (im.naturalWidth ?? im.width) / pow2(im), PB * (im.naturalHeight ?? im.height) / pow2(im)] : [PB, PB];
      return [im ? (im.naturalWidth ?? im.width) / (im.naturalHeight ?? im.height) * PG : PG, PG];
    };
    function resolveImg(part) {
      if (part.img instanceof HTMLCanvasElement) return part.img;
      return img(part.img);
    }
    const LE = parts.findIndex(x => x.flag || x.badge || x.guild);
    const LP = parts[LE];
    const LL = !!LP?.guild;                    /* has guild banner */
    const LC = PR * 1.226 * 1.2;              /* wrench size */
    const widths = parts.map(part => {
      if (part.wrench) return LC;
      if (part.tag) return tagWidth(k, part.text, PR);
      if (part.text !== undefined) return k.measureText(part.text).width * (1 + (part.grow ?? 0));
      return sizeOf(part)[0];
    });
    const gaps = parts.map((part, i) => {
      if (part.flag || part.badge || part.guild) return L1;
      if (part.role) return !LP ? L1 : LL ? 0.15 * PB + L1 : L1 + widths[i] / 2 - widths[LE] / 2;
      return Pq;
    });
    const yOf = (part, h) => {
      if (part.guild) return iconCenterY() - 0.875 * PB;
      if (part.role) return (LL ? iconCenterY() - 1.025 * PB : iconCenterY()) - h / 2;
      if (part.flag || part.badge) return iconCenterY() - h / 2;
      return baselineY - PR * 0.8 - (h - PR * 0.8) / 2;
    };
    const firstText = parts.findIndex(x => x.text !== undefined);
    const lastText = parts.findLastIndex(x => x.text !== undefined);
    const span = (a, b) => { let w = 0; for (let i = a; i < b; i++) w += widths[i] + gaps[i]; return w; };
    const leftBlock = firstText > 0 ? span(0, firstText) : 0;
    const textBlock = span(firstText, lastText) + widths[lastText];
    const LK = parts.some(x => x.flag || x.badge || x.guild) ? PB / 2 : 0;
    const rightBlock = lastText < parts.length - 1 ? gaps[lastText] + span(lastText + 1, parts.length - 1) + widths[parts.length - 1] : 0;
    const total = 2 * Math.max(textBlock / 2 - LK + leftBlock, textBlock / 2 + LK + rightBlock);
    if (measureOnly) { k.restore(); return total; }
    let LO = cx - textBlock / 2 + LK - leftBlock;   /* x cursor */
    const Le = clock / 1000;
    k.imageSmoothingEnabled = false;
    parts.forEach((part, i) => {
      const Ld = widths[i];
      if (part.wrench) {
        const LD = Ld, Lu = LO + LD / 2, Ln = baselineY - PR * 0.393 - Ld / 2 + LD / 2;
        const entry = state.wrenchStyle !== BASE_WRENCH ? wrenchEntry('styles', state.wrenchStyle) : null;
        const wim = entry ? sheet(entry[2]) : baseWrench();
        const sx = entry ? entry[3] * 32 : 0, sy = entry ? entry[4] * 32 : 0;
        k.save();
        k.translate(Lu, Ln);
        k.rotate(20 * Math.sin(2 * Math.PI * Le / 3) * Math.PI / 180);
        if (wim && (wim instanceof HTMLCanvasElement || ready(wim)))
          k.drawImage(wim, sx, sy, 32, 32, -LD / 2, -LD / 2, LD, LD);
        const deco = wrenchEntry('decorations', state.wrenchDecoration);
        const dim = deco && sheet(deco[2]);
        if (dim && ready(dim)) {
          if (!CENTERED_DECORATIONS.has(deco[0])) { k.restore(); k.save(); }
          k.drawImage(dim, deco[3] * 32, deco[4] * 32, 32, 32,
            CENTERED_DECORATIONS.has(deco[0]) ? -LD / 2 : Lu - LD / 2,
            CENTERED_DECORATIONS.has(deco[0]) ? -LD / 2 : Ln - LD / 2, LD, LD);
        }
        k.restore();
      } else if (part.text !== undefined) {
        const outline = Math.max(1, p * 0.5);
        const paint = (text, x, color) => {
          k.fillStyle = 'rgba(0,0,0,.5)';
          k.fillText(text, x + outline, baselineY + outline);
          k.fillStyle = 'rgba(' + color.join(',') + ',' + part.alpha + ')';
          k.fillText(text, x, baselineY);
        };
        if (part.style) {
          const st = STYLES[part.style];
          const chars = [...part.text];
          const group = Math.max(1, Math.floor((chars.length + 4) / 6));
          const colorAt = (ci, seen) => part.style === 'party' ? [...st.letters[Math.floor(seen / group) % 3], 255]
            : part.style === 'g4g' ? [...rainbow(part.ms, 1000 * (2 + ci)), 255]
            : part.style === 'legend' ? [...rainbow(part.ms), 255]
            : st.rgba;
          const perLetter = part.style === 'party' || part.style === 'g4g';
          const rgba = c => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3] / 255 + ')';
          /* shadow pass at offset (at·PI, at·PI), then the fill pass at 0 —
             exactly the site's LN(yOffset, colorFn) */
          const renderText = (offset, colorFn) => {
            const ax = LO + offset * PI, ay = baselineY - 19 * PI + offset * PI;
            k.save();
            if (part.scale !== 1) { k.translate(ax, ay); k.scale(part.scale, part.scale); k.translate(-ax, -ay); }
            k.fillStyle = rgba(colorFn(0, 0));
            if (!perLetter) {
              k.fillText(part.text, ax, ay + 19 * PI);
            } else {
              let x = ax, seen = 0;
              chars.forEach((ch, ci) => {
                if (ch !== ' ') {
                  k.fillStyle = rgba(colorFn(ci, seen));
                  k.fillText(ch, x, ay + 19 * PI);
                  seen++;
                }
                x += k.measureText(ch).width;
              });
            }
            k.restore();
          };
          const shadow = st.shadow;
          if (shadow) renderText(shadow.at, shadow.same ? colorAt : shadow.code ? () => [...part.code, 255] : () => shadow.rgba);
          renderText(0, colorAt);
        } else if (part.tag) {
          let x = LO;
          for (const [ch, cap] of withCaps(part.text)) {
            k.font = '700 ' + (cap ? PR * CAPS : PR) + "px 'Century Gothic GT', 'Century Gothic', sans-serif";
            paint(ch, x, part.colour);
            x += k.measureText(ch).width;
          }
          k.font = '700 ' + PR + "px 'Century Gothic GT', 'Century Gothic', sans-serif";
        } else {
          paint(part.text, LO, part.colour);
        }
      } else {
        const im = resolveImg(part);
        const h = sizeOf(part)[1], y = yOf(part, h);
        if (im) {
          const x = part.badge === 'g4g' || part.role && LP?.badge === 'g4g' ? LO - 4 * PI : LO;
          const now = EPOCH + clock;
          const isPow = q => descenderPenalty(joined) / 2 ** Math.ceil(Math.log2(Math.max(q.naturalWidth ?? q.width, q.naturalHeight ?? q.height, 1)));
          const pulseTitle = part.role && (state.titles.includes('l125') || state.titles.includes('mentor'));
          const g4gRole = part.role && !pulseTitle && state.titles.includes('g4g') ? img(TITLES_DIR + 'g4g.png') : null;
          if (part.badge === 'g4g' || g4gRole) {
            const source = g4gRole ?? im;
            const sc = (g4gRole ? 1 : 0.9) * (1 + 0.25 * osc(8000, now) / isPow(g4gRole ? im : source));
            const cy = y + h / 2;
            k.save();
            k.globalCompositeOperation = 'lighter';
            k.drawImage(tintImage(source, rainbow(now).map(c => Math.min(255, Math.round(c / 4) * 4))), x + Ld / 2 - Ld * sc / 2, cy - h * sc / 2, Ld * sc, h * sc);
            k.restore();
          } else if (pulseTitle || state.titles.includes('l125') && (part.flag || part.badge) || part.badge === 'mentor') {
            const sc = 1 + 0.3 * osc(8000, now) / isPow(im);
            const cy = y + h / 2;
            k.save();
            k.globalCompositeOperation = 'lighter';
            k.drawImage(im, x + Ld / 2 - Ld * sc / 2, cy - h * sc / 2, Ld * sc, h * sc);
            k.restore();
          }
          if (part.badge === 'mentor') {
            const sc = 2 + 0.25 * osc(4000, now) / isPow(im);
            const cy = y + h / 2;
            k.drawImage(im, x + Ld / 2 - Ld * sc / 2, cy - h * sc / 2, Ld * sc, h * sc);
          } else if (part.mirror) {
            k.save();
            k.translate(x + Ld, y);
            k.scale(-1, 1);
            k.drawImage(im, 0, 0, Ld, h);
            k.restore();
          } else {
            k.drawImage(im, x, y, Ld, h);
          }
        }
      }
      LO += Ld + gaps[i];
    });
    k.restore();
    return total;
  }

  /* ---------------- public API ---------------- */
  P.plate = {
    draw(ctx, cx, baselineY, scale, t) {
      clock = t ?? clock;
      return draw(ctx, scale, cx, baselineY, false);
    },
    measure(ctx, cx, baselineY, scale) { return draw(ctx, scale, cx, baselineY, true); },
    titles: TITLES, conflicts: CONFLICTS, guildRoles: GUILD_ROLES, baseWrenchId: BASE_WRENCH,
    get wrenchData() { return wrenchData; }
  };
  P.plateConfig = {
    get: () => state,
    set(patch) { state = Object.assign({}, DEFAULTS, state, patch); save(); },
    setGrowId(v) { state.growId = String(v ?? '').slice(0, 18); P.store.set('plate', state); },  /* silent: no UI rebuild while typing */
    setRole(v) { state.role = v; save(); },
    setFlag(v) { state.flag = v; save(); },
    setGuildRole(v) { state.guildRole = v; save(); },
    setGuildFlag(id) { state.guildFlag = +id || 0; save(); },
    setWrenchStyle(id) { state.wrenchStyle = +id || 0; save(); },
    setWrenchDecoration(id) { state.wrenchDecoration = +id || 0; save(); },
    setWrenchOn(on) { state.wrenchOn = !!on; save(); },
    toggleTitle(key) {
      const i = state.titles.indexOf(key);
      if (i >= 0) state.titles.splice(i, 1);
      else {
        for (const other of [...state.titles]) if (inConflict(key, other))
          state.titles.splice(state.titles.indexOf(other), 1);
        state.titles.push(key);
      }
      save();
    },
    reset() { state = Object.assign({}, DEFAULTS); save(); }
  };
})();
