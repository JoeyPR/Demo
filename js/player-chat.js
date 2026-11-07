/* Player speech bubble + preview menu control. TopBar UI intentionally removed. */
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

  // Keep the independent Preview Menu control. The Player Chat launcher belongs
  // to the removed TopBar and is intentionally not created.
  const actions = make('div', 'preview-actions');
  actions.setAttribute('aria-label', 'Preview controls');
  const menuButton = make('button', 'preview-menu-button');
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'Menu');
  menuButton.title = 'Menu';
  menuButton.setAttribute('aria-disabled', 'true');
  const menuImage = make('img');
  menuImage.src = 'img/menu-button.png';
  menuImage.alt = '';
  menuImage.draggable = false;
  menuButton.append(menuImage);
  actions.append(menuButton);

  // Chat launcher is independent of the removed TopBar. It sends the entered
  // message through the existing player speech bubble without creating a bar.
  const chatButton = make('button', 'player-chat-button');
  chatButton.type = 'button';
  chatButton.setAttribute('aria-label', 'Player Chat');
  chatButton.title = 'Player Chat';
  const chatImage = make('img');
  chatImage.src = 'img/chat-button.png';
  chatImage.alt = '';
  chatImage.draggable = false;
  chatButton.append(chatImage);
  actions.append(chatButton);

  // Player speech is separate from the TopBar and remains available to the demo.
  const bubble = make('div', 'player-chat-bubble');
  bubble.className = 'panel';
  bubble.hidden = true;
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  bubble.setAttribute('aria-atomic', 'true');
  const speech = make('span', 'player-chat-text');
  bubble.append(speech);
  document.body.append(actions, bubble);

  let anchor = null, lastText = '', hideTimer = null, fadeTimer = null;
  let speechState = null, speechVersion = 0;
  let worldRole = ['owner', 'admin'].includes(P.store.get('playerChatWorldRole', ''))
    ? P.store.get('playerChatWorldRole', '') : '';
  const EST_OFFSET_MS = 5 * 60 * 60 * 1000;
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
    return P.rtfont?.color('o', '[' + time + ']') || '[' + time + ']';
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
    const forcedCode = worldRole === 'owner' ? '2'
      : worldRole === 'admin' ? '^'
      : isDoctor ? '4'
      : isLegend ? '9' : '';
    if (forcedCode) return P.rtfont?.color(forcedCode, name) ?? name;
    if (P.rtfont?.hasCodes(rawGrowId)) return rawGrowId;
    return P.rtfont?.color('w', name) ?? name;
  }

  function visiblePreview() {
    const vv = window.visualViewport;
    const left = vv?.offsetLeft ?? 0, top = vv?.offsetTop ?? 0;
    const right = left + (vv?.width ?? window.innerWidth);
    const bottom = top + (vv?.height ?? window.innerHeight);
    const rect = preview?.getBoundingClientRect();
    const area = rect ? { left: Math.max(left, rect.left), top: Math.max(top, rect.top),
      right: Math.min(right, rect.right), bottom: Math.min(bottom, rect.bottom) } : { left, top, right, bottom };
    if (area.right <= area.left || area.bottom <= area.top) return { left, top, right, bottom };
    return area;
  }
  function layoutPreview() {
    const rect = preview.getBoundingClientRect();
    return { left: Math.max(0, rect.left), right: Math.min(innerWidth, rect.right),
      top: Math.max(0, rect.top), bottom: Math.min(innerHeight, rect.bottom) };
  }
  function positionBubble(area = visiblePreview()) {
    if (bubble.hidden || !anchor) return;
    const maxWidth = Math.max(80, Math.min(400, area.right - area.left - 24));
    bubble.style.maxWidth = maxWidth + 'px';
    bubble.style.setProperty('--player-chat-font-size', '16px');
    bubble.style.setProperty('--player-chat-pad-y', '2px');
    bubble.style.setProperty('--player-chat-pad-x', '5px');
    const rect = bubble.getBoundingClientRect();
    const x = clamp(anchor.x, area.left + rect.width / 2 + 8, area.right - rect.width / 2 - 8);
    const y = clamp(anchor.y - 18, area.top + rect.height / 2 + 4, area.bottom - rect.height / 2 - 4);
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
  }
  function position() {
    const area = layoutPreview(), gap = 8;
    const compactActions = matchMedia('(max-width:900px), (hover:none) and (pointer:coarse)').matches;
    const actionWidth = actions.offsetWidth || (compactActions ? 40 : 44);
    actions.style.left = area.right - actionWidth - gap + 'px';
    actions.style.top = area.top + gap + 'px';
    positionBubble();
  }
  function clear() {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    if (fadeTimer !== null) window.clearTimeout(fadeTimer);
    hideTimer = fadeTimer = null;
    speechVersion++;
    bubble.classList.remove('is-visible');
    bubble.hidden = true;
    speech.replaceChildren();
    lastText = '';
    speechState = null;
    P.emit('player-chat-end');
  }
  function submit(value = '') {
    const text = [...String(value ?? '').replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')]
      .slice(0, MAX_LENGTH).join('').trim();
    if (!(P.rtfont?.strip(text) ?? text).trim()) return false;
    if (/^\/dance\s*$/i.test(P.rtfont?.strip(text) ?? text)) {
      clear();
      P.emit('player-command', { command: 'dance', atMs: now() });
      return true;
    }
    clear();
    lastText = text;
    speech.textContent = text;
    P.rtfont?.scan(speech);
    bubble.hidden = false;
    const startedAtMs = now(), durationMs = SPEECH_MS;
    speechState = { startedAtMs, durationMs, text };
    const version = speechVersion;
    bubble.getBoundingClientRect();
    nextPaint(() => { if (version === speechVersion && !bubble.hidden) bubble.classList.add('is-visible'); });
    if (!anchor) {
      const area = visiblePreview();
      anchor = { x: (area.left + area.right) / 2, y: area.top + (area.bottom - area.top) * .45, scale: 1 };
    }
    position();
    fadeTimer = window.setTimeout(() => {
      if (version === speechVersion) bubble.classList.remove('is-visible');
    }, Math.max(0, durationMs - FADE_OUT_MS));
    hideTimer = window.setTimeout(() => { if (version === speechVersion) clear(); }, durationMs);
    P.emit('player-chat', { text, atMs: startedAtMs, durationMs });
    return true;
  }

  chatButton.addEventListener('click', () => {
    const message = window.prompt('Enter a message');
    if (message !== null) submit(message);
  });

  P.on('player-chat-anchor', point => {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      anchor = { ...point };
      positionBubble();
    }
  });
  P.on('preview', position);
  P.on('preview-mode', mode => {
    position();
    if (!mode?.live) clear();
    nextPaint(position);
  });
  P.on('drawer', position);
  P.on('boot', position);
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  document.fonts?.ready.then(position);

  P.playerChat = {
    submit, clear, stateAt, durationMs: SPEECH_MS, formatESTTimestamp, formatPlayerName,
    getWorldRole: () => worldRole,
    setWorldRole(role) {
      worldRole = ['owner', 'admin'].includes(role) ? role : '';
      P.store.set('playerChatWorldRole', worldRole);
      return worldRole;
    },
    get speech() { return stateAt(); },
    get isOpen() { return false; },
    get text() { return lastText; },
    get draft() { return ''; },
    get maxLength() { return MAX_LENGTH; },
    get height() { return 0; },
    get maxHeight() { return 0; },
    get logCount() { return 0; }
  };
  position();
  nextPaint(position);
})();
