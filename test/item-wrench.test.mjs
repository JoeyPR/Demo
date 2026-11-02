import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createItemWrenchDefaults,
  normalizeItemWrenchState,
  validateItemWrenchState
} from "../src/item-wrench-state.mjs";
import { buildItemWrenchDefinitionFromVariableMap } from "../src/item-wrench-variable-map.mjs";
import { buildItemWrenchDefinitionFromGameOptions } from "../src/item-wrench-game-options.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const registry = JSON.parse(read("../data/item-wrench-definitions.json"));
const cape = registry.items["10424"];
const wings = registry.items["11478"];

test("Rift Cape defines the shared Time Dilation controls before its style section", () => {
  assert.equal(cape.sharedControls[0].key, "timeDilationCycleTime");
  assert.equal(cape.sharedControls[0].default, 10);
  assert.equal(cape.sharedControls[1].key, "timeDilationEnabled");
  assert.equal(cape.sections[0].title, "`oCape Style 1");
});

test("Rift Cape defaults preserve the native RGB values supplied by research", () => {
  const defaults = createItemWrenchDefaults(cape);
  assert.deepEqual(defaults.capeColor, [234, 88, 226]);
  assert.deepEqual(defaults.collarColor, [130, 49, 126]);
  assert.equal(defaults.auraType, "");
});

test("Rift Wings has two separately stored style palettes and the native cycle default", () => {
  const defaults = createItemWrenchDefaults(wings);
  assert.equal(wings.sections.length, 2);
  assert.equal(defaults.timeDilationCycleTime, 15);
  assert.equal(defaults.timeDilationEnabled, true);
  assert.deepEqual(defaults.style1WingColor, [93, 22, 200]);
  assert.deepEqual(defaults.style1MetalColor, [220, 72, 255]);
  assert.deepEqual(defaults.style2WingColor, [137, 30, 43]);
  assert.deepEqual(defaults.style2MetalColor, [35, 35, 63]);
});

test("normalization isolates saved item settings and falls back safely on invalid values", () => {
  const stored = { capeColor: [1, 2, 3], collarColor: [999, 2, 3], timeDilationCycleTime: -1 };
  const result = normalizeItemWrenchState(cape, stored);
  assert.deepEqual(result.values.capeColor, [1, 2, 3]);
  assert.deepEqual(result.values.collarColor, [130, 49, 126]);
  assert.equal(result.values.timeDilationCycleTime, 10);
  assert.ok(result.errors.includes("collarColor"));
  assert.ok(result.errors.includes("timeDilationCycleTime"));
  result.values.capeColor[0] = 200;
  assert.deepEqual(stored.capeColor, [1, 2, 3]);
});

test("a valid full Cape state passes validation and malformed RGB is rejected", () => {
  const values = createItemWrenchDefaults(cape);
  assert.equal(validateItemWrenchState(cape, values).valid, true);
  values.capeColor = [256, 0, 0];
  assert.equal(validateItemWrenchState(cape, values).valid, false);
});

