/* Player Chat: local speech for the preview. The archived chatbar uses a real
   text field, a 120-character limit and an Enter/Say submit action. This keeps
   those input semantics while using the Demo's panel styling and chosen font. */
(function () {
  'use strict';
  const P = window.P;
  if (!P) return;
  const MAX_LENGTH = 120;
  const WORD_MS = 900, FADE_IN_MS = 160, FADE_OUT_MS = 220;
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
    image.src = source; image.alt = ''; image.draggable = false;
    button.append(image);
    actions.append(button);
    return button;
  }
  const menuButton = iconButton('preview-menu-button', 'Menu', 'img/menu-button.png');
  const chatButton = iconButton('player-chat-button', 'Player Chat', 'img/chat-button.png');
  menuButton.setAttribute('aria-disabled', 'true'); // Reserved; no menu action yet.
  chatButton.setAttribute('aria-controls', 'player-chat-composer');
  chatButton.setAttribute('aria-expanded', 'false');

  const composer = make('form', 'player-chat-composer');
  composer.className = 'panel'; composer.hidden = true;
  composer.setAttribute('aria-label', 'Player Chat');
  const header = make('div'); header.className = 'player-chat-header';
  const label = make('label', 'player-chat-label', 'Player Chat');
  label.htmlFor = 'playerChat';
  const cancel = make('button', 'player-chat-close', 'Close');
  cancel.type = 'button'; cancel.setAttribute('aria-label', 'Close Player Chat');
  header.append(label, cancel);
  const textarea = make('textarea', 'playerChat');
  textarea.name = 'playerChat'; textarea.maxLength = MAX_LENGTH; textarea.rows = 1;
  textarea.placeholder = 'Say something…'; textarea.autocomplete = 'off'; textarea.spellcheck = false;
  textarea.setAttribute('enterkeyhint', 'send'); textarea.setAttribute('aria-describedby', 'player-chat-help');
  const footer = make('div'); footer.className = 'player-chat-footer';
  const help = make('span', 'player-chat-help', 'Enter to speak · Shift+Enter for a new line');
  const count = make('span', 'player-chat-count', '0 / ' + MAX_LENGTH);
  count.setAttribute('aria-hidden', 'true');
  const say = make('button', 'player-chat-send', 'Say'); say.type = 'submit';
  footer.append(help, count, say); composer.append(header, textarea, footer);

  const bubble = make('div', 'player-chat-bubble'); bubble.className = 'panel'; bubble.hidden = true;
  bubble.setAttribute('role', 'status'); bubble.setAttribute('aria-live', 'polite');
  bubble.setAttribute('aria-atomic', 'true');
  const speech = make('span', 'player-chat-text'); bubble.append(speech);
  document.body.append(actions, composer, bubble);

  let anchor = null, lastText = '', hideTimer = null, fadeTimer = null, composerTimer = null, opened = false;
  let speechState = null, speechVersion = 0, composerVersion = 0;
  const now = () => window.performance?.now() ?? Date.now();
  function visibleWords(value) {
    const text = (P.rtfont?.strip(String(value ?? '')) ?? String(value ?? '')).trim();
    // Count spoken words rather than color codes or punctuation. Segmenter
    // also recognizes words in languages that do not separate them by spaces.
    if (typeof Intl.Segmenter === 'function') {
      const words = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)]
        .filter(segment => segment.isWordLike).length;
      if (words) return words;
    }
    return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|\p{Extended_Pictographic}/gu) ?? []).length;
  }
  function durationFor(value) { return Math.max(1, visibleWords(value)) * WORD_MS; }
  function stateAt(atMs = now()) {
    if (!speechState) return { active: false, elapsedMs: 0, durationMs: 0, wordCount: 0, phase: 'hidden', text: '' };
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
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(140, Math.max(28, textarea.scrollHeight)) + 'px';
    count.textContent = [...textarea.value].length + ' / ' + MAX_LENGTH;
  }
  function positionBubble(area = visiblePreview()) {
    if (bubble.hidden || !anchor) return;
    const width = Math.max(80, Math.min(360, area.right - area.left - 20));
    bubble.style.maxWidth = width + 'px';
    const fontSize = Math.max(16, Math.min(24, (anchor.scale || 1) * 7));
    bubble.style.setProperty('--player-chat-font-size', fontSize + 'px');
    let rect = bubble.getBoundingClientRect(), right = area.right;
    const controls = actions.getBoundingClientRect();
    const proposedRight = Math.min(area.right - 8, anchor.x + rect.width / 2);
    // A long message in the short phone preview can reach the top row. Keep
    // its text beside the controls rather than drawing underneath the icons.
    if (anchor.y - 8 - rect.height < controls.bottom + 8 && proposedRight > controls.left - 8) {
      const besideControls = controls.left - area.left - 24;
      if (besideControls >= 80) {
        bubble.style.maxWidth = Math.min(width, besideControls) + 'px';
        rect = bubble.getBoundingClientRect(); right = controls.left - 8;
      }
    }
    const x = Math.min(right - rect.width / 2 - 8, Math.max(area.left + rect.width / 2 + 8, anchor.x));
    const y = Math.max(area.top + rect.height + 8, Math.min(area.bottom - 8, anchor.y - 8));
    bubble.style.left = x + 'px'; bubble.style.top = y + 'px';
  }
  function position() {
    const area = visiblePreview(), gap = 8;
    actions.style.left = Math.max(area.left + gap, area.right - actions.offsetWidth - gap) + 'px';
    actions.style.top = area.top + gap + 'px';
    if (opened) {
      composer.style.width = Math.max(120, Math.min(440, area.right - area.left - gap * 2)) + 'px';
      composer.style.left = Math.max(area.left + gap, area.right - composer.offsetWidth - gap) + 'px';
      const preferredTop = area.top + actions.offsetHeight + gap * 2;
      composer.style.top = Math.max(area.top + gap,
        Math.min(preferredTop, area.bottom - composer.offsetHeight - gap)) + 'px';
    }
    positionBubble(area);
  }
  function close({ restoreFocus = false } = {}) {
    opened = false; composer.classList.remove('is-visible');
    composer.inert = true;
    const version = ++composerVersion;
    if (composerTimer !== null) window.clearTimeout(composerTimer);
    composerTimer = window.setTimeout(() => {
      if (version === composerVersion && !opened) composer.hidden = true;
      composerTimer = null;
    }, FADE_OUT_MS);
    chatButton.setAttribute('aria-expanded', 'false');
    textarea.blur();
    if (restoreFocus) chatButton.focus({ preventScroll: true });
    P.emit('player-chat-close');
  }
  function open() {
    opened = true; composer.hidden = false; composer.inert = false;
    if (composerTimer !== null) window.clearTimeout(composerTimer);
    composerTimer = null;
    const version = ++composerVersion;
    nextPaint(() => { if (opened && version === composerVersion) composer.classList.add('is-visible'); });
    chatButton.setAttribute('aria-expanded', 'true');
    resizeInput(); position();
    P.emit('player-chat-open');
    // Focus stays synchronous with the button's click so iOS/Android can open
    // the native keyboard. No timer, promise or animation delays this call.
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
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
    const startedAtMs = now(), durationMs = durationFor(text), wordCount = Math.max(1, visibleWords(text));
    speechState = { startedAtMs, durationMs, wordCount, text };
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
    P.emit('player-chat', { text, atMs: startedAtMs, durationMs, wordCount });
    return true;
  }
  chatButton.addEventListener('click', () => opened ? close() : open());
  cancel.addEventListener('click', () => close({ restoreFocus: true }));
  composer.addEventListener('submit', event => { event.preventDefault(); submit(); });
  textarea.addEventListener('input', () => { resizeInput(); position(); });
  textarea.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); close({ restoreFocus: true }); }
    else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
  });
  // Chat controls must not become punches, wheel zooms or pinch gestures.
  for (const node of [actions, composer]) for (const event of ['pointerdown', 'pointermove', 'pointerup', 'wheel'])
    node.addEventListener(event, e => e.stopPropagation());
  P.on('player-chat-anchor', point => {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) { anchor = { ...point }; positionBubble(); }
  });
  P.on('preview', position);
  P.on('camzoom', position);
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  document.fonts?.ready.then(position);
  P.playerChat = { open, close, submit, clear, reposition: position, stateAt, durationFor,
    get speech() { return stateAt(); },
    get isOpen() { return opened; }, get text() { return lastText; }, get draft() { return textarea.value; },
    get maxLength() { return MAX_LENGTH; } };
  position();
})();
