import {
  createItemWrenchDefaults,
  normalizeItemWrenchState,
  validateItemWrenchState,
  cloneItemWrenchState
} from "../src/item-wrench-state.mjs";
import { buildItemWrenchDefinitionFromVariableMap } from "../src/item-wrench-variable-map.mjs";
import { buildItemWrenchDefinitionFromGameOptions } from "../src/item-wrench-game-options.mjs";

const STORE_KEY = "itemWrenchSettings";
const preview = document.getElementById("preview");
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const clone = value => JSON.parse(JSON.stringify(value));

const overlay = make("div", "item-wrench-overlay");
overlay.id = "item-wrench-overlay";
overlay.hidden = true;

const dialog = make("section", "drop-dialog item-wrench-dialog");
dialog.setAttribute("role", "dialog");
dialog.setAttribute("aria-modal", "true");
dialog.setAttribute("aria-labelledby", "item-wrench-title");
dialog.tabIndex = -1;

const header = make("header", "item-wrench-header");
const iconBox = make("div", "drop-item-icon item-wrench-icon");
const title = make("h2", "drop-title");
title.id = "item-wrench-title";
header.append(iconBox, title);

const content = make("div", "item-wrench-content");
content.id = "item-wrench-content";

const footer = make("footer", "item-wrench-footer");
const resetButton = make("button", "wrench-reset", "Reset to Default");
resetButton.type = "button";
const actions = make("div", "wrench-footer-actions");
const cancelButton = make("button", "wrench-cancel", "Cancel");
cancelButton.type = "button";
const updateButton = make("button", "wrench-update", "Update");
updateButton.type = "button";
actions.append(cancelButton, updateButton);
footer.append(resetButton, actions);
dialog.append(header, content, footer);
overlay.append(dialog);
document.body.append(overlay);

let definitions = null;
let variableMaps = null;
let gameOptions = null;
let loading = null;
let currentItem = null;
let currentDefinition = null;
let savedValues = null;
let draft = null;
let previousFocus = null;
let invalidInputs = new Set();
let controlNodes = new Map();

