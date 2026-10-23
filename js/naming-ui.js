/* NAMING UI: the CUSTOM tab — GrowID, player titles, badges, role icons,
   flags, guild role and player skin. Drives the plate system. */
(function(){
  'use strict';
  const host = P.$('#custom-tools');
  let section = 'name';

  const SECTIONS = [
    ['name', 'Player'],
    ['titles', 'Titles'],
    ['badges', 'Badges'],
    ['guild', 'Guild']
  ];

  const ROLES = [['', 'None'], ['builder', 'Builder'], ['chef', 'Chef'], ['farmer', 'Farmer'], ['fisher', 'Fisher'], ['startopian', 'Startopian'], ['surgeon', 'Surgeon']];
  const BADGES = [['', 'None'], ['award', 'Award'], ['ccBadge', 'Country Clash'], ['ttBadge', 'Tourist Trophy'], ['weatherMachine', 'Weather Machine']];
  const FLAGS = [['', 'None'], ['us', 'United States']];
  const GUILD_ROLES = [['', 'None'], ['elder', 'Elder'], ['co', 'Co-Leader'], ['leader', 'Leader']];
  const TITLE_CATEGORIES = [['name', 'Name'], ['badges', 'Badges'], ['icon', 'Title icon']];
  const SKINS = [
    { name: 'Warm peach', rgb: [255, 206, 180, 255] },
    { name: 'Golden tan', rgb: [208, 149, 105, 255] },
    { name: 'Deep brown', rgb: [128, 82, 61, 255] },
    { name: 'Cool blue', rgb: [127, 194, 218, 255] },
    { name: 'Soft stone', rgb: [186, 194, 175, 255] }
  ];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function sectionButtons() {
    const row = el('div', 'c-sections');
    for (const [id, label] of SECTIONS) {
      const b = el('button', 'c-chip' + (section === id ? ' on' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { section = id; render(); });
      row.append(b);
    }
    return row;
  }

  function field(label, control) {
    const wrap = el('div', 'c-field');
    wrap.append(el('span', 'c-label', label));
    wrap.append(control);
    return wrap;
  }

  function renderName() {
    const box = el('div', 'c-group');
    const input = el('input', 'c-input');
    input.type = 'text'; input.maxLength = 20; input.value = P.plateConfig.get().growId;
    input.placeholder = 'Your GrowID';
    input.addEventListener('input', () => P.plateConfig.setGrowId(input.value));
    box.append(field('GrowID', input));

    const role = el('select', 'c-select');
    for (const [v, label] of ROLES) {
      const o = el('option', null, label); o.value = v; role.append(o);
    }
    role.value = P.plateConfig.get().role;
    role.addEventListener('change', () => P.plateConfig.setRole(role.value));
    box.append(field('Role icon', role));

    const flag = el('select', 'c-select');
    for (const [v, label] of FLAGS) {
      const o = el('option', null, label); o.value = v; flag.append(o);
    }
    flag.value = P.plateConfig.get().flag;
    flag.addEventListener('change', () => P.plateConfig.setFlag(flag.value));
    box.append(field('Country flag', flag));

    const badge = el('select', 'c-select');
    for (const [v, label] of BADGES) {
      const o = el('option', null, label); o.value = v; badge.append(o);
    }
    badge.value = P.plateConfig.get().badge;
    badge.addEventListener('change', () => P.plateConfig.setBadge(badge.value));
    box.append(field('Badge', badge));

    /* skins */
    const skins = el('div', 'c-swatches');
    const cur = P.store.get('skin', 0);
    SKINS.forEach((s, i) => {
      const b = el('button', 'c-swatch' + (cur === i ? ' on' : ''));
      b.type = 'button'; b.title = s.name;
      b.style.background = `rgb(${s.rgb.slice(0, 3).join(',')})`;
      b.addEventListener('click', () => { P.store.set('skin', i); P.emit('skin', i); render(); });
      skins.append(b);
    });
    box.append(field('Player skin', skins));
    return box;
  }

  function renderTitles() {
    const box = el('div', 'c-group');
    const state = P.plateConfig.get();
    const cats = el('div', 'c-sections');
    let cat = 'name';
    for (const [id, label] of TITLE_CATEGORIES) {
      const b = el('button', 'c-chip' + (cat === id ? ' on' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { cat = id; box.replaceChildren(...titleEls(cat, state)); box.prepend(cats); });
      cats.append(b);
    }
    box.append(cats);
    box.append(...titleEls(cat, state));
    const hint = el('p', 'c-hint', 'Pick up to 3 titles. Conflicting titles replace each other.');
    box.append(hint);
    return box;
  }

  function titleEls(cat, state) {
    const grid = el('div', 'c-titles');
    for (const t of P.titles.all) {
      const inCat = cat === 'name' ? !!t.color : cat === 'badges' ? !!t.badge : !!(t.flag || t.after || t.both);
      if (!inCat) continue;
      const b = el('button', 'c-title' + (state.titles.includes(t.key) ? ' on' : ''));
      b.type = 'button'; b.title = t.name;
      if (t.flag || t.after || t.badge || t.plateFlag) {
        const im = el('img');
        im.src = 'img/titles/' + (t.plateFlag || t.flag || t.after || t.badge) + '.png';
        im.alt = ''; im.draggable = false;
        im.onerror = () => im.remove();
        b.append(im);
      }
      b.append(el('span', 'c-tname', t.name));
      b.addEventListener('click', () => { P.plateConfig.toggleTitle(t.key); render(); });
      grid.append(b);
    }
    return [grid];
  }

  function renderBadges() {
    const box = el('div', 'c-group');
    const state = P.plateConfig.get();
    const grid = el('div', 'c-titles');
    for (const t of P.titles.all.filter(t => t.badge || (t.flag && ['award', 'winter'].includes(t.key)))) {
      const b = el('button', 'c-title' + (state.titles.includes(t.key) ? ' on' : ''));
      b.type = 'button'; b.title = t.name;
      const im = el('img');
      im.src = 'img/titles/' + (t.badge || t.flag) + '.png';
      im.alt = ''; im.draggable = false;
      b.append(im);
      b.append(el('span', 'c-tname', t.name));
      b.addEventListener('click', () => { P.plateConfig.toggleTitle(t.key); render(); });
      grid.append(b);
    }
    box.append(grid);
    return box;
  }

  function renderGuild() {
    const box = el('div', 'c-group');
    const g = el('select', 'c-select');
    for (const [v, label] of GUILD_ROLES) {
      const o = el('option', null, label); o.value = v; g.append(o);
    }
    g.value = P.plateConfig.get().guildRole;
    g.addEventListener('change', () => P.plateConfig.setGuildRole(g.value));
    box.append(field('Guild role', g));
    const hint = el('p', 'c-hint', 'Guild role tags render beside your name, colored like in game.');
    box.append(hint);
    return box;
  }

  function render() {
    host.replaceChildren();
    host.append(sectionButtons());
    if (section === 'name') host.append(renderName());
    else if (section === 'titles') host.append(renderTitles());
    else if (section === 'badges') host.append(renderBadges());
    else host.append(renderGuild());
  }

  P.on('custom-open', render);
  P.on('plate-update', () => { if (!host.hidden) render(); });
  render();
})();
