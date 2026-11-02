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
import {
  applyItemWrenchAppearance,
  buildNativeWrenchSettings,
  gameOptionDesign,
  pickedGameOptionColour
} from "../demo/engine/item-wrench-render.mjs";

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
  assert.deepEqual(defaults.capeColorStyle2, [234, 88, 226]);
  assert.deepEqual(defaults.collarColorStyle2, [130, 49, 126]);
  assert.equal(defaults.collarEnabled, true);
  assert.equal(defaults.closedCape, false);
  assert.equal(defaults.openCapeOnMovement, true);
  assert.equal(defaults.timeDilationEnabled, false);
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
    ["`oTop Left Wing", "`oBottom Left Wing", "`oTop Right Wing", "`oBottom Right Wing"]);
  assert.equal(generated.sections[0].controls.length, 7);
  assert.equal(generated.sections[0].controls[3].type, "heading");
  assert.equal(generated.sections[0].controls[3].label, "`oPrimary Color:");
  assert.equal(generated.sections[0].controls[4].type, "rgb");
  assert.equal(generated.sections[0].controls[0].help, undefined);
  assert.equal(generated.sections[0].controls[4].help, undefined);
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
  assert.equal(generated.sharedControls[0].label, "`oTime Dilation Cycle Time:");
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
  assert.deepEqual(defaults["colour-crown-0"], [255, 0, 255]);
  assert.deepEqual(defaults["colour-glow-1"], [0, 205, 249]);
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