function storedSettings() {
  const value = P.store.get(STORE_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function richText(node, value) {
  node.textContent = String(value ?? "");
  P.rtfont?.scan(node);
}

function position() {
  if (!preview) return;
  const rect = preview.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = 0.92 * Math.max(0.12, Math.min(rect.width / 643, rect.height / 480));
  Object.assign(overlay.style, {
    left: rect.left + "px",
    top: rect.top + "px",
    width: rect.width + "px",
    height: rect.height + "px"
  });
  dialog.style.setProperty("--wrench-scale", String(scale));
  dialog.style.setProperty("--wrench-min-width", Math.min(rect.width * 0.86, 565 * scale) + "px");
  dialog.style.setProperty("--wrench-max-width", rect.width * 0.96 + "px");
}

function emitPreview() {
  if (!currentItem || !currentDefinition || !draft) return;
  P.emit("item-wrench-preview", {
    itemId: currentItem.id,
    itemName: currentItem.name,
    definition: currentDefinition,
    values: cloneItemWrenchState(draft),
    savedValues: cloneItemWrenchState(savedValues)
  });
}

function syncDependentVisibility() {
  for (const node of content.querySelectorAll("[data-visible-key]")) {
    const key = node.dataset.visibleKey;
    const expected = node.dataset.visibleEquals;
    node.hidden = String(draft?.[key]) !== expected;
  }
}

function setValue(key, value) {
  draft[key] = clone(value);
  const validity = validateItemWrenchState(currentDefinition, draft);
  updateButtonState(validity.valid);
  syncChoiceChecks();
  syncDependentVisibility();
  emitPreview();
}

function updateButtonState(valid) {
  updateButton.disabled = !valid || invalidInputs.size > 0;
}

function syncChoiceChecks() {
  for (const [key, refs] of controlNodes) {
    const control = refs.control;
    if (control.type !== "choice-checkboxes") continue;
    for (const option of refs.options) option.input.checked = draft[key] === option.value;
  }
}

function parseRgb(text) {
  const values = String(text).trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.length !== 3 || values.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return values;
}

function makeControl(control) {
  if (control.type === "heading") {
    const heading = make("h3", "item-wrench-subheading");
    richText(heading, control.label);
    return heading;
  }

  const wrapper = make("div", "wrench-control wrench-control-" + control.type);
  if (control.visibleWhen) {
    wrapper.dataset.visibleKey = control.visibleWhen.key;
    wrapper.dataset.visibleEquals = String(control.visibleWhen.equals);
  }

  const refs = { control, options: [] };
  controlNodes.set(control.key, refs);

  if (control.type === "checkbox") {
    const label = make("label", "wrench-checkbox-row");
    const input = make("input", "wrench-checkbox-input");
    input.type = "checkbox";
    input.checked = !!draft[control.key];
    input.setAttribute("aria-label", String(control.label).replace(/^\x60[a-z0-9!@#$^&]/, ""));
    const box = make("span", "wrench-checkbox-box");
    box.setAttribute("aria-hidden", "true");
    const check = make("img");
    check.src = "img/c-chk.png";
    check.alt = "";
    check.draggable = false;
    box.append(check);
    const text = make("span", "wrench-checkbox-label");
    richText(text, control.label);
    input.addEventListener("change", () => setValue(control.key, input.checked));
    label.append(input, box, text);
    wrapper.append(label);
    return wrapper;
  }

  const label = make("label", "wrench-label");
  richText(label, control.label);
  wrapper.append(label);
  if (control.help) {
    const help = make("p", "wrench-control-help", control.help);
    wrapper.append(help);
  }

  if (control.type === "rgb") {
    const row = make("div", "wrench-rgb-row");
    const input = make("input", "item-wrench-input wrench-rgb-input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = (draft[control.key] ?? [0, 0, 0]).join(", ");
    input.setAttribute("aria-label", String(control.label).replace(/^\x60[a-z0-9!@#$^&]/, ""));
    const swatch = make("span", "wrench-color-preview");
    const rgb = parseRgb(input.value) ?? [0, 0, 0];
    swatch.style.backgroundColor = "rgb(" + rgb.join(",") + ")";
    input.addEventListener("input", () => {
      const parsed = parseRgb(input.value);
      if (!parsed) {
        input.setAttribute("aria-invalid", "true");
        wrapper.classList.add("is-invalid");
        invalidInputs.add(control.key);
      } else {
        input.removeAttribute("aria-invalid");
        wrapper.classList.remove("is-invalid");
        invalidInputs.delete(control.key);
        swatch.style.backgroundColor = "rgb(" + parsed.join(",") + ")";
        draft[control.key] = parsed;
        emitPreview();
      }
      updateButtonState(validateItemWrenchState(currentDefinition, draft).valid);
    });
    row.append(input, swatch);
    wrapper.append(row);
  } else if (control.type === "number") {
    const input = make("input", "item-wrench-input wrench-number-input");
    input.type = "number";
    input.inputMode = "decimal";
    input.step = String(control.step ?? "any");
    if (control.min != null) input.min = String(control.min);
    if (control.max != null) input.max = String(control.max);
    input.value = String(draft[control.key] ?? control.default ?? 0);
    input.setAttribute("aria-label", String(control.label).replace(/^\x60[a-z0-9!@#$^&]/, ""));
    input.addEventListener("input", () => {
      if (input.value.trim() === "" || !Number.isFinite(Number(input.value))) {
        invalidInputs.add(control.key);
        input.setAttribute("aria-invalid", "true");
        updateButtonState(false);
        return;
      }
      const value = Number(input.value);
      if ((control.min != null && value < control.min) || (control.max != null && value > control.max)) {
        invalidInputs.add(control.key);
        input.setAttribute("aria-invalid", "true");
        updateButtonState(false);
        return;
      }
      invalidInputs.delete(control.key);
      input.removeAttribute("aria-invalid");
      draft[control.key] = value;
      updateButtonState(validateItemWrenchState(currentDefinition, draft).valid);
      emitPreview();
    });
    wrapper.append(input);
  } else if (control.type === "select") {
    const select = make("select", "item-wrench-input wrench-select");
    for (const option of control.options ?? []) {
      const node = make("option", "", option.label.replace(/^\x60[a-z0-9!@#$^&]/, ""));
      node.value = String(option.value);
      select.append(node);
    }
    select.value = String(draft[control.key] ?? "");
    select.addEventListener("change", () => setValue(control.key, control.options.find(option => String(option.value) === select.value)?.value));
    wrapper.append(select);
  } else if (control.type === "choice-checkboxes") {
    const group = make("div", "wrench-choice-checkboxes");
    for (const option of control.options ?? []) {
      const optionLabel = make("label", "wrench-checkbox-row wrench-choice-checkbox-row");
      const input = make("input", "wrench-checkbox-input");
      input.type = "checkbox";
      input.checked = draft[control.key] === option.value;
      input.setAttribute("aria-label", String(option.label).replace(/^\x60[a-z0-9!@#$^&]/, ""));
      const box = make("span", "wrench-checkbox-box");
      box.setAttribute("aria-hidden", "true");
      const check = make("img");
      check.src = "img/c-chk.png";
      check.alt = "";
      check.draggable = false;
      box.append(check);
      const text = make("span", "wrench-checkbox-label");
      richText(text, option.label);
      input.addEventListener("change", () => {
        const next = input.checked ? option.value : "";
        setValue(control.key, next);
      });
      optionLabel.append(input, box, text);
      group.append(optionLabel);
      refs.options.push({ input, value: option.value });
    }
    wrapper.append(group);
  } else if (control.type === "text") {
    const input = make("input", "item-wrench-input");
    input.type = "text";
    input.maxLength = control.maxLength ?? 120;
    input.value = String(draft[control.key] ?? "");
    input.addEventListener("input", () => setValue(control.key, input.value));
    wrapper.append(input);
  }

  return wrapper;
}

function buildContent() {
  content.replaceChildren();
  controlNodes.clear();
  invalidInputs.clear();

  for (const note of currentDefinition.notes ?? []) {
    const p = make("p", "item-wrench-note", note);
    content.append(p);
  }

  for (const control of currentDefinition.sharedControls ?? []) {
    content.append(makeControl(control));
  }
  for (const section of currentDefinition.sections ?? []) {
    const block = make("section", "item-wrench-section");
    const heading = make("h3", "item-wrench-section-title");
    richText(heading, section.title);
    block.append(heading);
    for (const control of section.controls ?? []) block.append(makeControl(control));
    content.append(block);
  }
  syncDependentVisibility();
  updateButtonState(validateItemWrenchState(currentDefinition, draft).valid);
}

function close(reason = "cancel") {
  if (overlay.hidden) return;
  if (reason === "cancel" && currentItem && currentDefinition) {
    P.emit("item-wrench-cancel", {
      itemId: currentItem.id,
      itemName: currentItem.name,
      definition: currentDefinition,
      values: cloneItemWrenchState(savedValues)
    });
    draft = cloneItemWrenchState(savedValues);
    emitPreview();
  }
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  content.replaceChildren();
  controlNodes.clear();
  currentItem = null;
  currentDefinition = null;
  savedValues = null;
  draft = null;
  invalidInputs.clear();
  P.emit("input-reset");
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}

async function loadDefinitions() {
  if (!loading) {
    loading = Promise.all([
      fetch(new URL("../data/item-wrench-definitions.json", import.meta.url)),
      fetch(new URL("../data/item-wrench-variable-maps.json", import.meta.url)),
      fetch(new URL("../data/item-wrench-game-options.json", import.meta.url))
    ])
      .then(async ([definitionsResponse, mapsResponse, gameOptionsResponse]) => {
        if (!definitionsResponse.ok) throw new Error("Item Wrench definitions unavailable");
        if (!mapsResponse.ok) throw new Error("Renderer VariableMap index unavailable");
        if (!gameOptionsResponse.ok) throw new Error("Native gameOptions index unavailable");
        const [definitionData, mapData, gameOptionsData] = await Promise.all([
          definitionsResponse.json(), mapsResponse.json(), gameOptionsResponse.json()
        ]);
        definitions = definitionData;
        variableMaps = mapData;
        gameOptions = gameOptionsData;
        return definitions;
      })
      .catch(error => { loading = null; throw error; });
  }
  return loading;
}

async function open(item) {
  if (!item || item.tool || item.gone) {
    P.toast("Select a wrenchable item first.");
    return;
  }
  try {
    const registry = await loadDefinitions();
    const itemId = String(item.id);
    const authoredDefinition = registry.items?.[itemId];
    const variableMapRecord = variableMaps?.items?.[itemId];
    const gameOptionsRecord = gameOptions?.items?.[itemId];
    const definition = authoredDefinition ??
      buildItemWrenchDefinitionFromVariableMap(variableMapRecord, item.id) ??
      buildItemWrenchDefinitionFromGameOptions(gameOptionsRecord, item.id);
    if (!definition) {
      P.toast("Wrench settings are not configured for " + (item.name ?? "this item") + " yet.");
      return;
    }
    if (overlay.hidden) previousFocus = document.activeElement;
    currentItem = item;
    currentDefinition = definition;
    title.textContent = definition.name ?? item.name ?? "Item Wrench";
    iconBox.replaceChildren();
    try {
      if (typeof P.thumb === "function") iconBox.append(P.thumb(item, 64));
    } catch (error) {
      console.warn("[Item Wrench] thumbnail unavailable", error);
    }
    const stored = storedSettings()[String(item.id)];
    savedValues = normalizeItemWrenchState(definition, stored).values;
    draft = cloneItemWrenchState(savedValues);
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    position();
    buildContent();
    dialog.scrollTop = 0;
    P.emit("item-wrench-open", { item, definition, values: cloneItemWrenchState(draft) });
    P.emit("input-reset");
    emitPreview();
    dialog.focus({ preventScroll: true });
  } catch (error) {
    console.error("[Item Wrench] could not open", error);
    P.toast("Wrench settings could not be loaded.");
  }
}

function resetToDefault() {
  if (!currentDefinition) return;
  draft = createItemWrenchDefaults(currentDefinition);
  invalidInputs.clear();
  buildContent();
  emitPreview();
}

function update() {
  if (!currentItem || !currentDefinition) return;
  const validation = validateItemWrenchState(currentDefinition, draft);
  if (!validation.valid || invalidInputs.size) {
    P.toast("Check the highlighted Wrench values.");
    return;
  }
  const stored = storedSettings();
  stored[String(currentItem.id)] = cloneItemWrenchState(draft);
  P.store.set(STORE_KEY, stored);
  const payload = {
    itemId: currentItem.id,
    itemName: currentItem.name,
    definition: currentDefinition,
    values: cloneItemWrenchState(draft)
  };
  P.emit("item-wrench-update", payload);
  close("update");
  P.toast((payload.itemName ?? "Item") + " settings updated.");
}

resetButton.addEventListener("click", resetToDefault);
cancelButton.addEventListener("click", () => close("cancel"));
updateButton.addEventListener("click", update);
overlay.addEventListener("pointerdown", event => {
  event.stopPropagation();
  if (event.target === overlay) close("cancel");
});
dialog.addEventListener("pointerdown", event => event.stopPropagation());
document.addEventListener("keydown", event => {
  if (overlay.hidden) return;
  event.stopPropagation();
  if (event.key === "Escape") {
    event.preventDefault();
    close("cancel");
  }
}, true);
window.addEventListener("resize", position);
P.on("preview", position);
P.on("item-wrench-request", open);

P.itemWrench = {
  open,
  close: () => close("cancel"),
  get(id) {
    const value = storedSettings()[String(id)];
    return value ? clone(value) : null;
  },
  get definitions() { return definitions; },
  get current() { return currentItem; },
  get isOpen() { return !overlay.hidden; }
};
