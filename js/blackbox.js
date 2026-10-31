/* BLACKBOX: reusable, non-blocking warning messages positioned above inventory. */
(function() {
  const box = P.$("#blackbox");
  if (!box) return;

  let hideTimer = 0;
  let cleanupTimer = 0;

  function positionAbove(anchor) {
    let targetRect = null;
    if (anchor && typeof anchor.getBoundingClientRect === "function") {
      targetRect = anchor.getBoundingClientRect();
    } else {
      const inventory = P.$("#inv") || P.$("#ui");
      const handle = P.$("#handle");
      if (inventory && handle) {
        const inventoryRect = inventory.getBoundingClientRect();
        const handleRect = handle.getBoundingClientRect();
        targetRect = {
          left: inventoryRect.left,
          right: inventoryRect.right,
          top: handleRect.top,
          bottom: handleRect.bottom,
          width: inventoryRect.width,
          height: handleRect.height
        };
      }
    }
    if (!targetRect) return;

    const boxRect = box.getBoundingClientRect();
    const half = boxRect.width / 2;
    const center = targetRect.left + targetRect.width / 2;
    const left = Math.min(window.innerWidth - half - 8, Math.max(half + 8, center));
    box.style.left = left + "px";
    box.style.top = Math.max(4, targetRect.top - boxRect.height - 8) + "px";
  }

  function renderMessage(text) {
    const immortal = /immortal/i.test(text);
    const formatted = immortal && P.rtfont?.color
      ? P.rtfont.color("6", P.rtfont.strip(text))
      : text;
    const segments = P.rtfont?.parse
      ? P.rtfont.parse(formatted)
      : [{ text: formatted, color: null }];
    box.replaceChildren();
    for (const segment of segments) {
      if (!segment.text) continue;
      if (!segment.color) {
        box.append(document.createTextNode(segment.text));
      } else {
        const span = document.createElement("span");
        span.style.color = segment.color;
        span.textContent = segment.text;
        box.append(span);
      }
    }
    return immortal ? (P.rtfont?.strip ? P.rtfont.strip(text) : text) : text;
  }

  function fitMessageWidth(plainText) {
    const style = getComputedStyle(box);
    const baseSize = parseFloat(style.fontSize) || 24;
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const maxOuterWidth = Math.max(120, window.innerWidth - 16);
    const canvas = document.createElement("canvas");
    const measure = canvas.getContext("2d");
    measure.font = style.fontWeight + " " + baseSize + "px " + style.fontFamily;
    const textWidth = measure.measureText(plainText).width;
    const allowedTextWidth = Math.max(40, maxOuterWidth - padX);
    const fittedSize = textWidth > allowedTextWidth
      ? baseSize * allowedTextWidth / textWidth
      : baseSize;
    box.style.maxWidth = maxOuterWidth + "px";
    box.style.fontSize = Math.max(9, fittedSize) + "px";
  }

  function hide() {
    box.classList.remove("on");
    cleanupTimer = window.setTimeout(() => {
      box.hidden = true;
    }, 160);
  }

  P.blackbox = function(message, duration = 1800, anchor = null) {
    const text = String(message == null ? "" : message).trim();
    if (!text) return;

    window.clearTimeout(hideTimer);
    window.clearTimeout(cleanupTimer);
    box.hidden = false;
    box.classList.remove("on");
    const plainText = renderMessage(text);
    fitMessageWidth(plainText);
    positionAbove(anchor);

    window.requestAnimationFrame(() => {
      if (box.hidden) return;
      box.classList.add("on");
    });

    const ms = Number(duration);
    hideTimer = window.setTimeout(hide, Number.isFinite(ms) ? Math.max(400, ms) : 1800);
  };

})();