test("the Wrench footer keeps Reset above Drop-style Cancel and OK actions", () => {
  const ui = read("../js/item-wrench-ui.js");
  const css = read("../css/item-wrench.css");
  assert.match(ui, /footer\.append\(resetButton, actions\)/);
  assert.match(ui, /actions\.append\(cancelButton, updateButton\)/);
  assert.match(ui, /make\("button", "wrench-cancel drop-cancel", "Cancel"\)/);
  assert.match(ui, /make\("button", "wrench-update drop-confirm", "OK"\)/);
  assert.match(ui, /make\("button", "wrench-reset", "Reset to Default"\)/);
  assert.match(ui, /make\("div", "wrench-footer-actions drop-actions"\)/);
  assert.match(css, /width:\s*var\(--wrench-reset-width/);
  assert.match(css, /justify-content:\s*flex-start/);
});

test("the checkbox checkmark falls back cleanly while the image asset is absent", () => {
  const ui = read("../js/item-wrench-ui.js");
  const css = read("../css/item-wrench.css");
  assert.match(ui, /img\/c-chk\.png/);
  assert.match(ui, /check\.addEventListener\("error"/);
  assert.match(css, /\.wrench-checkbox-box img\[hidden\]\s*\{\s*display:\s*none !important;/);
});


test("Rift Cape dialog values translate to source-backed native colour, flag, layer and cycle settings", () => {
  const defaults = createItemWrenchDefaults(cape);
  const native = buildNativeWrenchSettings(cape, defaults);
  assert.deepEqual(native.c2, [234, 88, 226]);
  assert.deepEqual(native.c3, [234, 88, 226]);
  assert.deepEqual(native.c4, [130, 49, 126]);
  assert.deepEqual(native.c5, [130, 49, 126]);
  assert.equal(native.f0x, true); // Set Planner indexes flags, not their native bit positions.
  assert.equal(native.f1x, true);
  assert.equal(native.f2x, false); // Open on movement is inverse of Close while moving.
  assert.equal(native.l_aura, 0);
  assert.equal(native.l2_aura, 0);
  assert.equal(native.cyc, false);
  assert.equal(native.cycP, 10);
});

test("Rift Cape Time Dilation selects the second colour slots after the native flip interval", () => {
  const gameOptions = JSON.parse(read("../data/item-wrench-game-options.json")).items["10424"].gameOptions;
  const values = { timeDilationEnabled: true, timeDilationCycleTime: 10 };
  assert.equal(gameOptionDesign(gameOptions, values, 0), 0);
  assert.equal(gameOptionDesign(gameOptions, values, 10000), 0);
  assert.equal(gameOptionDesign(gameOptions, values, 10500), 1);
  assert.equal(gameOptionDesign(gameOptions, values, 20000), 1);
  assert.equal(gameOptionDesign(gameOptions, values, 20500), 0);
  assert.equal(gameOptionDesign(gameOptions, { ...values, timeDilationEnabled: false }, 10500), 0);
});

test("Rift Cape gameIcon tc selectors resolve to the chosen cape and collar colours", () => {
  const gameOptions = JSON.parse(read("../data/item-wrench-game-options.json")).items["10424"].gameOptions;
  const values = createItemWrenchDefaults(cape);
  values.capeColor = [11, 22, 33];
  values.collarColor = [44, 55, 66];
  values.capeColorStyle2 = [77, 88, 99];
  values.collarColorStyle2 = [111, 122, 133];
  const native = buildNativeWrenchSettings(cape, values);
  assert.deepEqual(pickedGameOptionColour(gameOptions, native, 0, 0), [11, 22, 33]);
  assert.deepEqual(pickedGameOptionColour(gameOptions, native, 1, 0), [44, 55, 66]);
  assert.deepEqual(pickedGameOptionColour(gameOptions, native, 0, 1), [77, 88, 99]);
  assert.deepEqual(pickedGameOptionColour(gameOptions, native, 1, 1), [111, 122, 133]);
});

test("per-frame Rift Cape appearance applies tc=0 cape and tc=1 collar tints without mutating reference pieces", () => {
  const gameOptions = JSON.parse(read("../data/item-wrench-game-options.json")).items["10424"].gameOptions;
  const values = createItemWrenchDefaults(cape);
  values.capeColor = [10, 20, 30];
  values.collarColor = [40, 50, 60];
  values.capeColorStyle2 = [70, 80, 90];
  values.collarColorStyle2 = [100, 110, 120];
  values.timeDilationEnabled = true;
  const referencePieces = [{ tc: 0, sx: 320 }, { tc: 1, sx: 256 }];
  const item = {
    id: 10424, wrenchDefinition: cape, wrenchGameOptions: gameOptions,
    wrenchSettings: values, pieces: referencePieces.map(piece => ({ ...piece }))
  };
  applyItemWrenchAppearance(item, 0);
  assert.deepEqual(item.pieces.map(piece => piece.t), [[10, 20, 30], [40, 50, 60]]);
  applyItemWrenchAppearance(item, 10500);
  assert.deepEqual(item.pieces.map(piece => piece.t), [[70, 80, 90], [100, 110, 120]]);
  assert.deepEqual(referencePieces, [{ tc: 0, sx: 320 }, { tc: 1, sx: 256 }]);
});

test("the application loads Wrench metadata, hydrates per-item saved values and applies live draft events", () => {
  const app = read("../js/app.js");
  const adapter = read("../demo/engine/catalog-adapter.mjs");
  assert.match(app, /item\.wrenchDefinition\s*=\s*state\.itemWrenchDefinitions/);
  assert.match(app, /item\.wrenchGameOptions\s*=\s*gameOptionsRecord\?\.gameOptions/);
  assert.match(app, /buildItemWrenchDefinitionFromVariableMap\(variableMap, raw\.id\)/);
  assert.match(app, /buildItemWrenchDefinitionFromGameOptions\(gameOptionsRecord, raw\.id\)/);
  assert.match(app, /P\.on\("item-wrench-preview", applyWrenchPreview\)/);
  assert.match(adapter, /applyItemWrenchAppearance\(item,timeMs\)/);
});


test("the recovered design cycle keeps the first look through the flip delay and honors restart swap", () => {
  const capeOptions = JSON.parse(read("../data/item-wrench-game-options.json")).items["10424"].gameOptions;
  const wingsOptions = JSON.parse(read("../data/item-wrench-game-options.json")).items["11478"].gameOptions;
  const capeValues = { timeDilationEnabled: true, timeDilationCycleTime: 10 };
  assert.equal(gameOptionDesign(capeOptions, capeValues, 10000), 0);
  assert.equal(gameOptionDesign(capeOptions, capeValues, 10500), 1);
  assert.equal(gameOptionDesign(capeOptions, capeValues, 20500), 0);

  const wingsValues = { timeDilationEnabled: true, timeDilationCycleTime: 15 };
  assert.equal(gameOptionDesign(wingsOptions, wingsValues, 15000), 0);
  assert.equal(gameOptionDesign(wingsOptions, wingsValues, 15501), 0);
  assert.equal(gameOptionDesign(wingsOptions, wingsValues, 16002), 1);
  assert.equal(gameOptionDesign(wingsOptions, wingsValues, 31503), 0);
});

test("automatic gameOptions definitions use indexed flag, design color, layer and cycle keys", () => {
  const metadata = JSON.parse(read("../data/item-wrench-game-options.json"));
  const capeGenerated = buildItemWrenchDefinitionFromGameOptions(metadata.items["10424"], 10424);
  const values = createItemWrenchDefaults(capeGenerated);
  const native = buildNativeWrenchSettings(capeGenerated, values);
  const flagControls = capeGenerated.sections[0].controls.filter(control => control.type === "checkbox");
  assert.equal(flagControls.length, 3);
  assert.equal(flagControls[0].default, true);
  assert.equal(native.f0x, true);
  assert.equal(native.f1x, true);
  assert.equal(native.f2x, false);
  assert.equal(native.cycP, 10);
  assert.equal(native.cyc, false);

  const wingsGenerated = buildItemWrenchDefinitionFromGameOptions(metadata.items["11478"], 11478);
  const colorControls = wingsGenerated.sections.flatMap(section => section.controls).filter(control => control.type === "rgb");
  assert.equal(colorControls.length, 4);
  assert.deepEqual(colorControls.map(control => control.binding.settingKeys[0]),
    ["c10244", "c10252", "c10248", "c10256"]);
});

test("authored Cape colour controls retain separate first- and second-design slots", () => {
  const controls = cape.sections.flatMap(section => section.controls);
  const byKey = key => controls.find(control => control.key === key).binding.settingKeys;
  assert.deepEqual(byKey("capeColor"), ["c2"]);
  assert.deepEqual(byKey("capeColorStyle2"), ["c3"]);
  assert.deepEqual(byKey("collarColor"), ["c4"]);
  assert.deepEqual(byKey("collarColorStyle2"), ["c5"]);
});


test("Rift Wings authored controls write each colour to its native first or second design slot", () => {
  const values = createItemWrenchDefaults(wings);
  const native = buildNativeWrenchSettings(wings, values);
  assert.deepEqual(native.c10244, [93, 22, 200]);
  assert.deepEqual(native.c10248, [137, 30, 43]);
  assert.deepEqual(native.c10252, [220, 72, 255]);
  assert.deepEqual(native.c10256, [35, 35, 63]);
  assert.equal(native.cyc, true);
  assert.equal(native.cycP, 15);
  assert.equal(native.s1, 0);
  assert.equal(native.s1b, 0);

  values.wingOpening = 1;
  const open = buildNativeWrenchSettings(wings, values);
  assert.equal(open.s1, 1);
  assert.equal(open.s1b, 1);
  values.wingOpening = 2;
  const closed = buildNativeWrenchSettings(wings, values);
  assert.equal(closed.s1, 2);
  assert.equal(closed.s1b, 2);
});

test("Rift Wings gameIcon tc colours follow the source-backed 15 second swap cycle", () => {
  const gameOptions = JSON.parse(read("../data/item-wrench-game-options.json")).items["11478"].gameOptions;
  const values = createItemWrenchDefaults(wings);
  values.style1WingColor = [1, 2, 3];
  values.style1MetalColor = [4, 5, 6];
  values.style2WingColor = [7, 8, 9];
  values.style2MetalColor = [10, 11, 12];
  const item = {
    id: 11478, wrenchDefinition: wings, wrenchGameOptions: gameOptions,
    wrenchSettings: values, pieces: [{ tc: 0 }, { tc: 1 }]
  };
  applyItemWrenchAppearance(item, 0);
  assert.deepEqual(item.pieces.map(piece => piece.t), [[1, 2, 3], [4, 5, 6]]);
  applyItemWrenchAppearance(item, 16002);
  assert.deepEqual(item.pieces.map(piece => piece.t), [[7, 8, 9], [10, 11, 12]]);
});

test("generated cycle controls honor their own names when selecting a design", () => {
  const metadata = JSON.parse(read("../data/item-wrench-game-options.json"));
  const generated = buildItemWrenchDefinitionFromGameOptions(metadata.items["11478"], 11478);
  const defaults = createItemWrenchDefaults(generated);
  assert.equal(gameOptionDesign(metadata.items["11478"].gameOptions, defaults, 16002), 1);
  defaults.cycleEnabled = false;
  assert.equal(gameOptionDesign(metadata.items["11478"].gameOptions, defaults, 16002), 0);
});


test("Rift Cape collar flag removes only the separately identified collar tc layer", () => {
  const gameOptions = JSON.parse(read("../data/item-wrench-game-options.json")).items["10424"].gameOptions;
  const values = createItemWrenchDefaults(cape);
  const item = {
    id: 10424, wrenchDefinition: cape, wrenchGameOptions: gameOptions,
    wrenchSettings: values, pieces: [{ tc: 0, sx: 320 }, { tc: 1, sx: 256 }]
  };
  applyItemWrenchAppearance(item, 0);
  assert.deepEqual(item.pieces.map(piece => piece.tc), [0, 1]);
  item.wrenchSettings = { ...values, collarEnabled: false };
  item.pieces = [{ tc: 0, sx: 320 }, { tc: 1, sx: 256 }];
  applyItemWrenchAppearance(item, 0);
  assert.deepEqual(item.pieces.map(piece => piece.tc), [0]);
});


test("favorite item boxes use fav-box.png, not the reversed box-fav.png asset", () => {
  const css = read("../css/inv.css");
  assert.match(css, /\.box\.fav-special\s*\{[^}]*background-image:\s*url\(\.\.\/img\/fav-box\.png\)/);
  assert.doesNotMatch(css, /\.box\.fav-special\s*\{[^}]*box-fav\.png/);
});

test("the item Wrench is a responsive portrait 6:19 dialog instead of a wide stretched panel", () => {
  const css = read("../css/item-wrench.css");
  const ui = read("../js/item-wrench-ui.js");
  assert.match(css, /aspect-ratio:\s*6\s*\/\s*19/);
  assert.match(ui, /const height = Math\.min\(rect\.height \* 0\.92, rect\.width \* 0\.96 \* 19 \/ 6\)/);
  assert.match(ui, /const width = height \* 6 \/ 19/);
  assert.match(ui, /--wrench-width/);
  assert.match(ui, /--wrench-height/);
  const header = css.match(/\.item-wrench-header\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.doesNotMatch(header, /border-bottom/);
});

test("Wrench descriptions stay plain, with no Properties blue code 1 prefix", () => {
  const generator = read("../src/item-wrench-variable-map.mjs");
  const css = read("../css/item-wrench.css");
  assert.match(generator, /help:\s*plainDescription\(entry\.uiDescription\)\s*\|\|\s*undefined/);
  assert.match(generator, /notes:\s*plainDescription\(record\.itemUiDescription\)/);
  assert.doesNotMatch(generator, /\x60\x31.*uiDescription/);
  assert.match(css, /\.item-wrench-note\s*\{[^}]*color:\s*#fff/);
  assert.match(css, /\.wrench-control-help\s*\{[^}]*color:\s*#fff/);
});

test("Wrench RGB inputs do not add color swatches and selects have no arrows", () => {
  const ui = read("../js/item-wrench-ui.js");
  const css = read("../css/item-wrench.css");
  assert.doesNotMatch(ui, /wrench-color-preview/);
  assert.doesNotMatch(css, /\.wrench-color-preview/);
  assert.match(css, /\.wrench-select\s*\{[^}]*appearance:\s*none/);
  assert.match(css, /-webkit-appearance:\s*none/);
});
