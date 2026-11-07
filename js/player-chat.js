/* Player Chat: local speech for the preview. The archived chatbar uses a real
   text field, a 120-character limit and an Enter/Say submit action. This keeps
   those input semantics while using the Demo's panel styling and chosen font. */
(function () {
  'use strict';
  const P = window.P;
  if (!P) return;
  const MAX_LENGTH = 120;
  const SPEECH_MS = 5000, FADE_IN_MS = 500, FADE_OUT_MS = 500;
  const preview = document.getElementById('pv');
  const make = (tag, id, text) => {
    const node = document.createElement(tag);
    if (id) node.id = id;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const actions = make('div', 'preview-actions');
  actions.setAttribute('aria-label', 'Preview controls');
  function iconButton(id, label, source) {
    const button = make('button', id);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
    const image = make('img');
    image.src = source;
    image.alt = ''; image.draggable = false;
    button.append(image);
    actions.append(button);
    return button;
  }
  const menuButton = iconButton('preview-menu-button', 'Menu', 'img/menu-button.png');
  const chatButton = iconButton('player-chat-button', 'Player Chat', 'img/chat-button.png');
  menuButton.setAttribute('aria-disabled', 'true'); // Reserved; no menu action yet.
  chatButton.setAttribute('aria-controls', 'player-chat-composer');
  chatButton.setAttribute('aria-expanded', 'false');

  const topBar = make('section', 'topBar');
  topBar.setAttribute('aria-label', 'Chat top bar');
  const composer = make('form', 'player-chat-composer');
  composer.hidden = true; composer.inert = true;
  composer.setAttribute('aria-label', 'Player Chat');
  const chatLog = make('div', 'player-chat-log');
  chatLog.className = 'player-chat-log panel';
  chatLog.setAttribute('role', 'log');
  chatLog.setAttribute('aria-live', 'polite');
  chatLog.setAttribute('aria-relevant', 'additions');
  chatLog.setAttribute('aria-label', 'Chat history');
  const inputRow = make('div', 'player-chat-input-row');
  inputRow.className = 'player-chat-input-row panel';
  const textarea = make('textarea', 'playerChat');
  textarea.name = 'playerChat'; textarea.maxLength = MAX_LENGTH * 2; textarea.rows = 1;
  textarea.placeholder = ''; textarea.autocomplete = 'off'; textarea.spellcheck = false;
  textarea.setAttribute('aria-label', 'Player Chat message');
  textarea.setAttribute('enterkeyhint', 'send');
  textarea.setAttribute('aria-description', '120 character maximum. Press Enter to send.');
  const inputHint = make('span', 'player-chat-placeholder', P.rtfont?.color('7', 'Enter a message here') || 'Enter a message here');
  inputHint.setAttribute('aria-hidden', 'true');
  const inputText = make('span', 'player-chat-input-text');
  inputText.setAttribute('aria-hidden', 'true');
  inputText.hidden = true;
  const counter = make('span', 'player-chat-counter', '0/120');
  counter.setAttribute('aria-live', 'off');
  inputRow.append(textarea, inputHint, inputText, counter);
  chatLog.dataset.empty = 'true';
  composer.append(chatLog, inputRow);
  P.rtfont?.scan(inputHint);
  // Use the inventory's actual desktop/mobile artwork and frame variants.
  const inventoryHandle = document.getElementById('handle');
  const handle = inventoryHandle.cloneNode(true);
  handle.id = 'topBar-handle'; handle.classList.remove('drag', 'up', 'dn');
  handle.setAttribute('aria-label', 'Drag chat top bar down or up');
  handle.setAttribute('aria-controls', 'player-chat-composer');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-valuemin', '0');
  topBar.append(composer, handle);

  const bubble = make('div', 'player-chat-bubble'); bubble.className = 'panel'; bubble.hidden = true;
  bubble.setAttribute('role', 'status'); bubble.setAttribute('aria-live', 'polite');
  bubble.setAttribute('aria-atomic', 'true');
  const speech = make('span', 'player-chat-text'); bubble.append(speech);
  document.body.append(actions, topBar, bubble);

  let anchor = null, lastText = '', hideTimer = null, fadeTimer = null, opened = false;
  let speechState = null, speechVersion = 0;
  let reveal = 0, maxReveal = 0, drag = null;
  let lastReveal = Number(P.store.get('topBarHeight', 0)) || 0;
  let worldRole = ['owner', 'admin'].includes(P.store.get('playerChatWorldRole', ''))
    ? P.store.get('playerChatWorldRole', '') : '';
  const MAX_LOG_MESSAGES = 50;
  const EST_OFFSET_MS = 5 * 60 * 60 * 1000;
  // Growtopia chat lanes: the signal identifies the source of each message.
  const CHAT_LANES = Object.freeze({
    world: Object.freeze({ signal: 'W', color: '6', includePlayerName: true }),
    server: Object.freeze({ signal: 'S', color: 'w', includePlayerName: false }),
    broadcast: Object.freeze({ signal: 'B', color: '#', includePlayerName: false })
  });
  const MIN_REVEAL = 40;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const now = () => window.performance?.now() ?? Date.now();
  function stateAt(atMs = now()) {
    if (!speechState) return { active: false, elapsedMs: 0, durationMs: SPEECH_MS, phase: 'hidden', text: '' };
    const elapsedMs = Math.max(0, atMs - speechState.startedAtMs);
    const active = elapsedMs < speechState.durationMs;
    return { ...speechState, active, elapsedMs: Math.min(elapsedMs, speechState.durationMs),
      phase: !active ? 'hidden' : elapsedMs < FADE_IN_MS ? 'entering'
        : elapsedMs >= speechState.durationMs - FADE_OUT_MS ? 'leaving' : 'visible' };
  }
  const nextPaint = callback => (window.requestAnimationFrame ?? (fn => window.setTimeout(fn, 0)))(callback);
  function formatESTTimestamp(atMs = Date.now()) {
    const est = new Date(Number(atMs) - EST_OFFSET_MS);
    const pad = value => String(value).padStart(2, '0');
    const time = [pad(est.getUTCHours()), pad(est.getUTCMinutes()), pad(est.getUTCSeconds())].join(':');
    return P.rtfont?.color('w', '[' + time + ']') || '[' + time + ']';
  }
  function formatPlayerName() {
    const profile = P.plateConfig?.get?.() ?? {};
    const rawGrowId = P.rtfont?.sanitizeGrowId
      ? P.rtfont.sanitizeGrowId(String(profile.growId ?? ''), 19)
      : String(profile.growId ?? '');
    const titles = new Set(Array.isArray(profile.titles) ? profile.titles : []);
    const isDoctor = titles.has('dr');
    const isLegend = titles.has('legend');
    let name = (isDoctor ? 'Dr. ' : '') + (P.rtfont?.strip(rawGrowId) ?? rawGrowId);
    if (isLegend) name += ' of Legend';

    // World ranks take precedence, then name titles; otherwise preserve custom GrowID colors.
    const forcedCode = worldRole === 'owner' ? '2'
      : worldRole === 'admin' ? '^'
      : isDoctor ? '4'
      : isLegend ? '9' : '';
    if (forcedCode) return P.rtfont?.color(forcedCode, name) ?? name;
    if (P.rtfont?.hasCodes(rawGrowId)) return rawGrowId;
    return P.rtfont?.color('w', name) ?? name;
  }
  function appendChatLogMessage(message, atMs = Date.now(), laneOptions = {}) {
    // Supports an options object as the second argument or a timestamp plus options.
    if (atMs && typeof atMs === 'object') {
      laneOptions = atMs;
      atMs = laneOptions.atMs ?? Date.now();
    }
    const options = laneOptions && typeof laneOptions === 'object' ? laneOptions : {};
    const requested = String(options.type ?? options.lane ?? options.kind ?? 'world').toLowerCase();
    const aliases = { bc: 'broadcast', sb: 'broadcast', cb: 'broadcast',
      'super-broadcast': 'broadcast', 'custom-broadcast': 'broadcast' };
    const laneType = aliases[requested] ?? (CHAT_LANES[requested] ? requested : 'world');
    const lane = CHAT_LANES[laneType];
    const signalText = String(options.signal ?? lane.signal);
    const signalColor = String(options.signalColor ?? lane.color);
    const text = String(message ?? '');
    const row = make('div');
    row.className = 'player-chat-entry player-chat-entry--' + laneType;
    row.dataset.lane = laneType;
    row.dataset.signal = signalText;

    const signal = make('span');
    signal.className = 'player-chat-signal';
    signal.textContent = P.rtfont?.color(signalColor, '[' + signalText + ']') || '[' + signalText + ']';
    const time = make('span');
    time.className = 'player-chat-time';
    time.textContent = formatESTTimestamp(atMs) + ' ';
    row.append(signal, document.createTextNode(' '), time);

    const includeName = options.showName ?? (options.playerName != null || lane.includePlayerName);
    if (includeName) {
      const openBracket = make('span');
      openBracket.className = 'player-chat-name-bracket';
      openBracket.textContent = P.rtfont?.color(String(options.nameBracketColor ?? '6'), '<') || '<';
      const name = make('span');
      name.className = 'player-chat-name';
      name.textContent = options.playerName != null ? String(options.playerName) : formatPlayerName();
      const closeBracket = make('span');
      closeBracket.className = 'player-chat-name-bracket';
      closeBracket.textContent = P.rtfont?.color(String(options.nameBracketColor ?? '6'), '>') || '>';
      row.append(openBracket, name, closeBracket, document.createTextNode(' '));
    }

    const body = make('span');
    body.className = 'player-chat-message';
    const messageColor = String(options.messageColor ?? '$');
    body.textContent = P.rtfont?.color(messageColor, text) || text;
    row.append(body);
    chatLog.append(row);
    P.rtfont?.scan(row);
    while (chatLog.children.length > MAX_LOG_MESSAGES) chatLog.firstElementChild.remove();
    chatLog.dataset.empty = chatLog.children.length ? 'false' : 'true';
    chatLog.scrollTop = chatLog.scrollHeight;
    return row;
  }
  function updateInputCounter() {
    const characters = Array.from(textarea.value);
    if (characters.length > MAX_LENGTH) {
      const cursor = Array.from(textarea.value.slice(0, textarea.selectionStart ?? textarea.value.length)).length;
      textarea.value = characters.slice(0, MAX_LENGTH).join('');
      const nextCursor = characters.slice(0, Math.min(cursor, MAX_LENGTH)).join('').length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    }
    const length = Array.from(textarea.value).length;
    counter.textContent = length + '/' + MAX_LENGTH;
    inputHint.hidden = length > 0;
    inputText.textContent = textarea.value;
    inputText.hidden = length === 0;
    if (length) P.rtfont?.scan(inputText);
  }
  function visiblePreview() {
    const vv = window.visualViewport;
    const left = vv?.offsetLeft ?? 0, top = vv?.offsetTop ?? 0;
    const right = left + (vv?.width ?? window.innerWidth);
    const bottom = top + (vv?.height ?? window.innerHeight);
    const rect = preview?.getBoundingClientRect();
    const area = rect ? { left: Math.max(left, rect.left), top: Math.max(top, rect.top),
      right: Math.min(right, rect.right), bottom: Math.min(bottom, rect.bottom) } : { left, top, right, bottom };
    // The keyboard may temporarily move the entire preview out of view.
    if (area.right <= area.left || area.bottom <= area.top) return { left, top, right, bottom };
    return area;
  }
  function resizeInput() {
    // The handle controls the chat-log height; the compact input row stays fixed.
    textarea.style.height = '100%';
    updateInputCounter();
  }
  function positionBubble(area = visiblePreview()) {
    if (bubble.hidden || !anchor) return;

    // Keep the font in screen pixels; the bubble grows with the message content.
    const maxWidth = Math.max(80, Math.min(460, area.right - area.left - 24));
    bubble.style.maxWidth = maxWidth + 'px';
    const fontSize = 13;
    bubble.style.setProperty('--player-chat-font-size', fontSize + 'px');
    bubble.style.setProperty('--player-chat-pad-y', '4px');
    bubble.style.setProperty('--player-chat-pad-x', '8px');

    const rect = bubble.getBoundingClientRect();
    // Center on the player's nameplate anchor, only clamping at viewport edges.
    const x = clamp(anchor.x, area.left + rect.width / 2 + 8,
      area.right - rect.width / 2 - 8);
    const y = clamp(anchor.y - 18, area.top + rect.height / 2 + 4,
      area.bottom - rect.height / 2 - 4);
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
  }
  function layoutPreview() {
    const rect = preview.getBoundingClientRect();
    return { left: Math.max(0, rect.left), right: Math.min(innerWidth, rect.right),
      top: Math.max(0, rect.top), bottom: Math.min(innerHeight, rect.bottom) };
  }
  function syncInputState() {
    opened = reveal >= MIN_REVEAL;
    composer.hidden = reveal <= 0;
    composer.inert = !opened;
    chatButton.setAttribute('aria-expanded', String(opened));
    chatButton.querySelector('img').src = opened ? 'img/chat-button-typing.png' : 'img/chat-button.png';
    handle.setAttribute('aria-valuenow', String(Math.round(reveal)));
    handle.setAttribute('aria-valuemax', String(Math.round(maxReveal)));
    handle.setAttribute('aria-valuetext', opened ? 'Chat open' : 'Chat closed');
    topBar.style.setProperty('--topbar-height', reveal + 'px');
    topBar.classList.toggle('is-open', opened);
  }
  function setReveal(value) {
    reveal = clamp(value, 0, maxReveal);
    syncInputState();
  }
  function position() {
    const area = layoutPreview(), gap = 8;
    // Icons and topBar belong to the preview, not the keyboard's visual viewport.
    const compactActions = matchMedia('(max-width:900px), (hover:none) and (pointer:coarse)').matches;
    const actionWidth = actions.offsetWidth || (compactActions ? 40 : 44);
    actions.style.left = area.right - actionWidth - gap + 'px';
    actions.style.top = area.top + gap + 'px';
    const source = inventoryHandle.getBoundingClientRect();
    const handleWidth = Math.max(1, source.width * 0.9);
    const handleHeight = Math.max(1, source.height * 0.9);
    const previewWidth = Math.max(0, area.right - area.left);
    const width = previewWidth * 0.75;
    const left = area.left + (previewWidth - width) / 2;
    topBar.style.left = left + 'px';
    topBar.style.top = area.top + 'px';
    topBar.style.width = width + 'px';
    handle.style.width = handleWidth + 'px';
    handle.style.height = handleHeight + 'px';
    handle.style.left = Math.max(0, (width - handleWidth) / 2) + 'px';
    maxReveal = Math.max(0, area.bottom - area.top - handleHeight);
    const mode = document.getElementById('preview-mode-toggle')?.getBoundingClientRect();
    topBar.style.setProperty('--topbar-left-reserve', Math.max(8, mode ? mode.right - left + 4 : 8) + 'px');
    topBar.style.setProperty('--topbar-right-reserve', actions.offsetWidth + 8 + 'px');
    setReveal(reveal);
    positionBubble();
  }
  function rememberHeight() {
    if (reveal >= MIN_REVEAL) {
      lastReveal = reveal;
      P.store.set('topBarHeight', Math.round(reveal));
    }
  }
  function close({ restoreFocus = false } = {}) {
    rememberHeight();setReveal(0);textarea.blur();
    if (restoreFocus) chatButton.focus({ preventScroll: true });
    P.emit('player-chat-close');
  }
  function focusInput() {
    // Keep native keyboard focus synchronous with the button/handle gesture.
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
  function open() {
    position();
    const defaultHeight = matchMedia('(max-width:900px), (hover:none) and (pointer:coarse)').matches ? 132 : 160;
    setReveal(Math.min(maxReveal, Math.max(MIN_REVEAL, lastReveal || defaultHeight)));
    resizeInput();P.emit('player-chat-open');focusInput();
  }
  handle.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    drag = { id:event.pointerId, y:event.clientY, start:reveal, last:event.clientY, moved:false };
    handle.classList.add('drag');
    P.emit('input-reset');
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    const delta = event.clientY - drag.y;
    drag.moved ||= Math.abs(delta) > 4;
    // The duplicated images are vertically flipped, including their arrows.
    handle.classList.toggle('up', event.clientY > drag.last);
    handle.classList.toggle('dn', event.clientY < drag.last);
    drag.last = event.clientY;
    setReveal(drag.start + delta);
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;drag = null;
    handle.classList.remove('drag', 'up', 'dn');
    if (!moved && event.type === 'pointerup') { opened ? close() : open();return; }
    if (reveal < MIN_REVEAL / 2) close();
    else {
      setReveal(Math.max(MIN_REVEAL, reveal));rememberHeight();
      P.emit('player-chat-open');
      if (event.type === 'pointerup') focusInput();
    }
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) handle.addEventListener(event, finishDrag);
  handle.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();close();return;}
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();event.stopPropagation();opened ? close() : open();return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();event.stopPropagation();
      const next = reveal + (event.key === 'ArrowDown' ? 30 : -30);
      if (next < MIN_REVEAL / 2) close();
      else {setReveal(Math.max(MIN_REVEAL,next));rememberHeight();P.emit('player-chat-open');}
    }
  });
  function clear() {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    if (fadeTimer !== null) window.clearTimeout(fadeTimer);
    hideTimer = fadeTimer = null; speechVersion++;
    bubble.classList.remove('is-visible');bubble.hidden = true;
    speech.replaceChildren(); lastText = ''; speechState = null;
    P.emit('player-chat-end');
  }
  function submit(value = textarea.value) {
    const text = [...String(value ?? '').replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')].slice(0, MAX_LENGTH).join('').trim();
    if (!(P.rtfont?.strip(text) ?? text).trim()) return false;
    if (/^\/dance\s*$/i.test(P.rtfont?.strip(text) ?? text)) {
      clear();textarea.value = '';resizeInput();close();
      P.emit('player-command', { command: 'dance', atMs: now() });
      return true;
    }
    const messageAtMs = Date.now();
    appendChatLogMessage(text, messageAtMs, { type: 'world', messageColor: '$' });
    clear(); lastText = text; speech.textContent = text;
    P.rtfont?.scan(speech);
    bubble.hidden = false;
    const startedAtMs = now(), durationMs = SPEECH_MS;
    speechState = { startedAtMs, durationMs, text };
    const version = speechVersion;
    // A layout read establishes opacity0 before the next paint begins fading.
    bubble.getBoundingClientRect();
    nextPaint(() => { if (version === speechVersion && !bubble.hidden) bubble.classList.add('is-visible'); });
    if (!anchor) {
      const area = visiblePreview(); anchor = { x: (area.left + area.right) / 2, y: area.top + (area.bottom - area.top) * .45, scale: 1 };
    }
    textarea.value = ''; resizeInput(); close(); position();
    fadeTimer = window.setTimeout(() => {
      if (version === speechVersion) bubble.classList.remove('is-visible');
    }, Math.max(0, durationMs - FADE_OUT_MS));
    hideTimer = window.setTimeout(() => { if (version === speechVersion) clear(); }, durationMs);
    P.emit('player-chat', { text, atMs: startedAtMs, durationMs });
    return true;
  }
  chatButton.addEventListener('click', () => opened ? close() : open());
  composer.addEventListener('submit', event => { event.preventDefault(); submit(); });
  textarea.addEventListener('input', () => { resizeInput(); updateInputCounter(); position(); });
  textarea.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); close({ restoreFocus: true }); }
    else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
  });
  // Chat controls must not become punches, wheel zooms or pinch gestures.
  for (const node of [actions, topBar]) for (const event of ['pointerdown', 'pointermove', 'pointerup', 'wheel'])
    node.addEventListener(event, e => e.stopPropagation());
  P.on('player-chat-anchor', point => {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) { anchor = { ...point }; positionBubble(); }
  });
  P.on('preview', position);
  P.on('preview-mode', mode => {
    position();
    if (!mode?.live) {
      close();
      clear();
    }
    // preview-mode listeners toggle .live-preview, which changes display:none
    // on the action stack. Re-measure after every listener has applied the class.
    nextPaint(position);
  });
  P.on('drawer', position);
  P.on('boot', position);
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  document.fonts?.ready.then(position);
  P.playerChat = {
    open, close, submit, clear, reposition: position, stateAt, durationMs: SPEECH_MS,
    formatESTTimestamp, formatPlayerName, appendChatLogMessage, chatLanes: CHAT_LANES,
    getWorldRole: () => worldRole,
    setWorldRole(role) {
      worldRole = ['owner', 'admin'].includes(role) ? role : '';
      P.store.set('playerChatWorldRole', worldRole);
      return worldRole;
    },
    get speech() { return stateAt(); },
    get isOpen() { return opened; }, get text() { return lastText; }, get draft() { return textarea.value; },
    get maxLength() { return MAX_LENGTH; }, get height() { return reveal; }, get maxHeight() { return maxReveal; },
    get logCount() { return chatLog.children.length; }
  };
  updateInputCounter();
  position();
  nextPaint(position);
})();
