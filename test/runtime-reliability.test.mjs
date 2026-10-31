import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const core = read("../js/core.js");
const tabs = read("../js/tabs.js");
const grid = read("../js/grid.js");
const invCss = read("../css/inv.css");
const app = read("../js/app.js");
const drop = read("../js/drop.js");
const weather = read("../js/weather.js");

test("one failed event listener cannot stop the other tab and UI listeners", () => {
  assert.match(core, /for \(const f of \[\.\.\.\(ev\[n\] \|\| \[\]\)\]\)/);
  assert.match(core, /try \{ f\(d\); \}[\s\S]*catch \(error\)/);
});

test("tab visibility is changed before every tab receives its change event", () => {
  const open = tabs.slice(tabs.indexOf("open(id){"), tabs.indexOf("\n    }\n  };"));
  assert.match(open, /document\.querySelectorAll\('\.tab'\)\.forEach/);
  assert.ok(open.indexOf("grid.hidden = toolsTab") < open.indexOf("P.emit('tab', id)"));
  assert.doesNotMatch(open, /P\.\$\('\.tab'\)\.forEach/);
});

test("hidden customization tabs do not corrupt inventory virtualization metrics", () => {
  assert.match(grid, /refresh\(\)\s*\{[\s\S]*?if \(g\.hidden\) return/);
});

test("Clothing Fist/Wrench boxes focus and synchronize the quick-drawer tool", () => {
  const start = grid.indexOf("function activate(item, box)");
  const end = grid.indexOf("g.addEventListener('click'", start);
  assert.ok(start >= 0 && end > start);
  const activate = grid.slice(start, end);
  assert.ok(activate.includes("if (item.tool)"));
  assert.ok(activate.includes("P.inv.focus = item"));
  assert.ok(activate.includes("const wrenchOn = item.toolType === 'wrench'"));
  assert.ok(activate.includes("P.plateConfig.setWrenchOn(wrenchOn)"));
  assert.ok(activate.includes("P.blackbox?.(item.name, 1500, box)"));
  assert.ok(grid.includes("b.dataset.toolType === f.toolType"));
  assert.ok(grid.includes("if (!toolArmed)"));
  assert.ok(grid.includes("P.plateConfig.setWrenchOn(on)"));
  assert.ok(grid.includes("P.blackbox?.(on ? 'Wrench' : 'Fist', 1500, currentToolBox)"));
  assert.ok(invCss.includes("#grid-window .box.tool.focus{background-image:url(../img/box-blue.png)"));
  assert.ok(!invCss.includes("#grid-window .box.tool::before{display:none}"));
});

test("weather failures use a black fallback and do not disable the app", () => {
  assert.match(app, /function drawScene\(w, h\)\s*\{[\s\S]*?ctx\.fillStyle = "#000"/);
  assert.match(app, /function markWeatherFailed\(key, error\)/);
  assert.match(app, /state\.weatherFailedKey = key/);
  assert.match(app, /state\.weatherRenderer\.render\(t, hillOffsetsNow\([\s\S]*?\}\s*catch \(weatherError\)\s*\{\s*markWeatherFailed/);
  assert.doesNotMatch(app, /state\.ready = false/);
  assert.match(app, /Render warning:/);
});

test("DROP still opens if an item thumbnail fails to render", () => {
  assert.match(drop, /try \{ iconBox\.append\(P\.thumb\(item, 64\)\); \}[\s\S]*?catch \(error\)/);
  assert.match(drop, /iconBox\.textContent = \(item\.name \|\| "\?"\)\.slice/);
  assert.match(app, /P\.on\("drop-confirm", payload/);
});

test("weather picker tolerates missing IntersectionObserver and failed HTTP requests", () => {
  assert.match(weather, /'IntersectionObserver' in window \?/);
  assert.match(weather, /if \(!response\.ok\) throw new Error\("Weather config unavailable/);
  assert.match(weather, /if \(P\.weather\.key !== key\) return/);
});
