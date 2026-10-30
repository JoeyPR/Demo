/* DROP: inventory-style confirmation dialog and amount validation. */
(function() {
  const make = (tag, className, id, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (id) node.id = id;
    if (text != null) node.textContent = text;
    return node;
  };
  const overlay = make("div", "drop-overlay", "drop-overlay");
  overlay.hidden = true;
  const dialog = make("section", "drop-dialog", null);
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "drop-title");
  dialog.setAttribute("aria-describedby", "drop-prompt");

  const row = make("div", "drop-item-row");
  const iconBox = make("div", "drop-item-icon", "drop-item-icon");
  const title = make("h2", "drop-title", "drop-title", "Drop Item");
  row.append(iconBox, title);
  const prompt = make("p", "drop-prompt", "drop-prompt");
  const amountInput = make("input", "drop-amount", "drop-amount");
  amountInput.type = "text";
  amountInput.inputMode = "text";
  amountInput.maxLength = 6;
  amountInput.autocomplete = "off";
  amountInput.spellcheck = false;
  amountInput.value = "1";
  amountInput.setAttribute("aria-label", "Amount to drop");
  const error = make("p", "drop-error", "drop-error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  const actions = make("div", "drop-actions");
  const cancelButton = make("button", "drop-cancel", "drop-cancel", "Cancel");
  cancelButton.type = "button";
  const confirmButton = make("button", "drop-confirm", "drop-confirm", "OK");
  confirmButton.type = "button";
  actions.append(cancelButton, confirmButton);
  dialog.append(row, prompt, amountInput, error, actions);
  overlay.append(dialog);
  const preview = document.getElementById("preview");
  document.body.append(overlay);

  let uiScale = 1;

  // Anchor the modal to the rendered preview rectangle while keeping it in the
  // top document layer, so the inventory cannot cover its lower edge.
  function positionOverlay() {
    if (!preview) return;
    const rect = preview.getBoundingClientRect();
    const scale = 0.92 * Math.max(0.12, Math.min(rect.width / 643, rect.height / 480));
    uiScale = scale;
    overlay.style.left = rect.left + "px";
    overlay.style.top = rect.top + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";

    // The dialog starts at the reference footprint but grows naturally for
    // unusually long names and quantities, up to the preview's content bounds.
    dialog.style.setProperty("--drop-scale", String(scale));
    dialog.style.setProperty("--drop-min-width", Math.min(rect.width * 0.88, 565 * scale) + "px");
    dialog.style.setProperty("--drop-max-width", rect.width * 0.96 + "px");
    dialog.style.setProperty("--drop-pad-x", 34 * scale + "px");
    dialog.style.setProperty("--drop-pad-top", 28 * scale + "px");
    dialog.style.setProperty("--drop-pad-bottom", 18 * scale + "px");
    dialog.style.setProperty("--drop-row-gap", 12 * scale + "px");
    dialog.style.setProperty("--drop-title-size", 65 * scale + "px");
    dialog.style.setProperty("--drop-prompt-size", 43 * scale + "px");
    dialog.style.setProperty("--drop-icon-size", 48 * scale + "px");
    dialog.style.setProperty("--drop-input-height", 68 * scale + "px");
    dialog.style.setProperty("--drop-input-font", 36 * scale + "px");
    dialog.style.setProperty("--drop-button-height", 84 * scale + "px");
    dialog.style.setProperty("--drop-button-font", 52 * scale + "px");
    dialog.style.setProperty("--drop-cancel-width", 226 * scale + "px");
    dialog.style.setProperty("--drop-ok-width", 104 * scale + "px");
    dialog.style.setProperty("--drop-button-gap", 40 * scale + "px");
    syncAmountWidth();
  }
  window.addEventListener("resize", positionOverlay);
  P.on("preview", positionOverlay);
  positionOverlay();

  let currentItem = null;
  let previousFocus = null;

  function syncAmountWidth() {
    const digits = Math.max(1, String(amountInput.value || "1").length);
    const base = 190 * uiScale;
    const needed = (digits * 33 + 30) * uiScale;
    amountInput.style.width = Math.max(base, needed) + "px";
  }

  function close() {
    overlay.hidden = true;
    currentItem = null;
    amountInput.value = "1";
    error.hidden = true;
    error.textContent = "";
    iconBox.replaceChildren();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }

  function open(item) {
    if (item?.tool) {
      P.blackbox?.("You can't drop that.");
      return;
    }
    if (!item || item.wearable === false || item.gone) {
      P.toast("Select a valid item first.");
      return;
    }
    currentItem = item;
    previousFocus = document.activeElement;
    title.textContent = "Drop " + item.name;
    prompt.textContent = P.rtfont?.color("o", "How many to drop?") || "How many to drop?";
    amountInput.value = "1";
    syncAmountWidth();
    error.hidden = true;
    error.textContent = "";
    iconBox.replaceChildren();
    if (typeof P.thumb === "function") {
      try { iconBox.append(P.thumb(item, 64)); }
      catch (error) {
        console.warn("[Drop] item thumbnail unavailable; opening dialog anyway.", error);
        iconBox.textContent = (item.name || "?").slice(0, 1).toUpperCase();
      }
    }
    overlay.hidden = false;
    amountInput.focus({ preventScroll: true });
    amountInput.select();
  }

  function confirm() {
    if (!currentItem) return;
    const rawAmount = String(amountInput.value || "").trim();
    const amount = /^\d+$/.test(rawAmount) ? Number(rawAmount) : NaN;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999999) {
      error.textContent = "Enter a whole number from 1 to 999999.";
      error.hidden = false;
      amountInput.focus();
      amountInput.select();
      return;
    }
    const item = currentItem;
    close();
    P.emit("drop-confirm", { item, amount });
  }

  cancelButton.addEventListener("click", close);
  confirmButton.addEventListener("click", confirm);
  amountInput.addEventListener("input", () => {
    syncAmountWidth();
    error.hidden = true;
    error.textContent = "";
  });
  amountInput.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.key === "Enter") { event.preventDefault(); confirm(); }
    if (event.key === "Escape") { event.preventDefault(); close(); }
  });
  dialog.addEventListener("pointerdown", event => event.stopPropagation());
  overlay.addEventListener("pointerdown", event => {
    event.stopPropagation();
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", event => {
    if (overlay.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    event.stopPropagation(); // while the dialog is open, movement keys must not reach the preview controller
  });
  P.on("drop-request", open);
})();
