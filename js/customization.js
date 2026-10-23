/* PLAYER CUSTOMIZATION + MAKEUP — donor structure; the Player tab carries the
   Website repo's title system (titles, role icon, country flag, guild, skin),
   the Makeup tab carries the planner's dye cards (Hair Dye / Eye Drops /
   Contact Lenses) applied to the Demo engine's player sheets. */
(function () {
  const tools = P.$('#custom-tools');
  const grid = P.$('#grid');
  const clamp = n => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
  /* catalog constants (donor's customization-data + site's role/flag lists) */
  const ROLES = ['farmer', 'builder', 'surgeon', 'fisher', 'chef', 'startopian'];
  const FLAGS = [];
  const SKINS = (typeof window !== 'undefined' && window.PLANNER_SKINS) || [
    { name: 'Warm peach', rgb: [255, 206, 180] },
    { name: 'Golden tan', rgb: [208, 149, 105] },
    { name: 'Deep brown', rgb: [128, 82, 61] },
    { name: 'Cool blue', rgb: [127, 194, 218] },
    { name: 'Soft stone', rgb: [186, 194, 175] }
  ];
  const DYE_EFFECTS = {
    r: [32, -16, -16], g: [-16, 32, -16], b: [-16, -16, 32],
    k: [-32, -32, -32], clean: [32, 32, 32], lensClean: [-32, -32, -32]
  };
  const DYES = [
    { key: 'hair', name: 'Hair Dye', description: 'Changes the worn hair layer.', start: [255, 255, 255],
      actions: [
        { id: 'r', label: 'Red Hair Dye', short: 'Red', color: '#e53030' },
        { id: 'g', label: 'Green Hair Dye', short: 'Green', color: '#3cbf3c' },
        { id: 'b', label: 'Blue Hair Dye', short: 'Blue', color: '#3a6fe0' },
        { id: 'k', label: 'Black Hair Dye', short: 'Black', color: '#111111' },
        { id: 'clean', label: 'Shampoo', short: 'Shampoo', color: '#ffffff' }
      ] },
    { key: 'whites', name: 'Eye Drops', description: 'Changes the whites of the eyes.', start: [255, 255, 255],
      actions: [
        { id: 'r', label: 'Red Eye Drops', short: 'Red', color: '#e53030' },
        { id: 'g', label: 'Green Eye Drops', short: 'Green', color: '#3cbf3c' },
        { id: 'b', label: 'Blue Eye Drops', short: 'Blue', color: '#3a6fe0' },
        { id: 'k', label: 'Black Eye Drops', short: 'Black', color: '#111111' },
        { id: 'clean', label: 'Eye Cleaning Solution', short: 'Cleanser', color: '#ffffff' }
      ] },
    { key: 'pupils', name: 'Contact Lenses', description: 'Changes the pupil/iris colour of the eyes.', start: [0, 0, 0],
      actions: [
        { id: 'r', label: 'Red Contact Lens', short: 'Red', color: '#e53030' },
        { id: 'g', label: 'Green Contact Lens', short: 'Green', color: '#3cbf3c' },
        { id: 'b', label: 'Blue Contact Lens', short: 'Blue', color: '#3a6fe0' },
        { id: 'k', label: 'Black Contact Lens', short: 'Black', color: '#111111' },
        { id: 'lensClean', label: 'Lens Cleaning Solution', short: 'Cleanser', color: '#ffffff' }
      ] }
  ];
  const cloneRGB = (value, fallback) =>
    Array.isArray(value) && value.length === 3 ? value.map(clamp) : [...fallback];
  const stored = P.store.get('playerCustomization', {});
  const raw = stored && typeof stored === 'object' ? stored : {};
  const state = {
    dyes: {}, uses: {},
    skin: P.store.get('skin', 0)
  };
  for (const dye of DYES) {
    state.dyes[dye.key] = cloneRGB(raw.dyes && raw.dyes[dye.key], dye.start);
    state.uses[dye.key] = Object.assign({}, (raw.uses && raw.uses[dye.key]) || {});
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const rgbText = rgb => 'rgb(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ')';
  const changedRGB = (rgb, delta) => rgb.map((n, i) => clamp(n + delta[i]));
  const canApply = (dye, action) =>
    changedRGB(state.dyes[dye.key], DYE_EFFECTS[action.id]).some((v, i) => v !== state.dyes[dye.key][i]);
  function save() {
    P.store.set('playerCustomization', { dyes: state.dyes, uses: state.uses });
    applyDyes();
  }

  /* ---------------- dyes → Demo engine sheets ---------------- */
  function applyDyes() {
    if (P.dyes) {
      P.dyes.hair = state.dyes.hair;
      P.dyes.whites = state.dyes.whites;
      P.dyes.pupils = state.dyes.pupils;
      P.applyDyes && P.applyDyes();
    }
  }

  /* ---------------- Player tab ---------------- */
  function renderPlayerCustomization() {
    tools.replaceChildren();
    const panel = el('section', 'custom-panel player-custom-panel');
    panel.append(
      el('h2', 'custom-heading', 'Player Customization'),
      el('p', 'custom-note', 'GrowID, titles, role icon, flag, guild and skin shown on the plate above your character.')
    );

    const fields = el('div', 'custom-fields');
    /* GrowID — typed live, never rebuilds the panel (focus is preserved) */
    const growWrap = el('div', 'custom-field');
    const growLabel = el('label', 'custom-label', 'Player GrowID');
    growLabel.htmlFor = 'player-grow-id';
    const growInput = el('input', 'custom-input');
    growInput.id = 'player-grow-id';
    growInput.type = 'text'; growInput.maxLength = 18;
    growInput.autocomplete = 'off'; growInput.spellcheck = false;
    growInput.placeholder = 'Enter your GrowID';
    growInput.value = P.plateConfig.get().growId;
    growInput.setAttribute('aria-label', 'Player GrowID');
    growInput.addEventListener('input', () => P.plateConfig.setGrowId(growInput.value));
    growInput.addEventListener('keydown', e => e.stopPropagation());
    growWrap.append(growLabel, growInput);
    fields.append(growWrap);

    /* role icon row */
    const roleWrap = el('div', 'custom-field');
    roleWrap.append(el('label', 'custom-label', 'Role Icon'));
    const roles = el('div', 'c-roles');
    for (const r of ROLES) {
      const b = el('button', 'c-role' + (P.plateConfig.get().role === r ? ' on' : ''));
      b.type = 'button'; b.title = r[0].toUpperCase() + r.slice(1);
      const im = el('img'); im.src = 'img/flags/role-' + r + '.png'; im.alt = '';
      b.append(im);
      b.addEventListener('click', () => {
        const cur = P.plateConfig.get().role;
        P.plateConfig.setRole(cur === r ? '' : r);
        renderPlayerCustomization();
      });
      roles.append(b);
    }
    roleWrap.append(roles);
    fields.append(roleWrap);

    /* country flag */
    const flagWrap = el('div', 'custom-field');
    const flagLabel = el('label', 'custom-label', 'Country Flag');
    flagLabel.htmlFor = 'player-flag';
    const flagSelect = el('select', 'custom-select');
    flagSelect.id = 'player-flag';
    flagSelect.setAttribute('aria-label', 'Country Flag');
    let flagsLoaded = false;
    const flagOptions = () => {
      flagSelect.replaceChildren();
      for (const [code, name] of FLAGS) {
        const o = el('option', '', name);
        o.value = code;
        flagSelect.append(o);
      }
      flagSelect.value = P.plateConfig.get().flag || 'us';
      flagsLoaded = true;
    };
    flagOptions();
    if (!FLAGS.length) {
      fetch('img/flags/index.json').then(r => r.json()).then(codes => {
        const named = {};
        try {
          const dn = new Intl.DisplayNames(['en'], { type: 'region' });
          for (const c of codes) {
            if (c.length === 2) { try { const n = dn.of(c.toUpperCase()); if (n && n !== c.toUpperCase()) named[c] = n; } catch {}
            }
          }
        } catch {}
        for (const [c, n] of [['catalonia', 'Catalonia'], ['england', 'England'], ['europeanunion', 'European Union'], ['scotland', 'Scotland'], ['wales', 'Wales']]) named[c] = n;
        FLAGS.push(...codes.map(c => [c, named[c] || c.toUpperCase()]));
        FLAGS.sort((a, b) => a[1].localeCompare(b[1]));
        flagOptions();
      }).catch(() => {});
    }
    flagSelect.addEventListener('change', () => P.plateConfig.setFlag(flagSelect.value));
    flagWrap.append(flagLabel, flagSelect);
    fields.append(flagWrap);

    /* guild: flag item id + role */
    const guildWrap = el('div', 'custom-field c-guild');
    guildWrap.append(el('label', 'custom-label', 'Guild'));
    const guildRow = el('div', 'c-guild-row');
    const flagItem = el('input', 'custom-input');
    flagItem.type = 'text'; flagItem.placeholder = 'Guild flag item ID';
    flagItem.value = P.plateConfig.get().guildFlag || '';
    flagItem.setAttribute('aria-label', 'Guild flag item ID');
    flagItem.addEventListener('input', () => P.plateConfig.setGuildFlag(parseInt(flagItem.value, 10) || 0));
    flagItem.addEventListener('keydown', e => e.stopPropagation());
    const guildRole = el('select', 'custom-select');
    guildRole.setAttribute('aria-label', 'Guild role');
    for (const [id, name] of [['', 'No guild role'], ['elder', 'Elder'], ['co', 'Co-Leader'], ['leader', 'Leader']]) {
      const o = el('option', '', name); o.value = id;
      guildRole.append(o);
    }
    guildRole.value = P.plateConfig.get().guildRole || '';
    guildRole.addEventListener('change', () => P.plateConfig.setGuildRole(guildRole.value));
    guildRow.append(flagItem, guildRole);
    guildWrap.append(guildRow);
    fields.append(guildWrap);

    /* skin swatches (Demo engine skins) */
    const skinWrap = el('div', 'custom-field');
    skinWrap.append(el('label', 'custom-label', 'Skin'));
    const skins = el('div', 'c-skins');
    SKINS.forEach((s, i) => {
      const b = el('button', 'c-skin' + (state.skin === i ? ' on' : ''));
      b.type = 'button'; b.title = s.name;
      b.style.background = 'rgb(' + s.rgb.join(',') + ')';
      b.addEventListener('click', () => {
        state.skin = i;
        P.store.set('skin', i);
        P.emit('skin', i);
        renderPlayerCustomization();
      });
      skins.append(b);
    });
    skinWrap.append(skins);
    fields.append(skinWrap);
    panel.append(fields);

    /* titles grid — categories like the Website: Name / Badges / Title icons */
    const plate = P.plateConfig.get();
    const cat = el('div', 'c-sections');
    const TITLE_CATEGORIES = [
      ['Name', ['legend', 'l125', 'g4g', 'party', 'dr', 'mentor']],
      ['Badges', ['cc', 'tt']],
      ['Title icons', ['immortal', 'thanks', 'old', 'gold', 'silver', 'bronze', 'award', 'winter', 'pblo', 'pblm', 'dgb', 'dgs', 'dgg', 'dgr', 'dge', 'dgsa']]
    ];
    for (const [label, keys] of TITLE_CATEGORIES) {
      const b = el('button', 'c-section' + (titleCat === label ? ' on' : ''), label);
      b.addEventListener('click', () => { titleCat = label; renderPlayerCustomization(); });
      cat.append(b);
    }
    panel.append(el('h3', 'custom-heading sm', 'Titles'), cat);
    const list = P.plate.titles.filter(t => TITLE_CATEGORIES.find(c => c[0] === titleCat)[1].includes(t.key));
    const grid2 = el('div', 'c-titles');
    for (const t of list) {
      const sel = plate.titles.includes(t.key);
      const b = el('button', 'c-title' + (sel ? ' on' : ''));
      b.type = 'button';
      const im = el('img'); im.src = 'img/titles/' + (t.plateFlag ? t.plateFlag.split('/').pop() : (t.flag || t.after || t.both || 'legend') + '.png'); im.alt = '';
      if (!t.flag && !t.after && !t.both) { im.remove(); b.append(el('span', 'c-title-txt', t.name)); }
      else b.append(im);
      b.append(el('span', 'c-title-name', t.name));
      b.addEventListener('click', () => { P.plateConfig.toggleTitle(t.key); renderPlayerCustomization(); });
      grid2.append(b);
    }
    panel.append(grid2);
    tools.append(panel);
  }
  let titleCat = 'Name';

  /* ---------------- Makeup tab (donor dye cards) ---------------- */
  const dyeCardRefs = new Map();
  function updateDyeCard(dyeKey) {
    const refs = dyeCardRefs.get(dyeKey);
    const dye = DYES.find(d => d.key === dyeKey);
    if (!refs || !dye) return;
    const rgb = state.dyes[dye.key];
    refs.swatch.style.backgroundColor = rgbText(rgb);
    refs.rgb.textContent = rgbText(rgb);
    refs.history.textContent = dye.actions.map(action => {
      const count = Number(state.uses[dye.key][action.id]) || 0;
      return count ? action.short + ' ×' + count : '';
    }).filter(Boolean).join(' · ');
    for (const [id, button] of refs.buttons) {
      const action = dye.actions.find(a => a.id === id);
      const count = Number(state.uses[dye.key][id]) || 0;
      const countNode = button.querySelector('.dye-action-count');
      if (countNode) countNode.textContent = count ? String(count) : '';
      button.disabled = !action || !canApply(dye, action);
      button.setAttribute('aria-disabled', String(button.disabled));
    }
  }
  function renderMakeup() {
    tools.replaceChildren();
    dyeCardRefs.clear();
    const layout = el('div', 'custom-layout makeup-layout');
    const top = el('div', 'custom-section-intro');
    top.append(
      el('h2', 'custom-heading', 'Makeup'),
      el('p', 'custom-note', 'Each use shifts the current RGB colour of the player sheets. Use Reset to return to the original colour.')
    );
    tools.appendChild(top);
    for (const dye of DYES) {
      const card = el('section', 'dye-card');
      const header = el('div', 'dye-header');
      const titleBlock = el('div', 'dye-title-block');
      const title = el('h3', 'dye-title', dye.name);
      const description = el('p', 'dye-description', dye.description);
      titleBlock.append(title, description);
      const swatch = el('span', 'dye-current-swatch');
      swatch.setAttribute('aria-hidden', 'true');
      const reset = el('button', 'custom-reset', 'Reset');
      reset.type = 'button';
      reset.title = 'Reset ' + dye.name + ' to its default colour';
      reset.addEventListener('click', () => {
        state.dyes[dye.key] = [...dye.start];
        state.uses[dye.key] = {};
        save();
        updateDyeCard(dye.key);
      });
      header.append(titleBlock, swatch, reset);
      const rgb = el('div', 'dye-rgb');
      const rgbCaption = el('span', '', 'Current colour');
      const rgbValue = el('code', '', rgbText(state.dyes[dye.key]));
      rgb.append(rgbCaption, rgbValue);
      const actions = el('div', 'dye-actions');
      const buttons = new Map();
      for (const action of dye.actions) {
        const button = el('button', 'dye-action');
        button.type = 'button';
        button.title = action.label;
        button.setAttribute('aria-label', action.label);
        const dot = el('span', 'dye-action-dot');
        dot.style.backgroundColor = action.color;
        if (action.id === 'k') dot.classList.add('is-black');
        if (action.id === 'clean' || action.id === 'lensClean') dot.classList.add('is-cleanser');
        const label = el('span', 'dye-action-label', action.short);
        const uses = el('span', 'dye-action-count', '');
        button.append(dot, label, uses);
        button.addEventListener('click', () => {
          if (!canApply(dye, action)) return;
          state.dyes[dye.key] = changedRGB(state.dyes[dye.key], DYE_EFFECTS[action.id]);
          state.uses[dye.key][action.id] = (Number(state.uses[dye.key][action.id]) || 0) + 1;
          save();
          updateDyeCard(dye.key);
        });
        actions.appendChild(button);
        buttons.set(action.id, button);
      }
      const history = el('p', 'dye-history', '');
      card.append(header, rgb, actions, history);
      layout.appendChild(card);
      dyeCardRefs.set(dye.key, { swatch, rgb: rgbValue, history, buttons });
    }
    tools.appendChild(layout);
    for (const dye of DYES) updateDyeCard(dye.key);
  }

  /* ---------------- tab sync (donor) ---------------- */
  function syncTab(tabId) {
    const toolsActive = tabId === 'player' || tabId === 'makeup';
    tools.hidden = !toolsActive;
    grid.hidden = toolsActive || tabId === 'weather' || tabId === 'wrench';
    if (!toolsActive) return;
    if (tabId === 'player') renderPlayerCustomization();
    else renderMakeup();
  }
  P.on('tab', syncTab);

  applyDyes();
  syncTab(P.tabs.cur);
})();
