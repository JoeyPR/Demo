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
  assert.match(open, /grid\.hidden = toolsTab/);
  assert.match(open, /tools\.hidden = !toolsTab/);
  assert.ok(open.indexOf("grid.hidden = toolsTab") < open.indexOf("P.emit('tab', id)"));
  assert.match(open, /P\.\$\$\('\.tab'\)\.forEach/);
  assert.doesNotMatch(open, /P\.\$\('\.tab'\)\.forEach/);
});

test("hidden customization tabs do not corrupt inventory virtualization metrics", () => {
  assert.match(grid, /refresh\(\)\s*\{[\s\S]*?if \(g\.hidden\) return/);
});

test("Clothing Fist/Wrench boxes immediately apply the tool without focus state", () => {
  const start = grid.indexOf("function activate(item)");
  const end = grid.indexOf("\n  }\n\n  g.addEventListener('click'", start);
  assert.ok(start >= 0 && end > start);
  const activate = grid.slice(start, end);
  assert.match(activate, /if \(item\.tool\)/);
  assert.match(activate, /P\.inv\.focus = null/);
  assert.match(activate, /const wrenchOn = item\.toolType === 'wrench'/);
  assert.match(activate, /P\.plateConfig\.setWrenchOn\(wrenchOn\)/);
  const toolBranch = activate.slice(
    activate.indexOf("if (item.tool)"),
    activate.indexOf("\n    }\n    toolArmed = false")
  );
  assert.doesNotMatch(toolBranch, /P\.inv\.focus = item/);

  const focusStart = grid.indexOf("function markFocus()");
  const focusEnd = grid.indexOf("\n  }", focusStart);
  const focus = grid.slice(focusStart, focusEnd);
  assert.match(focus, /!b\.classList\.contains\('tool'\)/);
  assert.match(invCss, /#grid-window \.box\.tool\{background-image:url\(\.\.\/img\/box-blue\.png\)\}/);
  assert.match(invCss, /#grid-window \.box\.tool::before\{display:none\}/);
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
