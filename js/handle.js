/* HANDLE: drag up/down moves the whole inventory (and pads); where you let go is where it stays. */
(function(){
  const ui = P.$('#ui'), h = P.$('#handle'), root = document.documentElement;
  let dy = P.store.get('dy', NaN);

  const range = () => {
    const H = ui.offsetHeight;
    const handleRect = h.getBoundingClientRect();
    const applied = parseFloat(getComputedStyle(root).getPropertyValue('--dy')) || 0;
    const baseTop = handleRect.top - applied;
    const edgeGap = 8;

    // Keep the handle on-screen as an absolute safety limit.
    let maxUp = Math.max(0, baseTop - edgeGap);

    // Cap only upward travel: the handle may approach the preview, but cannot
    // cross completely past its top edge. Downward travel is independent.
    const preview = P.$('#preview');
    if (preview) {
      const previewTop = preview.getBoundingClientRect().top;
      if (baseTop > previewTop) {
        const previewCap = Math.max(0, baseTop - previewTop - edgeGap);
        maxUp = Math.min(maxUp, previewCap);
      }
    }

    const maxDown = H * (606 - 130) / 894;
    return [-maxUp, maxDown];
  };
  const apply = v => {
    const [lo, hi] = range(); dy = Math.min(hi, Math.max(lo, v));
    root.style.setProperty('--dy', dy + 'px');
  };
  /* default: neutral position — inventory open with the search bar and a few
     rows visible, pads sitting over the game view like the in-game HUD */
  if (Number.isNaN(dy)) { dy = 0; }
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
