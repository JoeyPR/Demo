import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const inv = read("../css/inv.css");
const mobile = read("../css/mobile.css");
const grid = read("../js/grid.js");
const base = read("../css/base.css");
const dropdowns = read("../css/dropdowns.css");
const customization = read("../css/customization.css");
const systems = read("../css/systems.css");
const plate = read("../js/plate.js");

test("top drawer handle is a child of the drawer and does not apply a second drawer offset", () => {
  const topSection = html.slice(html.indexOf('<div id="top"'), html.indexOf("<!-- 3. TABS -->"));
  assert.ok(topSection.indexOf('id="handle"') > topSection.indexOf('id="quick"'));
  assert.match(topSection, /id="top"[\s\S]*id="handle"[\s\S]*<\/div>\s*<\/div>\s*$/);
  assert.doesNotMatch(inv, /#top,#handle,#tabs,#main,#side\s*\{/);
  assert.match(inv, /#handle\{left:calc\(181\.2\*var\(--u\)\);top:calc\(-66\.9\*var\(--u\)\)/);
  assert.match(mobile, /#handle\{left:calc\(160\*var\(--u\)\);top:calc\(-96\*var\(--u\)\)/,
    "mobile handle preserves its intended stage position after being nested in #top");
});

test("Fist and Wrench use the same icon inset as inventory item icons", () => {
  assert.match(inv, /\.box \.ic\{position:absolute;inset:10\.2%/);
  assert.match(inv, /\.box\.tool \.ic\{inset:10\.2%;overflow:visible\}/);
  assert.match(inv, /\.box\.tool \.ic img\{[\s\S]*width:100%;height:100%/);
  assert.doesNotMatch(inv, /\.box\.tool \.ic img\.art-wrench\{width:/);
});

test("search row reserves room for a matching square filter button on desktop and mobile", () => {
  assert.match(html, /id="filter-button"/);
  assert.match(html, /id="filter-panel"/);
  assert.match(inv, /#q\{[^}]*width:calc\(1470\*var\(--u\)\);height:calc\(57\.7\*var\(--u\)\)/);
  assert.match(inv, /#filter-button\{[^}]*width:calc\(57\.7\*var\(--u\)\);height:calc\(57\.7\*var\(--u\)\)/);
  assert.match(mobile, /#q\{[^}]*width:calc\(471\*var\(--u\)\);height:calc\(67\*var\(--u\)\)/);
  assert.match(mobile, /#filter-button\{[^}]*width:calc\(67\*var\(--u\)\);height:calc\(67\*var\(--u\)\)/);
  assert.match(inv, /border-top:calc\(13\*var\(--u\)\) solid #dfdfdf/);
});

test("filter categories are derived from catalog item slots and filter the visible grid", () => {
  assert.match(grid, /const bySlot = new Map\(\)/);
  assert.match(grid, /const names = P\.dat\?\.slots \|\| \{\}/);
  assert.match(grid, /\.\.\.\[\.\.\.bySlot\.values\(\)\]\.sort/);
  assert.match(grid, /activeFilter === 'all' \|\| String\(it\.slot\) === activeFilter/);
  assert.match(grid, /P\.store\.set\('filterCategory', activeFilter\)/);
  assert.match(grid, /setFilterOpen\(filterPanel\.hidden\)/);
  assert.match(grid, /e\.key === 'Escape'/);
});


test("scrolling keeps overlapping inventory item boxes mounted to prevent icon flicker", () => {
  assert.match(grid, /const mounted = new Map\(\)/);
  assert.match(grid, /let b = mounted\.get\(idx\)/);
  assert.match(grid, /win\.insertBefore\(b, current \|\| null\)/);
  assert.doesNotMatch(grid, /new IntersectionObserver|function unfillBox|releaseWindow/);
});

test("filter menu uses requested category labels and selected highlight", () => {
  assert.doesNotMatch(grid, /CLOTHING CATEGORY|filter-heading/);
  assert.match(grid, /Hat: 'Hats', Shirt: 'Shirts', Hair: 'Hairs', Ancestral: 'Artifacts'/);
  assert.match(inv, /filter-option\[aria-pressed=true\]\{background:#A5E3FB;color:#FFFFFF/);
});

test("inventory icons appear at full opacity with no scrolling fade or scale transition", () => {
  assert.match(inv, /#grid-window \.box \.ic,#grid-window \.box \.n\{opacity:1;transform:none;transition:none\}/);
  assert.doesNotMatch(inv, /#grid-window \.box \.ic,#grid-window \.box \.n\{opacity:0/);
  assert.doesNotMatch(inv, /transition:opacity \.18s ease-out,transform/);
});


test("filter category labels use the 1px down-right shadow in every state", () => {
  assert.match(inv, /\.filter-option\{[^}]*text-shadow:1px 1px 0 #000/);
  assert.match(inv, /\.filter-option\[aria-pressed=true\]\{background:#A5E3FB;color:#FFFFFF\}/);
  assert.doesNotMatch(inv.match(/\.filter-option\[aria-pressed=true\]\{([^}]*)\}/)?.[1] ?? "", /text-shadow/);
});

test("filter box is hidden on Custom, Makeup, and Player Customization tabs", () => {
  assert.match(inv, /#main\[data-t="custom"\] #filter-button,#main\[data-t="custom"\] #filter-panel,[\s\S]*#main\[data-t="player"\] #filter-button,#main\[data-t="player"\] #filter-panel,[\s\S]*#main\[data-t="makeup"\] #filter-button,#main\[data-t="makeup"\] #filter-panel\{display:none!important\}/);
});

test("Land and Weather panels use the planner blue and white text", () => {
  assert.match(dropdowns, /\.dd-btn\s*\{[\s\S]*background: #277D9F;[\s\S]*color: #fff/);
  assert.match(dropdowns, /\.dd-panel\s*\{[\s\S]*background: #277D9F;[\s\S]*color: #fff/);
  assert.match(dropdowns, /\.dd-head\s*\{[\s\S]*background: #277D9F/);
  assert.match(dropdowns, /\.dd-head select\s*\{[\s\S]*background: #277D9F; color: #fff/);
  assert.match(dropdowns, /\.dd-tile\s*\{[\s\S]*color: #fff/);
  assert.match(dropdowns, /\.dd-btn:hover\s*\{ background: #277D9F; color: #fff; \}/);
});

test("all website text uses RTFont Century Gothic", () => {
  assert.match(base, /font-family:"RTFont CenturyGothic"/);
  assert.match(base, /body\{[^}]*var\(--font-rt\)/);
  assert.doesNotMatch(base, /Webfont CenturyGothic|--font-web/);
  assert.doesNotMatch(systems, /@font-face|Century Gothic GT|monospace|system-ui/);
  assert.doesNotMatch(dropdowns, /Century Gothic["']|system-ui|monospace/);
  assert.doesNotMatch(customization, /ui-monospace|SFMono-Regular|Menlo|Consolas/);
  assert.doesNotMatch(plate, /Century Gothic GT|Century Gothic', sans-serif/);
  assert.match(plate, /'RTFont CenturyGothic'/);
});
