import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const inv = read("../css/inv.css");
const base = read("../css/base.css");
const systems = read("../css/systems.css");
const dropdowns = read("../css/dropdowns.css");
const customization = read("../css/customization.css");
const mobile = read("../css/mobile.css");
const grid = read("../js/grid.js");

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
  assert.match(inv, /\.box\.tool \.ic\{inset:10\.2%;overflow:hidden\}/);
  assert.match(inv, /\.box\.tool \.ic img\{position:absolute;inset:0;width:100%;height:100%/);
  assert.doesNotMatch(inv, /\.box\.tool \.ic img\.art-wrench\{/);
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


test("every filter category label has a 1px down-right text shadow", () => {
  assert.match(inv, /\.filter-option\{[^}]*text-shadow:1px 1px 0 #000/);
  assert.doesNotMatch(inv, /\.filter-option\[aria-pressed=true\]\{[^}]*text-shadow/);
});

test("filter dropdown is hidden on Custom, Makeup, and Player Customization", () => {
  assert.match(inv, /#main\[data-t="custom"\] #filter-button/);
  assert.match(inv, /#main\[data-t="custom"\] #filter-panel/);
  assert.match(inv, /#main\[data-t="makeup"\] #filter-button/);
  assert.match(inv, /#main\[data-t="makeup"\] #filter-panel/);
  assert.match(inv, /#main\[data-t="player"\] #filter-button/);
  assert.match(inv, /#main\[data-t="player"\] #filter-panel/);
});

test("Fist and Wrench assets use the same inset footprint as inventory item thumbnails", () => {
  assert.match(inv, /\.box\.tool \.ic\{inset:10\.2%;overflow:hidden\}/);
  assert.match(inv, /\.box\.tool \.ic img\{position:absolute;inset:0;width:100%;height:100%/);
});

test("Land and Weather buttons and dropdown panels use #277D9F with white text", () => {
  assert.match(dropdowns, /background: #277D9F;\s*color: #FFFFFF;/);
  assert.match(dropdowns, /\.dd-panel \{[\s\S]*background: #277D9F;[\s\S]*color: #FFFFFF;/);
  assert.match(dropdowns, /\.dd-head strong \{ font: 700 13px\/1 var\(--font-rt\);[^}]*color:#FFFFFF/);
  assert.match(dropdowns, /\.dd-tile \{[\s\S]*background: #277D9F;[\s\S]*color: #FFFFFF;/);
});

test("the planner routes UI text to the bundled cg.ttf font", () => {
  assert.match(base, /font-family:"RTFont CenturyGothic"/);
  assert.match(base, /src:url\(\.\.\/font\/cg\.ttf\) format\("truetype"\)/);
  assert.match(base, /--font-web:"RTFont CenturyGothic",sans-serif/);
  assert.match(base, /--font-rt:"RTFont CenturyGothic",sans-serif/);
  assert.match(base, /font-synthesis:weight/);
  assert.match(systems, /font: 700 18px var\(--font-rt\)/);
  assert.match(systems, /font: 600 12px\/1 var\(--font-rt\)/);
  assert.match(customization, /font-family: var\(--font-rt\)/);
  assert.match(dropdowns, /font: 600 11px\/1 var\(--font-rt\)/);
  assert.doesNotMatch(base + systems + dropdowns + customization, /Webfont CenturyGothic|Century Gothic GT|"Century Gothic", system-ui|monospace/);
});
