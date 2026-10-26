/* HANDLE: drag the inventory up or down; the upper limit keeps the handle visible near the preview. */
(function () {
  const ui = P.$('#ui'), h = P.$('#handle'), root = document.documentElement;
  const stored = Number(P.store.get('dy', 0));
  let dy = Number.isFinite(stored) ? stored : 0;

  // dy is a viewport-pixel translate. Remove it from the measured rect to get
  // the handle's stable home position, so the range doesn't drift while dragging.
  const range = () => {
    const rect = h.getBoundingClientRect();
    // Read the CSS-applied position, not the stored variable: on first boot
    // the saved dy has not been applied yet, so subtracting dy here breaks bounds.
    const applied = parseFloat(getComputedStyle(root).getPropertyValue('--dy')) || 0;
    const baseTop = rect.top - applied;
    const baseBottom = rect.bottom - applied;
    const edgeGap = 8;
    const preview = P.$('#preview');
    const previewTop = preview ? preview.getBoundingClientRect().top : 0;
    const topLimit = Math.max(edgeGap, previewTop + edgeGap);
    const maxUp = Math.max(0, baseTop - topLimit);
    // Let it come down freely until its handle reaches the bottom screen edge.
    const maxDown = Math.max(0, innerHeight - baseBottom - edgeGap);
    return [-maxUp, maxDown];
  };

  const apply = value => {
    const [lo, hi] = range();
    dy = Math.max(lo, Math.min(hi, Number(value) || 0));
    root.style.setProperty('--dy', dy + 'px');
  };

  P.drawer = { get dy() { return dy; }, set: apply };
  apply(dy);
  addEventListener('resize', () => apply(dy));

  let pointerId = null, y0 = 0, d0 = 0, last = 0;
  h.addEventListener('pointerdown', e => {
    if (pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    pointerId = e.pointerId;
    y0 = last = e.clientY;
    d0 = dy;
    h.classList.add('drag');
    try { h.setPointerCapture(e.pointerId); } catch { /* window listeners still track the drag */ }
  });

  // Track on window as well as through pointer capture. The drag won't stop
  // merely because the handle shifts beneath a finger or a layer overlaps it.
  window.addEventListener('pointermove', e => {
    if (pointerId !== e.pointerId) return;
    e.preventDefault();
    apply(d0 + e.clientY - y0);
    if (e.clientY !== last) {
      h.classList.toggle('up', e.clientY < last);
      h.classList.toggle('dn', e.clientY > last);
      last = e.clientY;
    }
  }, { passive: false });

  const end = e => {
    if (pointerId === null || (e?.pointerId !== undefined && e.pointerId !== pointerId)) return;
    pointerId = null;
    h.classList.remove('drag', 'up', 'dn');
    P.store.set('dy', Math.round(dy));
    P.emit('drawer', dy);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('blur', end);

  h.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      apply(dy + (e.key === 'ArrowUp' ? -30 : 30));
      P.store.set('dy', Math.round(dy));
      e.preventDefault();
      e.stopPropagation();
    }
  });
})();
