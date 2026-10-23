/* CORE: the one global `P`, a tiny event bus, and persistent storage. */
(function(){
  const P = window.P = {};
  const ev = {};
  P.on   = (n, f) => ((ev[n] = ev[n] || []).push(f), f);
  P.emit = (n, d) => (ev[n] || []).forEach(f => f(d));
  P.$    = (s, r) => (r || document).querySelector(s);
  P.$$   = (s, r) => [...(r || document).querySelectorAll(s)];

  const KEY = 'yam.ui';
  let db = {};
  try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  P.store = {
    get: (k, d) => (k in db ? db[k] : d),
    set(k, v) { db[k] = v; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  };

  P.toast = (() => { let t; return msg => {
    const el = P.$('#toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(t); t = setTimeout(() => el.classList.remove('on'), 1400);
  }; })();
})();
