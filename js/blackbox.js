/* BLACKBOX: reusable, non-blocking warning messages positioned above inventory. */
(function() {
  const box = P.$("#blackbox");
  if (!box) return;

  let hideTimer = 0;
  let cleanupTimer = 0;

  function position() {
    // #inv spans the full centered inventory stage: its midpoint aligns with
    // the top drawer and the preview, unlike #main which is intentionally left-heavy.
    const inventory = P.$("#inv") || P.$("#ui");
    const drawer = P.$("#main");
    if (!inventory || !drawer) return;

    const inventoryRect = inventory.getBoundingClientRect();
    const drawerRect = drawer.getBoundingClientRect();
    box.style.left = (inventoryRect.left + inventoryRect.width / 2) + "px";
    box.style.top = Math.max(8, drawerRect.top - box.getBoundingClientRect().height - 10) + "px";
  }

  function hide() {
    box.classList.remove("on");
    cleanupTimer = window.setTimeout(() => {
      box.hidden = true;
    }, 160);
  }

  P.blackbox = function(message, duration = 1800) {
    const text = String(message == null ? "" : message).trim();
    if (!text) return;

    window.clearTimeout(hideTimer);
    window.clearTimeout(cleanupTimer);
    box.textContent = text;
    box.hidden = false;
    box.classList.remove("on");
    position();

    window.requestAnimationFrame(() => {
      if (box.hidden) return;
      position();
      box.classList.add("on");
    });

    const ms = Number(duration);
    hideTimer = window.setTimeout(hide, Number.isFinite(ms) ? Math.max(400, ms) : 1800);
  };

  window.addEventListener("resize", () => {
    if (!box.hidden) position();
  });
  P.on("preview", () => {
    if (!box.hidden) position();
  });
})();
