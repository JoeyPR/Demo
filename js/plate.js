/* PLATE: the Set Planner GT name-plate system — GrowID, player titles,
   badges, role icons, guild role tags and the wrench icon with styles and
   decorations, drawn above the player's head. Ported from the Website
   repo's deobfuscated renderer. */
(function(){
  'use strict';

  /* ---------------- title catalog (from the Website system) ------------- */
  const TITLES = [
    { key: 'immortal',   name: 'Immortal',           after: 'immortal', legendary: true },
    { key: 'legend',    name: 'Legendary',          flag: 'legend', suffix: ' of Legend', size: 1.15, legendary: true },
    { key: 'mentor',    name: 'Mentor',              flag: 'mentor' },
    { key: 'dr',        name: 'Dungeoneer',          suffix: ' of the Dr', color: '#FF1744' },
    { key: 'party',     name: 'Party Animal',        flag: 'popper', suffix: ' the Party Animal', color: 'party' },
    { key: 'g4g',       name: 'G4G',                 suffix: ' of G4G', color: 'g4g' },
    { key: 'l125',      name: 'Level 125',           flag: 'l125', color: 'l125' },
    { key: 'chad',     name: 'Chad',                prefix: 'Chad ', color: 'chad' },
    { key: 'gm',       name: 'Grand Master',        prefix: 'Grand Master ', color: 'gold' },
    { key: 'wizard',   name: 'Wizard',              prefix: 'Wizard ', color: 'gold' },
    { key: 'masterWizard', name: 'Master Wizard',   prefix: 'Master Wizard ', color: 'gold' },
    { key: 'LL',       name: 'Leet Legend',         suffix: ' LL', color: 'legend' },
    { key: 'GT',       name: 'GrowTopia',           prefix: 'GT ', color: 'gold' },
    { key: 'LAG',      name: 'Lag Slayer',          suffix: ' LAG', color: 'legend' },
    { key: 'thanks',  name: 'Thankful',            after: 'winter' },
    { key: 'old',     name: 'Old School',          after: 'old' },
    { key: 'gold',     name: 'Gold',               flag: 'gold' },
    { key: 'silver',   name: 'Silver',             flag: 'silver' },
    { key: 'bronze',   name: 'Bronze',             flag: 'bronze' },
    { key: 'award',    name: 'Award Winner',       flag: 'award' },
    { key: 'winter',   name: 'Winter Clash',       flag: 'winter' },
    { key: 'cc',       name: 'Country Clash',      badge: 'ccBadge' },
    { key: 'tt',       name: 'Tourist Trophy',     badge: 'ttBadge' },
    { key: 'pblo',     name: 'PBL Organizer',      flag: 'pblOrganizer' },
    { key: 'pblm',     name: 'PBL Moderator',      flag: 'pblModerator' },
    { key: 'dgb',      name: 'Dungeon Bronze',     flag: 'dungeonBronze' },
    { key: 'dgs',      name: 'Dungeon Silver',     flag: 'dungeonSilver' },
    { key: 'dgg',      name: 'Dungeon Gold',       flag: 'dungeonGold' },
    { key: 'dgr',      name: 'Dungeon Ruby',       flag: 'dungeonRuby' },
    { key: 'dge',      name: 'Dungeon Emerald',    flag: 'dungeonEmerald' },
    { key: 'dgsa',     name: 'Dungeon Sapphire',   flag: 'dungeonSapphire' }
  ];
  const byKey = Object.fromEntries(TITLES.map(t => [t.key, t]));

  /* mutually exclusive title groups (from the Website conflict map) */
  const CONFLICTS = [
    ['l125', 'party'],
    ['g4g', 'party'],
    ['thanks', 'old', 'gold', 'silver', 'bronze', 'award', 'winter', 'immortal', 'dgb', 'dgs', 'dgg', 'dgr', 'dge', 'dgsa'],
    ['pblo', 'pblm'],
    ['legend', 'party']
  ];

  /* name-text color styles */
  const RAINBOW = t => `hsl(${(t * 240) % 360} 100% 55%)`;
  const STYLES = {
    party: { letters: RAINBOW },
    g4g:   { cycle: t => `hsl(${50 + 30 * Math.sin(2 * Math.PI * t)} 90% 58%)` },
    l125:  { color: 'rgba(108,236,241,1)', swell: [0.9, 0.175] },
    mentor:{ color: '#FFA726' },
    dr:    { color: '#FF1744', swell: [0.45, 0.35] },
    legend:{ cycle: t => `hsl(${45 + 15 * Math.sin(2 * Math.PI * t)} 100% 60%)` },
    chad:  { color: 'rgba(153,97,255,1)' },
    gold:  { color: '#FFD700' }
  };

  const GUILD_ROLES = {
    elder:     { label: 'ELDER',     color: 'rgba(251,161,40,1)' },
    co:        { label: 'CO-LEADER', color: 'rgba(235,46,151,1)' },
    leader:    { label: 'LEADER',    color: 'rgba(251,58,60,1)' }
  };

  /* ---------------- image cache ------------------------------------------ */
  const cache = new Map();
  function img(path) {
    let im = cache.get(path);
    if (!im) {
      im = new Image();
      im.onload = () => P.emit('plate-dirty');
      im.src = path;
      cache.set(path, im);
    }
    return im;
  }
  const ready = im => im.complete && im.naturalWidth > 0;

  /* tinted base wrench (green), exactly like the Website renderer */
  let baseWrench = null;
  function tintedWrench() {
    const src = img('img/wrench.png');
    if (!ready(src)) return null;
    if (baseWrench) return baseWrench;
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = 'rgb(128,255,128)';
    x.fillRect(0, 0, 32, 32);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(src, 0, 0);
    baseWrench = c;
    return c;
  }

  /* ---------------- state ------------------------------------------------ */
  const DEFAULTS = {
    growId: 'Joey',
    titles: ['legend'],
    role: '',
    flag: '',
    badge: '',
    guildRole: '',
    wrenchStyle: 0,
    wrenchDecoration: 0
  };
  let state = Object.assign({}, DEFAULTS, P.store.get('plate', {}));

  function save() { P.store.set('plate', state); P.emit('plate-update'); }
  P.plateState = state;
  P.titles = { all: TITLES, byKey, conflicts: CONFLICTS, guildRoles: GUILD_ROLES };

  P.plateConfig = {
    get() { return state; },
    setGrowId(name) { state.growId = String(name).slice(0, 20); save(); },
    toggleTitle(key) {
      const i = state.titles.indexOf(key);
      if (i >= 0) state.titles.splice(i, 1);
      else {
        /* pairwise conflicts: a new title removes any selected title that
           shares a conflict group with it (the Website's rule) */
        state.titles = state.titles.filter(t =>
          !CONFLICTS.some(g => g.includes(t) && g.includes(key)));
        state.titles.push(key);
        if (state.titles.length > 3) state.titles.shift();
      }
      save();
    },
    setRole(r) { state.role = r; save(); },
    setFlag(f) { state.flag = f; save(); },
    setBadge(b) { state.badge = b; save(); },
    setGuildRole(g) { state.guildRole = g; save(); },
    setWrenchStyle(id) { state.wrenchStyle = id; save(); },
    setWrenchDecoration(id) { state.wrenchDecoration = id; save(); }
  };

  /* ---------------- part assembly (port of the Website part builder) ------ */
  function activeTitles() { return state.titles.map(k => byKey[k]).filter(Boolean); }
  function nameStyle() {
    const order = ['party', 'g4g', 'l125', 'mentor', 'dr', 'legend'];
    for (const k of order) if (state.titles.includes(k)) return STYLES[k];
    return null;
  }

  function buildParts() {
    const parts = [];
    const titles = activeTitles();
    if (state.role) parts.push({ img: 'img/flags/role-' + state.role + '.png', h: 20 });
    for (const t of titles.filter(t => t.flag || t.plateFlag)) parts.push({ img: 'img/titles/' + (t.plateFlag || t.flag) + '.png', h: 17.5 });
    if (state.guildRole) parts.push({ text: GUILD_ROLES[state.guildRole].label, color: GUILD_ROLES[state.guildRole].color, h: 9 });
    const style = nameStyle();
    const name = { text: state.growId || ' ', style };
    for (const t of titles) {
      if (t.prefix) { parts.push({ text: t.prefix, color: t.color, titleColor: true }); break; }
    }
    parts.push(name);
    if (state.flag) parts.push({ img: 'img/flags/' + state.flag + '.png', h: 17.5 });
    else if (state.badge) parts.push({ img: 'img/titles/' + state.badge + '.png', h: 17.5 });
    for (const t of titles) {
      if (t.suffix) parts.push({ text: t.suffix, color: t.color, titleColor: true });
    }
    for (const t of titles.filter(t => t.after)) parts.push({ img: 'img/titles/' + t.after + '.png', h: 17.5 });
    for (const t of titles.filter(t => t.both)) parts.push({ img: 'img/titles/' + t.both + '.png', h: 17.5, mirror: true });
    if (state.wrenchStyle !== null || state.wrenchDecoration) parts.push({ wrench: true });
    return parts;
  }

  /* ---------------- drawing (port of the Website plate renderer) ---------- */
  const SHEETS = 'demo/assets/';

  function drawPart(ctx, part, x, y, p, t) {
    if (part.wrench) { drawWrench(ctx, x + 16 * p, y - 9 * p, p, t); return 32 * p; }
    if (part.text) {
      ctx.font = `700 ${13.4 * p}px "Century Gothic GT", "Century Gothic", sans-serif`;
      ctx.textBaseline = 'alphabetic';
      if (part.style && part.style.letters) {
        let cx = x;
        for (const ch of part.text) {
          ctx.fillStyle = part.style.letters(t + cx / 60);
          drawShadowed(ctx, ch, cx, y, p);
          cx += ctx.measureText(ch).width;
        }
        return ctx.measureText(part.text).width;
      }
      let fill = '#fff';
      if (part.color && STYLES[part.color] && STYLES[part.color].color) fill = STYLES[part.color].color;
      if (part.color && /^#|^rgba\(/.test(part.color)) fill = part.color;
      if (part.style && part.style.color) fill = part.style.color;
      if (part.style && part.style.cycle) fill = part.style.cycle(t);
      ctx.fillStyle = fill;
      drawShadowed(ctx, part.text, x, y, p);
      return ctx.measureText(part.text).width;
    }
    if (part.img) {
      const im = img(part.img);
      if (!ready(im)) return part.h * p * (im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1);
      const h = part.h * p, w = h * (im.naturalWidth / im.naturalHeight);
      if (part.mirror) {
        ctx.save();
        ctx.translate(x + w, y - h);
        ctx.scale(-1, 1);
        ctx.drawImage(im, 0, 0, w, h);
        ctx.restore();
      } else ctx.drawImage(im, x, y - h, w, h);
      return w;
    }
    return 0;
  }

  function drawShadowed(ctx, text, x, y, p) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(text, x + 1 * p, y + 1 * p);
    ctx.restore();
    ctx.fillText(text, x, y);
  }

  function drawWrench(ctx, x, y, p, t) {
    const w0 = window.P.wrenchData;
    let image = null, sx = 0, sy = 0;
    if (state.wrenchStyle && w0) {
      const s = w0.styles.find(s => s[0] === state.wrenchStyle);
      if (s) { image = img(SHEETS + s[2]); sx = s[3] * 32; sy = s[4] * 32; }
    }
    if (!image) { image = tintedWrench(); sx = 0; sy = 0; }
    if (!image || !ready(image)) return;
    const wob = 20 * Math.sin(2 * Math.PI * t / 3) * Math.PI / 180;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wob);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, 32, 32, -16 * p, -16 * p, 32 * p, 32 * p);
    if (state.wrenchDecoration && w0) {
      const d = w0.decorations.find(d => d[0] === state.wrenchDecoration);
      const di = d && img(SHEETS + d[2]);
      if (di && ready(di)) {
        ctx.drawImage(di, d[3] * 32, d[4] * 32, 32, 32, -16 * p, -16 * p, 32 * p, 32 * p);
      }
    }
    ctx.restore();
  }

  /* main entry: draws the plate centered at cx, bottom edge at bottomY */
  function draw(ctx, cx, bottomY, scale, t) {
    const parts = buildParts();
    if (!parts.length) return 0;
    const p = scale;
    /* measure pass */
    const widths = parts.map(part => {
      if (part.wrench) return 32 * p;
      if (part.text) {
        ctx.font = `700 ${13.4 * p}px "Century Gothic GT", "Century Gothic", sans-serif`;
        return ctx.measureText(part.text).width;
      }
      if (part.img) {
        const im = img(part.img);
        const h = part.h * p;
        return im.naturalWidth ? h * (im.naturalWidth / im.naturalHeight) : h;
      }
      return 0;
    });
    const gap = 2.4 * p;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    let x = cx - total / 2;
    const y = bottomY - 6 * p;
    for (let i = 0; i < parts.length; i++) {
      drawPart(ctx, parts[i], x, y, p, t);
      x += widths[i] + gap;
    }
    return total;
  }

  P.plate = { draw };
  P.on('wrench-data', () => { /* wrench.json loaded by wrench-ui */ });
})();
