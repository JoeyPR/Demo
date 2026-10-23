/* HANDLE: drag up/down moves the whole inventory (and pads); where you let go is where it stays. */
(function(){
  const ui = P.$('#ui'), h = P.$('#handle'), root = document.documentElement;
  let dy = P.store.get('dy', NaN);

  const range = () => {
    const H = ui.offsetHeight;                        // 894 units, in px
    return [-Math.max(0, innerHeight - H - 12), H * (606 - 130) / 894];   // [max up, max down]
  };
  const apply = v => {
    const [lo, hi] = range(); dy = Math.min(hi, Math.max(lo, v));
    root.style.setProperty('--dy', dy + 'px');
  };
  /* first visit: start fully peeked so the player preview owns the screen;
     drag the handle up to open the inventory */
  if (Number.isNaN(dy)) { const [, hi] = range(); dy = hi; }
  P.drawer = { get dy() { return dy; }, set: apply };
  apply(dy);
  addEventListener('resize', () => apply(dy));

  let y0, d0, last;
  h.addEventListener('pointerdown', e => {
    h.setPointerCapture(e.pointerId); h.classList.add('drag'); y0 = last = e.clientY; d0 = dy;
  });
  h.addEventListener('pointermove', e => {
    if (!h.classList.contains('drag')) return;
    apply(d0 + e.clientY - y0);
    if (e.clientY !== last) { h.classList.toggle('up', e.clientY < last); h.classList.toggle('dn', e.clientY > last); last = e.clientY; }
  });
  const end = () => {
    if (!h.classList.contains('drag')) return;
    h.classList.remove('drag', 'up', 'dn'); P.store.set('dy', Math.round(dy)); P.emit('drawer', dy);
  };
  ['pointerup', 'pointercancel'].forEach(t => h.addEventListener(t, end));
  h.addEventListener('keydown', e => {                // keyboard: arrows nudge
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { apply(dy + (e.key === 'ArrowUp' ? -30 : 30)); P.store.set('dy', Math.round(dy)); e.preventDefault(); e.stopPropagation(); }
  });
})();
