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
  composer.className = 'panel'; composer.hidden = true; composer.inert = true;
  composer.setAttribute('aria-label', 'Player Chat');
  const textarea = make('textarea', 'playerChat');
  textarea.name = 'playerChat'; textarea.maxLength = MAX_LENGTH; textarea.rows = 1;
  textarea.placeholder = 'Enter message here'; textarea.autocomplete = 'off'; textarea.spellcheck = false;
  textarea.setAttribute('aria-label', 'Player Chat');
  textarea.setAttribute('enterkeyhint', 'send');
  textarea.setAttribute('aria-description', 'Enter to speak. Shift+Enter for a new line.');
  composer.append(textarea);
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
    // The handle controls the available input height; long text scrolls inside it.
    textarea.style.height = '100%';
  }
  function positionBubble(area = visiblePreview()) {
    if (bubble.hidden || !anchor) return;
    const width = Math.max(80, Math.min(360, area.right - area.left - 20));
    bubble.style.maxWidth = width + 'px';
    // Text follows the same world-to-screen scale as the player. A fixed 16px
    // minimum made small phone avatars speak in oversized floating panels.
    const fontSize = Math.max(6, Math.min(48, (anchor.scale || 1) * 7));
    bubble.style.setProperty('--player-chat-font-size', fontSize + 'px');
    bubble.style.setProperty('--player-chat-pad-y', Math.max(2, fontSize * .22) + 'px');
    bubble.style.setProperty('--player-chat-pad-x', Math.max(4, fontSize * .36) + 'px');
    let rect = bubble.getBoundingClientRect(), right = area.right;
    const controls = actions.getBoundingClientRect();
    const proposedRight = Math.min(area.right - 8, anchor.x + rect.width / 2);
    // A long message in the short phone preview can reach the top row. Keep
    // its text beside the controls rather than drawing underneath the icons.
    if (anchor.y - rect.height / 2 < controls.bottom + 8 && proposedRight > controls.left - 8) {
      const besideControls = controls.left - area.left - 24;
      if (besideControls >= 80) {
        bubble.style.maxWidth = Math.min(width, besideControls) + 'px';
        rect = bubble.getBoundingClientRect(); right = controls.left - 8;
      }
    }
    const x = Math.min(right - rect.width / 2 - 8, Math.max(area.left + rect.width / 2 + 8, anchor.x));
    const y = Math.max(area.top + rect.height / 2 + 4,
      Math.min(area.bottom - rect.height / 2 - 4, anchor.y));
    bubble.style.left = x + 'px'; bubble.style.top = y + 'px';
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
    actions.style.left = area.right - actions.offsetWidth - gap + 'px';
    actions.style.top = area.top + gap + 'px';
    const source = inventoryHandle.getBoundingClientRect();
    const handleHeight = Math.max(1, source.height);
    const width = Math.max(120, area.right - area.left - gap * 2);
    topBar.style.left = area.left + gap + 'px';
    topBar.style.top = area.top + 2 + 'px';
    topBar.style.width = width + 'px';
    handle.style.width = source.width + 'px';
    const center = source.left + source.width / 2;
    handle.style.left = clamp(center - (area.left + gap) - source.width / 2, 0,
      Math.max(0, width - source.width)) + 'px';
    maxReveal = Math.max(0, area.bottom - area.top - handleHeight - gap - 2);
    const mode = document.getElementById('preview-mode-toggle')?.getBoundingClientRect();
    topBar.style.setProperty('--topbar-left-reserve', Math.max(8, mode ? mode.right - area.left + 4 : 8) + 'px');
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
    const defaultHeight = matchMedia('(max-width:900px), (hover:none) and (pointer:coarse)').matches ? 44 : 58;
    setReveal(Math.max(MIN_REVEAL, lastReveal || defaultHeight));
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
  textarea.addEventListener('input', () => { resizeInput(); position(); });
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
  P.on('camzoom', position);
  P.on('preview-mode', position);
  P.on('drawer', position);
  P.on('boot', position);
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  document.fonts?.ready.then(position);
  P.playerChat = { open, close, submit, clear, reposition: position, stateAt, durationMs: SPEECH_MS,
    get speech() { return stateAt(); },
    get isOpen() { return opened; }, get text() { return lastText; }, get draft() { return textarea.value; },
    get maxLength() { return MAX_LENGTH; }, get height() { return reveal; }, get maxHeight() { return maxReveal; } };
  position();
  nextPaint(position);
})();
