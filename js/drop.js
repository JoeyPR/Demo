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
  amountInput.type = "number";
  amountInput.min = "1";
  amountInput.max = "999999";
  amountInput.step = "1";
  amountInput.inputMode = "numeric";
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
  document.body.append(overlay);

  let currentItem = null;
  let previousFocus = null;

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
    if (!item || item.tool || item.wearable === false || item.gone) {
      P.toast("Select a valid item first.");
      return;
    }
    currentItem = item;
    previousFocus = document.activeElement;
    title.textContent = "Drop " + item.name;
    prompt.textContent = P.rtfont?.color("o", "How many to drop?") || "How many to drop?";
    amountInput.value = "1";
    error.hidden = true;
    error.textContent = "";
    iconBox.replaceChildren();
    if (typeof P.thumb === "function") iconBox.append(P.thumb(item, 64));
    overlay.hidden = false;
    amountInput.focus({ preventScroll: true });
    amountInput.select();
  }

  function confirm() {
    if (!currentItem) return;
    const amount = Number(amountInput.value);
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