test("the item Wrench checkbox matches the requested transparent 1:1 design and asset path", () => {
  const css = read("../css/item-wrench.css");
  const ui = read("../js/item-wrench-ui.js");
  assert.match(css, /\.wrench-checkbox-box\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(css, /border:\s*var\(--bd\) solid #95C9FF/);
  assert.match(css, /background:\s*transparent/);
  assert.match(css, /box-shadow:[\s\S]*?#145EAE[\s\S]*?inset[\s\S]*?#145EAE/);
  assert.match(ui, /img\/c-chk\.png/);
});

test("side WRENCH opens the selected item dialog without redirecting to Player Customization", () => {
  const side = read("../js/side.js");
  assert.match(side, /P\.emit\('item-wrench-request', focused\)/);
  assert.doesNotMatch(side, /P\.emit\('focus-wrench'\)/);
  assert.doesNotMatch(side, /P\.emit\('open-tab', 'player'\)/);
});

test("the page loads the separate item Wrench stylesheet and dialog module", () => {
  const html = read("../index.html");
  assert.match(html, /css\/item-wrench\.css/);
  assert.match(html, /js\/item-wrench-ui\.js/);
});


test("Wings of Infinity UI is generated from its XML VariableMap, including four independent wing groups", () => {
  const maps = JSON.parse(read("../data/item-wrench-variable-maps.json"));
  const generated = buildItemWrenchDefinitionFromVariableMap(maps.items["15826"], 15826);
  assert.equal(generated.name, "Wings of Infinity");
  assert.equal(generated.sections.length, 4);
  assert.deepEqual(generated.sections.map(section => section.title),
    ["Top Left Wing", "Bottom Left Wing", "Top Right Wing", "Bottom Right Wing"]);
  assert.equal(generated.sections[0].controls.length, 7);
  assert.equal(generated.sections[0].controls[3].type, "heading");
  assert.equal(generated.sections[0].controls[3].label, "`oPrimary Color:");
  assert.equal(generated.sections[0].controls[4].type, "rgb");
  const values = createItemWrenchDefaults(generated);
  assert.equal(values.Visible_TL, true);
  assert.equal(values.Trail_TL, true);
  assert.equal(values["radioGroup-1"], "Feathered_TL");
  assert.deepEqual(values.Primary_TL, [0, 120, 220]);
  assert.deepEqual(values.Secondary_TL, [255, 73, 255]);
});

test("Anomaly Aura UI labels and Time Dilation fields are taken from VariableMap metadata", () => {
  const maps = JSON.parse(read("../data/item-wrench-variable-maps.json"));
  const generated = buildItemWrenchDefinitionFromVariableMap(maps.items["15230"], 15230);
  const defaults = createItemWrenchDefaults(generated);
  assert.equal(generated.sharedControls[0].label, "Time Dilation Cycle Time:");
  assert.equal(defaults.timeCycle, 15);
  assert.equal(defaults.timeCycle_On, true);
  assert.equal(defaults.darkAnomaly, false);
  assert.equal(defaults.lightAnomaly, false);
});

test("items without a hand-authored override can receive definitions from XML VariableMap data", () => {
  const maps = JSON.parse(read("../data/item-wrench-variable-maps.json"));
  for (const id of ["15230", "15826", "16314", "16316"]) {
    const generated = buildItemWrenchDefinitionFromVariableMap(maps.items[id], Number(id));
    assert.ok(generated, "missing generated definition for " + id);
    assert.ok(createItemWrenchDefaults(generated));
  }
});


test("native gameOptions automatically generate select controls for items without renderer VariableMaps", () => {
  const metadata = JSON.parse(read("../data/item-wrench-game-options.json"));
  const generated = buildItemWrenchDefinitionFromGameOptions(metadata.items["5712"], 5712);
  assert.equal(generated.name, "Will of the Wild");
  const select = generated.sections[0].controls[0];
  assert.equal(select.type, "select");
  assert.equal(select.label, "`oElement");
  assert.deepEqual(select.options.map(option => option.label), ["Fire", "Water", "Earth"]);
  assert.equal(select.default, 0);
});

test("native colour metadata automatically creates RGB controls", () => {
  const metadata = JSON.parse(read("../data/item-wrench-game-options.json"));
  const generated = buildItemWrenchDefinitionFromGameOptions(metadata.items["12958"], 12958);
  const defaults = createItemWrenchDefaults(generated);
  assert.deepEqual(defaults["crown-0"], [255, 0, 255]);
  assert.deepEqual(defaults["glow-1"], [0, 205, 249]);
});


test("the generic control state supports segmented buttons and sliders", () => {
  const definition = {
    sections: [{
      controls: [
        {
          type: "choice-buttons", key: "mode", default: "open",
          options: [{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }]
        },
        { type: "slider", key: "strength", default: 5, min: 0, max: 10, step: 1 }
      ]
    }]
  };
  const defaults = createItemWrenchDefaults(definition);
  assert.deepEqual(defaults, { mode: "open", strength: 5 });
  assert.equal(validateItemWrenchState(definition, defaults).valid, true);
  assert.equal(validateItemWrenchState(definition, { mode: "unknown", strength: 5 }).valid, false);
  assert.equal(validateItemWrenchState(definition, { mode: "open", strength: 11 }).valid, false);
});

test("the custom checkbox has a transparent 1:1 surface and both blue shadows", () => {
  const css = read("../css/item-wrench.css");
  const start = css.indexOf(".wrench-checkbox-box {");
  const end = css.indexOf("\n}", start);
  const block = css.slice(start, end);
  assert.match(block, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(block, /border:\s*var\(--bd\) solid #95C9FF/);
  assert.match(block, /border-radius:\s*var\(--radius\)/);
  assert.match(block, /background:\s*transparent/);
  assert.match(block, /box-shadow:[\s\S]*#145EAE[\s\S]*inset[\s\S]*#145EAE/);
});
