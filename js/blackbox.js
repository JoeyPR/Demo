/* BLACKBOX: reusable, non-blocking warning messages positioned above inventory. */
(function() {
  const box = P.$("#blackbox");
  if (!box) return;

  let hideTimer = 0;
  let cleanupTimer = 0;

  function positionAtCurrentInventory() {
    // Snapshot the dragged inventory position once when the warning is shown.
    // #inv provides the shared horizontal center; #handle provides the current
    // desktop/mobile drawer position after its drag transform has been applied.
    const inventory = P.$("#inv") || P.$("#ui");
    const handle = P.$("#handle");
    if (!inventory || !handle) return;

    const inventoryRect = inventory.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    box.style.left = (inventoryRect.left + inventoryRect.width / 2) + "px";
    box.style.top = Math.max(4, handleRect.top - boxRect.height - 8) + "px";
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
    positionAtCurrentInventory();

    window.requestAnimationFrame(() => {
      if (box.hidden) return;
      box.classList.add("on");
    });

    const ms = Number(duration);
    hideTimer = window.setTimeout(hide, Number.isFinite(ms) ? Math.max(400, ms) : 1800);
  };

})();
