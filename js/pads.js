/* PADS: pointer + keyboard -> P.input.{left,right,jump,punch}. Emits 'pad' {k, down}.
   Visual state (.down = 100% opacity) lasts exactly while the pad is held. */
(function(){
  const input = P.input = { left: 0, right: 0, jump: 0, punch: 0 };
  const el = {};
  P.$$('.pad').forEach(b => el[b.dataset.k] = b);
  const held = { left: new Set(), right: new Set(), jump: new Set(), punch: new Set() };   // source ids per pad

  function set(k, src, down) {
    const s = held[k]; down ? s.add(src) : s.delete(src);
    const on = s.size ? 1 : 0;
    if (on === input[k]) return;
    input[k] = on; el[k].classList.toggle('down', !!on); P.emit('pad', { k, down: !!on });
  }

  P.$$('.pad').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(k, 'p' + e.pointerId, true); });
    const up = e => set(k, 'p' + e.pointerId, false);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, up));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });

  const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyX: 'punch', KeyF: 'punch' };
  const typing = () => /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName);
  addEventListener('keydown', e => { const k = map[e.code]; if (k && !typing()) { e.preventDefault(); set(k, e.code, true); } });
  addEventListener('keyup',   e => { const k = map[e.code]; if (k) set(k, e.code, false); });
  addEventListener('blur', () => Object.keys(held).forEach(k => { held[k].clear(); set(k, '-', false); }));
})();
