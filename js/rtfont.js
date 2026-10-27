/* RTFont inline color formatting.
   Syntax: a backtick followed by a color code changes the color of the following
   text until another code appears. The marker itself is never displayed.
   P.rtfont.color(code, text) is a convenient way to create a formatted string. */
(function(root) {
  'use strict';
  const MARKER = String.fromCharCode(96);
  const RGB = {
    '0':[255,255,255], '1':[173,244,255], '2':[73,252,0],
    '3':[191,218,255], '4':[255,39,29], '5':[235,183,255],
    '6':[255,202,111], '7':[230,230,230], '8':[255,148,69],
    '9':[255,238,125], '!':[209,255,249], '@':[255,205,201],
    '#':[255,143,243], '$':[255,252,197], '^':[181,255,151],
    '&':[254,235,255], 'w':[255,255,255], 'o':[252,230,186],
    'b':[0,0,0], 'p':[255,223,241], 'q':[12,96,164],
    'e':[25,185,255], 'r':[111,211,87], 't':[47,131,13],
    'a':[81,81,81], 's':[158,158,158], 'c':[80,255,255]
  };
  const KEYS = new Set(Object.keys(RGB));
  const toCss = rgb => 'rgb(' + rgb.join(',') + ')';
  const sameRGB = (a, b) => a === null ? b === null : !!b && a.every((v, i) => v === b[i]);
  function hasCodes(value) {
    const text = String(value == null ? '' : value);
    for (let i = 0; i < text.length - 1; i++) {
      if (text[i] === MARKER && KEYS.has(text[i + 1])) return true;
    }
    return false;
  }
  function parse(value) {
    const text = String(value == null ? '' : value);
    const segments = [];
    let activeCode = null, activeRGB = null, buffer = '';
    const flush = () => {
      if (!buffer) return;
      const rgb = activeRGB ? activeRGB.slice() : null;
      const last = segments[segments.length - 1];
      if (last && last.code === activeCode && sameRGB(last.rgb, rgb)) {
        last.text += buffer;
      } else {
        segments.push({ text: buffer, code: activeCode, rgb: rgb, color: rgb ? toCss(rgb) : null });
      }
      buffer = '';
    };
    for (let i = 0; i < text.length; i++) {
      if (text[i] === MARKER && i + 1 < text.length && KEYS.has(text[i + 1])) {
        flush();
        activeCode = text[++i];
        activeRGB = RGB[activeCode];
        continue;
      }
      buffer += text[i];
    }
    flush();
    return segments;
  }
  function strip(value) {
    return parse(value).map(segment => segment.text).join('');
  }
  function characters(value) {
    const out = [];
    for (const segment of parse(value)) {
      for (const char of segment.text) out.push({
        char: char,
        code: segment.code,
        rgb: segment.rgb ? segment.rgb.slice() : null,
        color: segment.color
      });
    }
    return out;
  }
  function visibleLength(value) {
    return [...strip(value)].length;
  }
  function truncate(value, maxVisible) {
    const text = String(value == null ? '' : value);
    const limit = Math.max(0, Math.floor(Number(maxVisible) || 0));
    let out = '', visible = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === MARKER && i + 1 < text.length && KEYS.has(text[i + 1])) {
        if (visible >= limit) break;
        out += text[i] + text[++i];
        continue;
      }
      if (visible >= limit) break;
      const cp = text.codePointAt(i);
      const char = String.fromCodePoint(cp);
      out += char;
      visible++;
      if (char.length === 2) i++;
    }
    return out;
  }
  function color(code, text) {
    const key = String(code == null ? '' : code);
    const content = String(text == null ? '' : text);
    return KEYS.has(key) ? MARKER + key + content : content;
  }
  function canFormat(node) {
    const parent = node && node.parentElement;
    if (!parent || !parent.closest) return false;
    return !parent.closest('script,style,textarea,input,select,option,code,pre,noscript,svg,[data-rtfont-run],[data-rtfont-skip]');
  }
  function renderNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentNode || !canFormat(node) || !hasCodes(node.data)) return false;
    const doc = node.ownerDocument;
    const fragment = doc.createDocumentFragment();
    for (const segment of parse(node.data)) {
      if (!segment.text) continue;
      if (!segment.rgb) {
        fragment.appendChild(doc.createTextNode(segment.text));
      } else {
        const span = doc.createElement('span');
        span.setAttribute('data-rtfont-run', '');
        span.style.color = segment.color;
        span.textContent = segment.text;
        fragment.appendChild(span);
      }
    }
    node.parentNode.replaceChild(fragment, node);
    return true;
  }
  function scan(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === 3) { renderNode(rootNode); return; }
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 9 && rootNode.nodeType !== 11) return;
    if (rootNode.nodeType === 1 && rootNode.matches &&
        rootNode.matches('script,style,textarea,input,select,option,code,pre,noscript,svg,[data-rtfont-run],[data-rtfont-skip]')) return;
    const doc = rootNode.ownerDocument || root.document;
    if (!doc || !doc.createTreeWalker) return;
    const walker = doc.createTreeWalker(rootNode, 4);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(renderNode);
  }
  function watch(rootNode) {
    if (!rootNode || !root.MutationObserver) return null;
    scan(rootNode);
    const observer = new root.MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') renderNode(record.target);
        for (const node of record.addedNodes || []) scan(node);
      }
    });
    observer.observe(rootNode, { childList: true, subtree: true, characterData: true });
    return observer;
  }
  const api = {
    colors: RGB,
    marker: MARKER,
    parse: parse,
    strip: strip,
    hasCodes: hasCodes,
    characters: characters,
    visibleLength: visibleLength,
    truncate: truncate,
    color: color,
    renderNode: renderNode,
    scan: scan,
    watch: watch
  };
  root.RTFont = api;
  if (root.P) root.P.rtfont = api;
  if (root.document && root.document.body) api.watch(root.document.body);
})(window);
