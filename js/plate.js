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
    dr:     { rgba: [255, 39, 29, 255] },
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
    { key: 'dgsa', name: 'Dungeons Sapphire', after: 'dungeonSapphire' },
    { key: 'weather', name: 'Weather Master', after: 'weatherMachine' },
    { key: 'master', name: 'Master', after: 'master_icon' }
  ];
  const titleByKey = Object.fromEntries(TITLES.map(t => [t.key, t]));
  /* conflict groups: at most one title per group (K6 on the site) */
  const CONFLICTS = [
    ['l125', 'party'],
    ['g4g', 'party'],
    ['thanks', 'old', 'gold', 'silver', 'bronze', 'award', 'winter', 'immortal', 'dgb', 'dgs', 'dgg', 'dgr', 'dge', 'dgsa', 'weather', 'master'],
    ['pblo', 'pblm'],
    ['legend', 'party']
  ];
  const inConflict = (a, b) => a !== b && CONFLICTS.some(g => g.includes(a) && g.includes(b));
  function normalizeTitles(keys) {
    const selected=[];
    for(const value of Array.isArray(keys)?keys:[]) {
      const key=String(value??'').toLowerCase();
      if(!titleByKey[key])continue;
      for(let i=selected.length-1;i>=0;i--)if(selected[i]===key||inConflict(key,selected[i]))selected.splice(i,1);
      selected.push(key);
    }
    return selected;
  }
  /* decorations that render centered on the wrench (a$ on the site) */
  const CENTERED_DECORATIONS = new Set([15542, 15688, 15940, 15988, 16056, 16156, 16222, 15554, 14890, 15772, 14574, 14590, 15134, 15420, 15012, 15510, 14712, 14822]);
  const BASE_WRENCH = 32;                    /* the plain green wrench (L0) */
  const SUPER_SUPPORTER_WRENCH = 'super-supporter';
  const WRENCH_STATUS_SCALE = Object.freeze({ default: 0.48, supporter: 0.56, 'super-supporter': 0.64 });
  const COUNTRY_FLAGS_DIR = 'img/flags/';
  const TITLES_DIR = 'img/titles/', FLAGS_DIR = 'img/flags/', SHEETS_DIR = 'demo/assets/';

  /* ---------------- state ---------------- */
  const DEFAULTS = {
    growId: '', flag: 'unitedstates', role: '', titles: [],
    guildRole: '', guildFlag: 0, wrenchStatus: 'default', wrenchStyle: 0, wrenchDecoration: 0,
    wrenchOn: false          /* the Fist/Wrench quick box: wrench only shows with a GrowID */
  };
  const safeFile=value=>typeof value==='string'&&/^[a-z0-9_-]{1,32}$/i.test(value)?value:'';
  function normalizeState(value) {
    const next=Object.assign({},DEFAULTS,value&&typeof value==='object'?value:{});
    next.growId=P.rtfont.sanitizeGrowId(String(next.growId??''),19);
    next.titles=normalizeTitles(next.titles);
    next.flag=safeFile(next.flag);
    next.role=['farmer','builder','surgeon','fisher','chef','startopian'].includes(next.role)?next.role:'';
    next.guildRole=Object.hasOwn(GUILD_ROLES,next.guildRole)?next.guildRole:'';
    next.guildFlag=Number.isSafeInteger(Number(next.guildFlag))&&Number(next.guildFlag)>0?Number(next.guildFlag):0;
    next.wrenchStatus=Object.hasOwn(WRENCH_STATUS_SCALE,next.wrenchStatus)?next.wrenchStatus:'default';
    for(const key of ['wrenchStyle','wrenchDecoration']) {
      if(key==='wrenchStyle'&&next[key]===SUPER_SUPPORTER_WRENCH&&next.wrenchStatus==='super-supporter')continue;
      next[key]=Number.isSafeInteger(Number(next[key]))&&Number(next[key])>0?Number(next[key]):0;
    }
    next.wrenchOn=!!next.wrenchOn;
    return next;
  }
  const savedState=P.store.get('plate',{});
  let state = normalizeState(savedState);
  // Older saved previews used ISO-style aliases that aren't filenames in the original flag catalog.
  if (state.flag === 'us') state.flag = 'unitedstates';
  if (state.flag === 'pr') state.flag = 'puertorico';
  if (!Object.hasOwn(WRENCH_STATUS_SCALE, state.wrenchStatus)) state.wrenchStatus = 'default';
  if (state.wrenchStatus !== 'super-supporter' && state.wrenchStyle === SUPER_SUPPORTER_WRENCH) state.wrenchStyle = 0;
  if (typeof savedState?.wrenchOn !== 'boolean') state.wrenchOn = !!(state.wrenchStyle || state.wrenchDecoration);
  const save = () => { state=normalizeState(state);P.store.set('plate', state); P.emit('plate-update'); };

  /* ---------------- wrench data + sheets ---------------- */
  let wrenchData = null;                     /* data/wrench.json */
  fetch('data/wrench.json').then(r => {if(!r.ok)throw Error('Wrench catalog unavailable');return r.json();}).then(d => {
    const valid=row=>Array.isArray(row)&&Number.isInteger(row[0])&&typeof row[1]==='string'&&
      typeof row[2]==='string'&&/^[a-z0-9_-]+\.png$/i.test(row[2])&&row.slice(3,5).every(Number.isInteger);
    wrenchData={styles:(d.styles??[]).filter(valid),decorations:(d.decorations??[]).filter(valid)};
    P.emit('plate-update');
  }).catch(() => {});
  let frames={};
  fetch('data/title-frames.json').then(r=>{if(!r.ok)throw Error('Title frames unavailable');return r.json();})
    .then(data=>{frames=Object.fromEntries(Object.entries(data).filter(([key,rect])=>
      /^(titles|flags)\/[a-z0-9_-]+$/i.test(key)&&Array.isArray(rect)&&rect.length===4&&
      rect.every(Number.isFinite)&&rect[0]>0&&rect[1]>0));P.emit('plate-update');}).catch(()=>{});
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
  const baseWrenchImg = new Image(); baseWrenchImg.src = 'img/wrench-quick.png';
  const superWrenchImg = new Image(); superWrenchImg.src = 'img/wrench.png';
  let baseWrenchCanvas = null, superWrenchCanvas = null;
  function baseWrench() {
    if (baseWrenchCanvas || !ready(baseWrenchImg)) return baseWrenchCanvas;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    c.getContext('2d').drawImage(baseWrenchImg, 0, 0, 32, 32);
    baseWrenchCanvas = c;
    return c;
  }
  function superSupporterWrench() {
    if (superWrenchCanvas || !ready(superWrenchImg)) return superWrenchCanvas;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    g.drawImage(superWrenchImg, 0, 0, 32, 32);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgb(128,255,128)';
    g.fillRect(0, 0, 32, 32);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(superWrenchImg, 0, 0, 32, 32);
    superWrenchCanvas = c;
    return c;
  }

  /* ---------------- image cache (t$ on the site) ---------------- */
  const imageCache = new Map();
  function img(src) {
    let im = imageCache.get(src);
    if (!im) {
      im = new Image();
      // Country flags are local Demo assets. If hosted under a nested route,
      // retry the same local file at this site's root; never use another site.
      im.onload = () => P.emit('plate-update');
      im.onerror = () => {
        if (src.startsWith(COUNTRY_FLAGS_DIR) && !im.dataset.demoFlagRootRetry) {
          im.dataset.demoFlagRootRetry = '1';
          const localPath = src.split('/').filter(Boolean).join('/');
          const rootSrc = new URL('/' + localPath, window.location.origin).href;
          if (rootSrc !== im.src) { im.src = rootSrc; return; }
        }
        P.emit('plate-update');
      };
      im.src = src;
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
    // A missing catalog/thumb can become available after boot; don't cache null.
    if(canvas)guildFlagCache.set(itemId, canvas);
    return canvas;
  }

  /* ---------------- color cyclers (s$ / f0 on the site) ---------------- */
  const osc = (period, t) => Math.abs(Math.sin(2 * Math.PI * (t % period) / period));
  const rainbow = (t, seed = 0) => [16000, 12000, 20000].map(w => Math.trunc(128 + 127 * osc(w + seed, t)));
  const descenderPenalty = s => /[()[\]{}|gjpqy]/.test(s) ? 25 : /[$_]/.test(s) ? 24 : /[,/;\\]/.test(s) ? 23 : /[%Q]/.test(s) ? 22 : 21;

  /* guild tag width with small-caps scaling ($6 / X7 on the site) */
  const CAPS = 0.88;
  const withCaps = s => [...s].map(ch => [ch, /[A-Z]/.test(ch)]);
  function tagWidth(ctx, text, size, restoreSize = size) {
    let w = 0;
    for (const [ch, cap] of withCaps(text)) {
      ctx.font = '700 ' + (cap ? size * CAPS : size) + "px 'Nameplate CG', sans-serif";
      w += ctx.measureText(ch).width;
    }
    ctx.font = '700 ' + restoreSize + "px 'Nameplate CG', sans-serif";
    return w;
  }

  /* ---------------- buildParts (R$ on the site) ---------------- */
  function buildParts() {
    if (!P.rtfont.hasVisibleName(state.growId)) return null;
    const titleKeys = state.titles.map(k => String(k ?? '').toLowerCase());
    const sel = titleKeys.map(k => titleByKey[k]).filter(Boolean);
    const parts = [];
    if (state.role) parts.push({ img: FLAGS_DIR + 'role-' + state.role + '.png', role: true });
    for (const t of sel) if (t.left) parts.push({ img: TITLES_DIR + t.left + '.png' });
    const both = sel.filter(t => t.both);
    const badgeTitle = ['g4g', 'mentor', 'legend', 'tt', 'cc'].map(k => sel.find(t => t.key === k && t.flag)).find(Boolean);
    const badgeImg = badgeTitle && (badgeTitle.plateFlag ?? TITLES_DIR + badgeTitle.flag + '.png');
    const guildImg = state.guildFlag && !sel.some(t => t.key === 'tt' || t.key === 'cc') ? guildFlag(state.guildFlag) : null;
    if (guildImg) parts.push({ img: guildImg, guild: true });
    else if (badgeImg) parts.push({ img: badgeImg, badge: badgeTitle.key });
    else if (state.flag) parts.push({ img: COUNTRY_FLAGS_DIR + state.flag + '.png', flag: true });
    for (const t of sel) if (t.after) parts.push({ img: TITLES_DIR + t.after + '.png', after: true });
    for (const t of both) parts.push({ img: TITLES_DIR + t.both + '.png' });
    const prefix = sel.find(t => t.prefix)?.prefix ?? '';
    const suffix = sel.find(t => t.suffix)?.suffix ?? '';
    const has = k => titleKeys.includes(String(k).toLowerCase());
    const legendary = sel.some(t => t.legendary);
    const styleKey = has('g4g') ? 'g4g' : legendary ? 'legend' : has('l125') ? 'l125' : has('mentor') ? 'mentor' : has('dr') ? 'dr' : has('party') ? 'party' : null;
    const style = styleKey ? STYLES[styleKey] : null;
    const swell = styleKey === 'g4g' && legendary ? null : style?.swell ?? null;
    const code = CODE_COLORS[has('dr') && has('legend') ? 4 : 2];
    const guildRole = GUILD_ROLES[state.guildRole];
    // Match SetPlannerGT: plain names get a separate guild tag, while active
    // title styling/prefix/suffix keeps the role in the styled name string.
    const hasTextOrStyle = !!styleKey || sel.some(t => t.prefix || t.suffix);
    const tagSeparate = guildRole && !hasTextOrStyle;
    const rawGrowId = P.rtfont.sanitizeGrowId(state.growId.trim(), 19);
    const roleSuffix = guildRole && !tagSeparate ? ' ' + guildRole.text : '';
    const rawNameBase = prefix + rawGrowId + suffix;
    const rawName = rawNameBase + roleSuffix;
    const guildRoleStartIndex = roleSuffix
      ? [...P.rtfont.strip(rawNameBase + ' ')].length
      : null;
    const drTitle = has('dr');
    const usedFormatCode = P.rtfont.characters(rawGrowId).find(char => char.code)?.code ?? null;
    const drPrefixColour = drTitle && styleKey === 'dr' ? (P.rtfont.colors[usedFormatCode ?? '4'] ?? P.rtfont.colors['4']) : null;
    parts.push({
      text: P.rtfont.strip(rawName),
      formatText: rawName,
      guildRoleStartIndex,
      drPrefixLength: drTitle ? [...prefix].length : 0,
      drPrefixColour,
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
  function draw(k, p, cx, baselineY, measureOnly, textScale = 1) {
    const built = buildParts();
    if (!built) return 0;
    const parts = built.parts;
    const factor = Number.isFinite(textScale) && textScale > 0 ? textScale : 1;
    const iconPR = built.size * p;             /* icon size basis */
    const PR = iconPR * factor + 2;             /* player name: +2px */
    const tagPR = iconPR * factor + 5;          /* guild role: larger than the player name */
    const Pq = 1.6 * p;                       /* icon line gap */
    k.save();
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.font = "700 " + PR + "px 'Nameplate CG', sans-serif";
    k.fontKerning='none';
    k.textBaseline = 'alphabetic';
    const joined = parts.filter(x => x.text !== undefined).map(x => x.text).join(' ');
    const PN = descenderPenalty(joined) / 21;
    const PG = iconPR * 1.25 * PN;            /* title icon height stays full-size */
    const Pt = k.measureText(joined);
    const PA = Pt.actualBoundingBoxAscent + Pt.actualBoundingBoxDescent;
    const scaledFont = k.font;
    k.font = "700 " + iconPR + "px 'Nameplate CG', sans-serif";
    const PI = k.measureText('A').actualBoundingBoxAscent / 14;  /* icon pixel unit */
    k.font = scaledFont;
    const textPI = k.measureText('A').actualBoundingBoxAscent / 14; /* text pixel unit */
    const PB = descenderPenalty(joined) * PI; /* icon size unit */
    const L1 = 13.125 * PI;
    const iconCenterY = () => baselineY - 19 * PI + PB / 2;
    const pow2 = im => 2 ** Math.ceil(Math.log2(Math.max(im.naturalWidth ?? im.width, im.naturalHeight ?? im.height, 1)));
    const COUNTRY_FLAG_EDGE_INSET = 2;
  const sizeOf = part => {
      const im = resolveImg(part);
      if (part.guild) return [1.5 * PB * (im ? (im.naturalWidth ?? im.width) / (im.naturalHeight ?? im.height) : 1), 1.5 * PB];
      if (part.flag) {
        const width = im ? PB * (im.naturalWidth ?? im.width) / pow2(im) : PB;
        const height = im ? PB * (im.naturalHeight ?? im.height) / pow2(im) : PB;
        return [Math.max(1, width - COUNTRY_FLAG_EDGE_INSET * 2), Math.max(1, height - COUNTRY_FLAG_EDGE_INSET * 2)];
      }
      if (part.role || part.badge) return im ? [PB * (im.naturalWidth ?? im.width) / pow2(im), PB * (im.naturalHeight ?? im.height) / pow2(im)] : [PB, PB];
      return [im ? (im.naturalWidth ?? im.width) / (im.naturalHeight ?? im.height) * PG : PG, PG];
    };
    function resolveImg(part) {
      if (part.img instanceof HTMLCanvasElement) return part.img;
      return img(part.img);
    }
    const LE = parts.findIndex(x => x.flag || x.badge || x.guild);
    const LP = parts[LE];
    const LL = !!LP?.guild;                    /* has guild banner */
    const LC = iconPR * 1.226 * 1.2 * (WRENCH_STATUS_SCALE[state.wrenchStatus] ?? WRENCH_STATUS_SCALE.default);
    const widths = parts.map(part => {
      if (part.wrench) return LC;
      if (part.tag) return tagWidth(k, part.text, tagPR, PR);
      if (part.text !== undefined) {
        if (part.guildRoleStartIndex == null) return k.measureText(part.text).width * (1 + (part.grow ?? 0));
        const start = part.guildRoleStartIndex;
        const before = k.measureText(part.text.slice(0, start)).width;
        k.font = "700 " + tagPR + "px 'Nameplate CG', sans-serif";
        const role = k.measureText(part.text.slice(start)).width;
        k.font = "700 " + PR + "px 'Nameplate CG', sans-serif";
        return (before + role) * (1 + (part.grow ?? 0));
      }
      return sizeOf(part)[0];
    });
    const gaps = parts.map((part, i) => {
      if (part.flag) return 8.5 * PI;
      if (part.badge || part.guild) return L1;
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
      const hasFormatting = part.formatText !== undefined && (P.rtfont.hasCodes(part.formatText) || !!part.drPrefixColour);
      const formattedChars = hasFormatting ? P.rtfont.characters(part.formatText) : null;
      if (part.wrench) {
        const LD = Ld, Lu = LO + LD / 2, Ln = baselineY - PR * 0.393 - Ld / 2 + LD / 2;
        const isSuperSupporterWrench = state.wrenchStatus === 'super-supporter' && state.wrenchStyle === SUPER_SUPPORTER_WRENCH;
        const entry = !isSuperSupporterWrench && state.wrenchStyle !== BASE_WRENCH
          ? wrenchEntry('styles', state.wrenchStyle) : null;
        const wim = isSuperSupporterWrench ? superSupporterWrench() : entry ? sheet(entry[2]) : baseWrench();
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
        const outline = Math.max(1, p * factor * 0.5);
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
          const renderText = (offset, colorFn, applyFormatting = false) => {
            const ax = LO + offset * textPI, ay = baselineY - 19 * textPI + offset * textPI;
            k.save();
            if (part.scale !== 1) { k.translate(ax, ay); k.scale(part.scale, part.scale); k.translate(-ax, -ay); }
            if (!perLetter && !hasFormatting && part.guildRoleStartIndex == null) {
              k.fillStyle = rgba(colorFn(0, 0));
              k.fillText(part.text, ax, ay + 19 * textPI);
            } else {
              let x = ax, seen = 0;
              chars.forEach((ch, ci) => {
                const inGuildRole = part.guildRoleStartIndex != null && ci >= part.guildRoleStartIndex;
                k.font = "700 " + (inGuildRole ? tagPR : PR) + "px 'Nameplate CG', sans-serif";
                if (ch !== ' ') {
                  const isDrPrefix = ci < (part.drPrefixLength ?? 0);
                  // A Dr. prefix is special only when Dr. is the active style;
                  // higher-priority titles (especially Immortal) control its color.
                  const explicit = applyFormatting && !isDrPrefix ? formattedChars[ci]?.rgb : null;
                  const prefixColour = part.drPrefixColour && isDrPrefix ? part.drPrefixColour : null;
                  const inherited = isDrPrefix && !perLetter ? colorFn(0, 0) : colorFn(ci, seen);
                  k.fillStyle = rgba(prefixColour ? [...prefixColour, 255] : explicit ? [...explicit, 255] : inherited);
                  k.fillText(ch, x, ay + 19 * textPI);
                  seen++;
                }
                x += k.measureText(ch).width;
              });
              k.font = scaledFont;
            }
            k.restore();
          };
          const shadow = st.shadow;
          if (shadow) renderText(shadow.at, shadow.same ? colorAt : shadow.code ? () => [...part.code, 255] : () => shadow.rgba);
          renderText(0, colorAt, hasFormatting);
        } else if (part.tag) {
          let x = LO, ci = 0;
          for (const [ch, cap] of withCaps(part.text)) {
            k.font = '700 ' + (cap ? tagPR * CAPS : tagPR) + "px 'Nameplate CG', sans-serif";
            paint(ch, x, formattedChars?.[ci]?.rgb || part.colour);
            x += k.measureText(ch).width;
            ci++;
          }
          k.font = '700 ' + PR + "px 'Nameplate CG', sans-serif";
        } else if (hasFormatting) {
          const outline = Math.max(1, p * factor * 0.5);
          k.fillStyle = 'rgba(0,0,0,.5)';
          k.fillText(part.text, LO + outline, baselineY + outline);
          let x = LO;
          for (const [ci,entry] of formattedChars.entries()) {
            const prefixColour = part.drPrefixColour && ci < part.drPrefixLength ? part.drPrefixColour : null;
            const color = entry.rgb || prefixColour || part.colour;
            k.fillStyle = 'rgba(' + color.join(',') + ',' + part.alpha + ')';
            k.fillText(entry.char, x, baselineY);
            x += k.measureText(entry.char).width;
          }
        } else if (part.guildRoleStartIndex != null) {
          let x = LO;
          [...part.text].forEach((ch, ci) => {
            const inGuildRole = ci >= part.guildRoleStartIndex;
            k.font = "700 " + (inGuildRole ? tagPR : PR) + "px 'Nameplate CG', sans-serif";
            paint(ch, x, part.colour);
            x += k.measureText(ch).width;
          });
          k.font = "700 " + PR + "px 'Nameplate CG', sans-serif";
        } else {
          paint(part.text, LO, part.colour);
        }
      } else {
        const im = resolveImg(part);
        const h = sizeOf(part)[1], y = yOf(part, h);
        if (im) {
          const iconPart = part.flag || part.badge || part.guild;
          const x = (part.badge === 'g4g' || part.role && LP?.badge === 'g4g' ? LO - 4 * PI : LO) + (iconPart ? 1 : 0) - (part.flag ? COUNTRY_FLAG_EDGE_INSET : 0);
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
    draw(ctx, cx, baselineY, scale, t, textScale = 1) {
      clock = t ?? clock;
      return draw(ctx, scale, cx, baselineY, false, textScale);
    },
    measure(ctx, cx, baselineY, scale, textScale = 1) { return draw(ctx, scale, cx, baselineY, true, textScale); },
    titles: TITLES, conflicts: CONFLICTS, guildRoles: GUILD_ROLES, baseWrenchId: BASE_WRENCH,
    get wrenchData() { return wrenchData; },
    get frames(){return frames;},
    // A layout snapshot is useful to exporters and headless verification.
    inspect(){return buildParts();}
  };
  P.plateConfig = {
    get: () => ({...state,titles:[...state.titles]}),
    set(patch) { state = normalizeState({...state,...patch}); save(); },
    setGrowId(v) { state.growId = P.rtfont.sanitizeGrowId(String(v ?? ''), 19); P.store.set('plate', state); },  /* silent: no UI rebuild while typing */
    setRole(v) { state.role = v; save(); },
    setFlag(v) { state.flag = v; save(); },
    setGuildRole(v) { state.guildRole = v; save(); },
    setGuildFlag(id) { state.guildFlag = +id || 0; save(); },
    setWrenchStatus(id) {
      state.wrenchStatus = Object.hasOwn(WRENCH_STATUS_SCALE, id) ? id : 'default';
      if (state.wrenchStatus !== 'super-supporter' && state.wrenchStyle === SUPER_SUPPORTER_WRENCH) state.wrenchStyle = 0;
      save();
    },
    setWrenchStyle(id) {
      state.wrenchStyle = id === SUPER_SUPPORTER_WRENCH
        ? (state.wrenchStatus === 'super-supporter' ? id : 0)
        : (+id || 0);
      save();
    },
    setWrenchDecoration(id) { state.wrenchDecoration = +id || 0; save(); },
    setWrenchOn(on) { state.wrenchOn = !!on; save(); },
    toggleTitle(key) {
      key=String(key??'').toLowerCase();if(!titleByKey[key])return;
      const i = state.titles.indexOf(key);
      if (i >= 0) state.titles.splice(i, 1);
      else {
        for (const other of [...state.titles]) if (inConflict(key, other))
          state.titles.splice(state.titles.indexOf(other), 1);
        state.titles.push(key);
      }
      save();
    },
    reset() { state = normalizeState(DEFAULTS); save(); }
  };
})();
