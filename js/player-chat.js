/* Player Chat: local speech for the preview. The archived chatbar uses a real
   text field, a 120-character limit and an Enter/Say submit action. This keeps
   those input semantics while using the Demo's panel styling and chosen font. */
(function () {
  'use strict';
  const P = window.P;
  if (!P) return;
  const MAX_LENGTH = 120;
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
  const chatButton = iconButton('player-chat-button', 'Player Chat', 'img/chat-button.png');
  const menuButton = iconButton('preview-menu-button', 'Menu', 'img/menu-button.png');
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

  let anchor = null, lastText = '', hideTimer = null, opened = false;
  const now = () => window.performance?.now() ?? Date.now();
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
    textarea.style.height = Math.min(160, Math.max(32, textarea.scrollHeight)) + 'px';
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
    opened = false; composer.hidden = true;
    chatButton.setAttribute('aria-expanded', 'false');
    textarea.blur();
    if (restoreFocus) chatButton.focus({ preventScroll: true });
    P.emit('player-chat-close');
  }
  function open() {
    opened = true; composer.hidden = false; chatButton.setAttribute('aria-expanded', 'true');
    resizeInput(); position();
    P.emit('player-chat-open');
    // Focus stays synchronous with the button's click so iOS/Android can open
    // the native keyboard. No timer, promise or animation delays this call.
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
  function clear() {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = null; bubble.hidden = true; speech.replaceChildren(); lastText = '';
  }
  function submit(value = textarea.value) {
    const text = [...String(value ?? '').replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')].slice(0, MAX_LENGTH).join('').trim();
    if (!(P.rtfont?.strip(text) ?? text).trim()) return false;
    clear(); lastText = text; speech.textContent = text;
    P.rtfont?.scan(speech);
    bubble.hidden = false;
    if (!anchor) {
      const area = visiblePreview(); anchor = { x: (area.left + area.right) / 2, y: area.top + (area.bottom - area.top) * .45, scale: 1 };
    }
    textarea.value = ''; resizeInput(); close(); position();
    hideTimer = window.setTimeout(clear, Math.min(12000, 5000 + [...text].length * 45));
    P.emit('player-chat', { text, atMs: now() });
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
  P.playerChat = { open, close, submit, clear, reposition: position,
    get isOpen() { return opened; }, get text() { return lastText; }, get draft() { return textarea.value; },
    get maxLength() { return MAX_LENGTH; } };
  position();
})();
