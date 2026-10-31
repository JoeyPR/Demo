import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const inv = read("../css/inv.css");
const mobile = read("../css/mobile.css");
const base = read("../css/base.css");
const dropdowns = read("../css/dropdowns.css");
const systems = read("../css/systems.css");
const customization = read("../css/customization.css");
const plate = read("../js/plate.js");
const grid = read("../js/grid.js");
const side = read("../js/side.js");

test("top drawer handle is a child of the drawer and does not apply a second drawer offset", () => {
  const topSection = html.slice(html.indexOf('<div id="top"'), html.indexOf("<!-- 3. TABS -->"));
  assert.ok(topSection.indexOf('id="handle"') > topSection.indexOf('id="quick"'));
  assert.match(topSection, /id="top"[\s\S]*id="handle"[\s\S]*<\/div>\s*<\/div>\s*$/);
  assert.doesNotMatch(inv, /#top,#handle,#tabs,#main,#side\s*\{/);
  assert.match(inv, /#handle\{left:calc\(181\.2\*var\(--u\)\);top:calc\(-66\.9\*var\(--u\)\)/);
  assert.match(mobile, /#handle\{left:calc\(160\*var\(--u\)\);top:calc\(-96\*var\(--u\)\)/,
    "mobile handle preserves its intended stage position after being nested in #top");
});

test("Fist and Wrench use the same icon area and scale as inventory item icons", () => {
  assert.match(inv, /\.box \.ic\{position:absolute;inset:10\.2%/);
  assert.match(inv, /\.box\.tool \.ic\{inset:8%;overflow:hidden\}/);
  assert.match(inv, /\.box\.tool \.ic img\{width:calc\(100% \+ 2px\);height:calc\(100% \+ 2px\);max-width:none;object-fit:contain;image-rendering:pixelated;flex:none\}/);
  assert.doesNotMatch(inv, /width:calc\((118\.5|113\.6)% - 2px\)/);
});

test("search row reserves room for a matching square filter button on desktop and mobile", () => {
  assert.match(html, /id="filter-button"/);
  assert.match(html, /id="filter-panel"/);
  assert.match(inv, /#q\{[^}]*width:calc\(1470\*var\(--u\)\);height:calc\(57\.7\*var\(--u\)\)/);
  assert.match(inv, /#filter-button\{[^}]*width:calc\(57\.7\*var\(--u\)\);height:calc\(57\.7\*var\(--u\)\)/);
  assert.match(mobile, /#q\{[^}]*width:calc\(471\*var\(--u\)\);height:calc\(67\*var\(--u\)\)/);
  assert.match(mobile, /#filter-button\{[^}]*width:calc\(67\*var\(--u\)\);height:calc\(67\*var\(--u\)\)/);
  assert.match(inv, /border-top:calc\(16\*var\(--u\)\) solid #dfdfdf/);
});

test("search enablement is synchronized with the grid before filtering", () => {
  assert.ok(side.includes("P.store.set('searchOn', on);"));
  assert.ok(side.includes("P.emit('searchOn', on);"));
  assert.ok(side.indexOf("P.store.set('searchOn', on);") < side.indexOf("P.emit('searchOn', on);"));

  const listenerStart = grid.indexOf("P.on('searchOn', on => {");
  const listenerEnd = grid.indexOf("\n  });", listenerStart);
  assert.ok(listenerStart >= 0 && listenerEnd > listenerStart, "grid listens for search-state updates");
  const listener = grid.slice(listenerStart, listenerEnd);
  assert.ok(listener.includes("searchOn = on;"));
  assert.ok(listener.includes("P.inv.refresh();"));
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


test("filter arrow is larger and the panel keeps both inner and outer shadows", () => {
  assert.match(inv, /#filter-button span\{[^}]*border-left:calc\(15\*var\(--u\)\) solid transparent;[\s\S]*border-right:calc\(15\*var\(--u\)\) solid transparent;border-top:calc\(16\*var\(--u\)\)/);
  const panel = inv.match(/#filter-panel\{([^}]*)\}/)?.[1] ?? "";
  assert.match(panel, /box-shadow:inset var\(--sh\) var\(--sh\) 0 rgba\(0,0,0,\.32\),var\(--sh\) var\(--sh\) 0 #000/);
});

test("Custom, Makeup, and Player Customization keep a visible but disabled filter control", () => {
  assert.match(grid, /const filterDisabledTabs = new Set\(\['custom', 'player', 'makeup'\]\)/);
  assert.match(grid, /filterButton\.disabled = disabled/);
  assert.match(grid, /if \(disabled\) setFilterOpen\(false\)/);
  assert.match(inv, /#filter-button:disabled\{opacity:\.5;cursor:default;pointer-events:none\}/);
  assert.doesNotMatch(inv, /#main\[data-t="player"\] #filter-button,[\s\S]*display:none!important/);
  assert.match(side, /const nonSearchableTabs = new Set\(\['custom', 'player', 'makeup'\]\)/);
  assert.match(side, /on = !!on && !nonSearchableTabs\.has\(P\.tabs\.cur\)/);
});

test("all items in the Artifacts category use artifact boxes only while equipped", () => {
  assert.ok(grid.includes("const artifactSlot = Object.entries(P.dat?.slots || {})"));
  assert.ok(grid.includes("label === 'Ancestral' || label === 'Artifacts'"));
  assert.ok(grid.includes("const isArtifactItem = item => item != null && String(item.slot) === String(artifactSlot);"));
  assert.ok(grid.includes("b.classList.toggle('art', equipped && String(b.dataset.slot) === String(artifactSlot));"));
  assert.ok(grid.includes("b.classList.toggle('art', equippedIds.has(it.id) && isArtifactItem(it));"));
  assert.ok(!grid.includes("equipped && !!P.ancestralIds?.has(id)"));
  assert.ok(!grid.includes("equippedIds.has(it.id) && !!P.ancestralIds?.has(it.id)"));
  assert.ok(inv.includes(".box.art{background-image:url(../img/box-art.png)}"));
  assert.ok(inv.includes(".box.sel .ck.o{display:block}"));
  assert.ok(inv.includes(".box.sel.art .ck.o{display:none}"));
  assert.ok(inv.includes(".box.sel.art .ck.p{display:block}"));
});

test("Fist and Wrench icon source assets are easy to locate", () => {
  assert.match(grid, /on \? 'img\/wrench-quick\.png' : 'img\/fist\.png'/);
  assert.match(grid, /function toolBox\(\)/);
});


test("equipped items are kept out of the three top-drawer item boxes", () => {
  const start = grid.indexOf("function renderQuick()");
  const end = grid.indexOf("/* mark the focused box", start);
  assert.ok(start >= 0 && end > start, "quick drawer renderer exists");
  const quick = grid.slice(start, end);
  assert.match(quick, /quick\.append\(toolBox\(\)\)/);
  assert.match(quick, /for \(let i = 0; i < 3; i\+\+\)/);
  assert.match(quick, /className = 'box reg empty qbox'/);
  assert.doesNotMatch(quick, /const eq =|map\(id => P\.inv\.itemById|boxEl\(it\)/);
});

test("selected filter option text has a 1px bottom-right shadow", () => {
  assert.match(inv, /\.filter-option\[aria-pressed=true\]\{[^}]*text-shadow:1px 1px 0 #000/);
});

test("main_cg.ttf is the shared font across the planner UI", () => {
  assert.equal(existsSync(new URL("../font/main_cg.ttf", import.meta.url)), true);
  assert.equal(existsSync(new URL("../font/cg.ttf", import.meta.url)), false);
  assert.equal(existsSync(new URL("../font/plate.ttf", import.meta.url)), false);
  assert.match(base, /src:url\(\.\.\/font\/main_cg\.ttf\)/);
  assert.match(base, /--font-main:"Main CG",sans-serif/);
  assert.match(plate, /px 'Nameplate CG', sans-serif/);
  assert.doesNotMatch([base, dropdowns, systems, customization, plate].join("\n"),
    /font\/(?:cg|plate)\.ttf|"Century Gothic", system-ui|Century Gothic GT|ui-monospace/);
});

test("Land and Weather buttons use the requested blue panel and white text", () => {
  assert.match(dropdowns, /\.dd-btn \{[\s\S]*?background: #277D9F;[\s\S]*?color: #fff;/);
  assert.match(dropdowns, /\.dd-btn:hover \{ background: #277D9F; color: #fff; \}/);
});


test("Fist and Wrench are regular Clothing boxes inserted immediately before Shades",()=>{
  assert.match(grid,/const CLOTHING_TOOLS = \[/);
  assert.match(grid,/name: 'Fist'[\s\S]*toolImage: 'img\/fist\.png'/);
  assert.match(grid,/name: 'Wrench'[\s\S]*toolImage: 'img\/wrench-quick\.png'/);
  assert.match(grid,/const shadesIndex = catalogItems\.findIndex/);
  assert.match(grid,/catalogItems\.splice\(shadesIndex < 0 \? 0 : shadesIndex, 0, \.\.\.CLOTHING_TOOLS\)/);
  assert.match(grid,/b\.className = 'box' \+ \(it\.tool \? ' reg tool' : ''\)/);
  assert.match(grid,/P\.plateConfig\.setWrenchOn\(wrenchOn\)/);
  assert.match(grid,/!categoryFilterActive \|\| it\.tool \|\| activeFilter === 'all'/);
});
