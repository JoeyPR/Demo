/* BLACKBOX: reusable, non-blocking warning messages positioned above inventory. */
(function() {
  const box = P.$("#blackbox");
  if (!box) return;

  let hideTimer = 0;
  let cleanupTimer = 0;

  function position() {
    const inventory = P.$("#main") || P.$("#inv");
    if (!inventory) return;

    const rect = inventory.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const centerX = Math.max(8, Math.min(viewportWidth - 8, rect.left + rect.width / 2));
    box.style.left = centerX + "px";
    box.style.top = Math.max(8, rect.top - box.getBoundingClientRect().height - 10) + "px";
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
