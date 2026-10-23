/* PREVIEW: fixed logical viewport (1920x1080 desktop / 1280x720 mobile) scaled to fit the window.
   P.preview = { w, h, ctx, scale, mobile }.  Emits 'frame' {dt, ctx, w, h} every animation frame:
   every Growtopia-side system (world, player, items, weather fx) draws by listening to 'frame'. */
(function(){
  const root = P.$('#preview'), cv = P.$('#pv'), ctx = cv.getContext('2d');
  const mq = matchMedia('(max-width:900px), (hover:none) and (pointer:coarse)');
  const pv = P.preview = { w: 1920, h: 1080, ctx, scale: 1, mobile: false };

  function fit() {
    pv.mobile = mq.matches;
    pv.w = pv.mobile ? 1280 : 1920; pv.h = pv.mobile ? 720 : 1080;
    if (cv.width !== pv.w) { cv.width = pv.w; cv.height = pv.h; }
    pv.scale = pv.mobile ? innerWidth * (907 / 923) / pv.w : Math.min(1, (innerWidth - 16) / pv.w, (innerHeight * .72) / pv.h);   // phone: fills the width
    root.style.setProperty('--ps', pv.scale);
    P.emit('preview', pv);
  }
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
