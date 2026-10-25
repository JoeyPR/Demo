/* PREVIEW: fixed logical viewport (1920x1080 desktop / 1280x720 mobile) scaled to fit the window.
   P.preview = { w, h, ctx, scale, mobile }.  Emits 'frame' {dt, ctx, w, h} every animation frame:
   every Growtopia-side system (world, player, items, weather fx) draws by listening to 'frame'.
   Camera zoom (P.camZoom.v) scales the player/world rendering inside the canvas — the preview
   box itself always stays fitted to the window. Default is 100% (close to the player), matching
   CAMERA_ZOOM_DEFAULT in js/camera.mjs (kept in sync by test). Desktop: mouse wheel. Mobile: pinch. */
(function(){
  const root = P.$('#preview'), cv = P.$('#pv'), ctx = cv.getContext('2d');
  const mq = matchMedia('(max-width:900px), (hover:none) and (pointer:coarse)');
  const pv = P.preview = { w: 1920, h: 1080, ctx, scale: 1, mobile: false };
  P.camZoom = { v: 1, min: 0.5, max: 2 };   /* player/world camera zoom, 100% (close) by default */
  const Z = P.camZoom;

  function fit() {
    pv.mobile = mq.matches;
    pv.w = pv.mobile ? 1280 : 1920; pv.h = pv.mobile ? 720 : 1080;
    if (cv.width !== pv.w) { cv.width = pv.w; cv.height = pv.h; }
    pv.baseScale = pv.mobile ? innerWidth * (907 / 923) / pv.w : Math.max(innerWidth / pv.w, innerHeight / pv.h);   // desktop: cover the window (world fills the screen, HUD overlays it) — phone: fills the width
    apply();
  }
  function apply() {
    pv.scale = pv.baseScale;
    root.style.setProperty('--ps', pv.scale);
    /* expose the preview box's bottom edge so the mobile dropdown buttons can sit below it */
    const r = cv.getBoundingClientRect();
    document.documentElement.style.setProperty('--pvb', (r.bottom + window.scrollY) + 'px');
    P.emit('preview', pv);
  }

  function setZoom(v) {
    Z.v = Math.min(Z.max, Math.max(Z.min, v));
    P.emit('camzoom', Z.v);
  }

  const overUI = t => t.closest && t.closest('#ui, #hud, #toast, #logo, [data-dd]');
  /* Growtopia-style camera zoom: scroll wheel over the world (outside the
     inventory panels and the dropdown buttons) zooms the camera in/out. */
  document.addEventListener('wheel', e => {
    if (overUI(e.target)) return;
    e.preventDefault();
    setZoom(Z.v * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });

  /* Pinch zoom for touch devices: two fingers anywhere over the world (outside
     the UI panels and dropdown controls) zooms the camera in/out. */
  const pointers = new Map();
  let pinchBase = null;   /* { dist, zoom } */
  document.addEventListener('pointerdown', e => {
    if (overUI(e.target)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchBase = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: Z.v };
    }
  });
  document.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2 && pinchBase) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d > 8 && pinchBase.dist > 8) setZoom(pinchBase.zoom * d / pinchBase.dist);
    }
  });
  const drop = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchBase = null;
  };
  document.addEventListener('pointerup', drop);
  document.addEventListener('pointercancel', drop);

  addEventListener('resize', fit); fit();

  let t0 = performance.now();
  (function loop(t) {
    const dt = Math.min(.05, (t - t0) / 1000); t0 = t;
    ctx.clearRect(0, 0, pv.w, pv.h);
    ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, pv.w, pv.h);
    P.emit('frame', { dt, ctx, w: pv.w, h: pv.h });
    requestAnimationFrame(loop);
  })(t0);
})();
