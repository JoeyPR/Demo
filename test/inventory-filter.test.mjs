import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const inv = read("../css/inv.css");
const mobile = read("../css/mobile.css");
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

test("Fist and Wrench use the same icon inset as inventory item icons", () => {
  assert.match(inv, /\.box \.ic\{position:absolute;inset:10\.2%/);
  assert.match(inv, /\.box\.tool \.ic\{inset:10\.2%;overflow:visible\}/);
  assert.match(inv, /\.box\.tool \.ic img\{[\s\S]*width:118\.5%/);
  assert.match(inv, /\.box\.tool \.ic img\.art-wrench\{width:113\.6%\}/);
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

test("Makeup and Player Customization hide category filters and keep search switched off", () => {
  assert.match(inv, /#main\[data-t="player"\] #filter-button,[\s\S]*#main\[data-t="makeup"\] #filter-panel\{display:none!important\}/);
  assert.match(side, /const nonSearchableTabs = new Set\(\['custom', 'player', 'makeup'\]\)/);
  assert.match(side, /on = !!on && !nonSearchableTabs\.has\(P\.tabs\.cur\)/);
});

test("equipped artifact boxes show the dedicated chk-art checkmark", () => {
  assert.match(grid, /const ckArt = document\.createElement\('img'\); ckArt\.className = 'ck p'; ckArt\.src = 'img\/chk-art\.png'/);
  assert.match(grid, /P\.ancestralIds && P\.ancestralIds\.has\(it\.id\)/);
  assert.match(inv, /\.box\.sel \.ck\.o\{display:block\}/);
  assert.match(inv, /\.box\.sel\.art \.ck\.o\{display:none\}/);
  assert.match(inv, /\.box\.sel\.art \.ck\.p\{display:block\}/);
});

test("Fist and Wrench icon source assets are easy to locate", () => {
  assert.match(grid, /on \? 'img\/wrench-quick\.png' : 'img\/fist\.png'/);
  assert.match(grid, /function toolBox\(\)/);
});
