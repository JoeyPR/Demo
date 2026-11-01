/* World controls use the existing dropdown shell; the world runtime owns all
   simulation, tools and selected block state. */
(function () {
  'use strict';
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = make('button', 'dd-btn');
  button.id = 'dd-world-btn'; button.type = 'button'; button.dataset.dd = 'world';
  button.setAttribute('aria-controls', 'dd-world-panel');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'World controls');
  const label = make('span', '', 'World');
  const caret = make('span', 'dd-caret', '▲');
  button.append(label, caret);

  const panel = make('section', 'dd-panel');
  panel.id = 'dd-world-panel'; panel.dataset.dd = 'world';
  panel.setAttribute('aria-label', 'World controls');
  const header = make('div', 'dd-head'); header.append(make('strong', '', 'World'));
  const body = make('div', 'dd-body world-controls');
  const activeLabel = make('label', 'world-toggle');
  const active = make('input'); active.type = 'checkbox'; active.id = 'world-active';
  activeLabel.append(active, document.createTextNode(' Explore World'));

  const toolLabel = make('label', 'world-label', 'Tool'); toolLabel.htmlFor = 'world-tool';
  const tool = make('select', 'world-select'); tool.id = 'world-tool';
  for (const [value, text] of [['play', 'Play'], ['place', 'Place'], ['erase', 'Erase']]) {
    const option = make('option', '', text); option.value = value; tool.append(option);
  }
  const searchLabel = make('label', 'world-label', 'Find a block'); searchLabel.htmlFor = 'world-block-search';
  const search = make('input', 'world-search'); search.id = 'world-block-search';
  search.type = 'search'; search.placeholder = 'Search blocks and backgrounds';
  search.autocomplete = 'off'; search.spellcheck = false;
  const blockLabel = make('label', 'world-label', 'Block or background'); blockLabel.htmlFor = 'world-block';
  const blocks = make('select', 'world-select'); blocks.id = 'world-block';
  const count = make('p', 'world-count'); count.setAttribute('aria-live', 'polite');
  const actions = make('div', 'world-actions');
  const newWorld = make('button', 'world-action', 'New world'); newWorld.type = 'button';newWorld.id = 'world-new';
  const respawn = make('button', 'world-action', 'Respawn');respawn.type = 'button';respawn.id = 'world-respawn';
  actions.append(newWorld, respawn);
  const help = make('p', 'world-help', 'Use the arrows or pads to move and jump. Choose a block to place, then tap the world. Erase removes from the selected block’s layer.');
  body.append(activeLabel, toolLabel, tool, searchLabel, search, blockLabel, blocks, count, actions, help);
  panel.append(header, body);document.body.append(button, panel);

  function renderOptions() {
    const api = P.world, query = search.value.trim().toLowerCase();
    const catalog = api?.blocks ?? [];
    const visible = catalog.filter(block => !query || block.name.toLowerCase().includes(query) || String(block.id) === query);
    const fragment = document.createDocumentFragment();
    if (!visible.length) {
      const empty = make('option', '', catalog.length ? 'No matching blocks' : 'Loading world blocks…');
      empty.value = '';fragment.append(empty);
    }
    for (const block of visible) {
      const option = make('option', '', (block.layer === 'bg' ? '[Background] ' : '') + block.name);
      option.value = String(block.id);fragment.append(option);
    }
    blocks.replaceChildren(fragment);
    blocks.value = String(api?.selectedId ?? '');
    count.textContent = `${visible.length.toLocaleString()} of ${catalog.length.toLocaleString()} blocks and backgrounds`;
    blocks.disabled = !api?.active || visible.length === 0;
  }
  function sync() {
    const api = P.world;
    button.disabled = !api;
    active.checked = !!api?.active;active.disabled = !api;
    tool.value = api?.tool ?? 'play';tool.disabled = !api?.active;
    search.disabled = !api?.active;newWorld.disabled = !api?.active;respawn.disabled = !api?.active;
    label.textContent = api?.active ? 'World · ' + ({play:'Play',place:'Place',erase:'Erase'}[api.tool] ?? 'Play') : 'World';
    renderOptions();
  }
  function close() {
    panel.classList.remove('open');button.setAttribute('aria-expanded', 'false');caret.textContent = '▲';
  }
  button.addEventListener('click', () => {
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);button.setAttribute('aria-expanded', String(open));caret.textContent = open ? '▼' : '▲';
    if (open) {P.emit('input-reset');sync();}
  });
  active.addEventListener('change', () => P.world?.setActive(active.checked));
  tool.addEventListener('change', () => P.world?.setTool(tool.value));
  search.addEventListener('input', renderOptions);
  blocks.addEventListener('change', () => {
    if (!blocks.value) return;
    P.world?.select(Number(blocks.value));P.world?.setTool('place');
  });
  newWorld.addEventListener('click', () => P.world?.newWorld());
  respawn.addEventListener('click', () => P.world?.respawn());
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close();button.focus({preventScroll:true}); }
    event.stopPropagation();
  });
  document.addEventListener('click', event => {
    if (!panel.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  P.on('world-update', sync);P.on('boot', sync);sync();
})();
