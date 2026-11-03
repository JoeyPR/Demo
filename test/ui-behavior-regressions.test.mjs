import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("favorites use the Codex ID-set and favorite badge box system", () => {
  const html = read("../index.html");
  const grid = read("../js/grid.js");
  const css = read("../css/inv.css");
  assert.ok(!html.includes("js/favorites.js"));
  assert.ok(grid.includes("let favs = new Set(P.store.get('favs', []));"));
  assert.ok(grid.includes("fv.src = 'img/favorite-badge.png'"));
  assert.ok(grid.includes("P.store.set('favs', [...favs])"));
  assert.ok(grid.includes("if (favs.has(it.id)) { favs.delete(it.id)"));
  assert.ok(!grid.includes("favoriteStore"));
  assert.ok(!grid.includes("You can only favorite up to 20 items"));
  assert.ok(!grid.includes("fav-box.png"));
  assert.ok(css.includes(".box .fv{position:absolute;right:2%;top:2%;width:30%;height:30%;object-fit:contain"));
  assert.ok(css.includes(".box.fav-special{background-image:url(../img/box-fav.png)"));
});

test("Wrench uses the visible screen at 3:4 and fits button labels together", () => {
  const ui = read("../js/item-wrench-ui.js");
  const css = read("../css/item-wrench.css");
  assert.match(ui, /window\.visualViewport/);
  assert.match(ui, /const width = Math\.min\(viewWidth \* 0\.94, viewHeight \* 0\.94 \* 3 \/ 4\)/);
  assert.match(ui, /const height = width \* 4 \/ 3/);
  assert.match(css, /aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(ui, /buttonTextScale = Math\.min\(1/);
  assert.match(css, /--wrench-button-text-scale/);
});

test("Wrench opens only for an equipped selected item and warns otherwise", () => {
  const ui = read("../js/item-wrench-ui.js");
  const side = read("../js/side.js");
  assert.match(ui, /function isItemEquipped\(item\)/);
  assert.match(ui, /P\.blackbox\?\.\("Equip the item first\."/);
  assert.match(side, /function isEquipped\(item\)/);
  assert.match(side, /P\.blackbox\?\.\("Equip the item first\."/);
  assert.match(side, /P\.emit\('item-wrench-request', focused\)/);
});

test("Drop, Info and Wrench mutually close when another dialog claims the modal slot", () => {
  const drop = read("../js/drop.js");
  const info = read("../js/item-info.js");
  const wrench = read("../js/item-wrench-ui.js");
  assert.match(drop, /P\.on\("dialog-open", name => \{ if \(name !== "drop"\) close\(\); \}\)/);
  assert.match(info, /P\.on\('dialog-open',name=>\{if\(name!=='info'\)close\(\);\}\)/);
  assert.match(wrench, /P\.on\("dialog-open", name => \{/);
  assert.match(drop, /P\.emit\("dialog-open", "drop"\)/);
  assert.match(info, /P\.emit\('dialog-open','info'\)/);
  assert.match(wrench, /P\.emit\("dialog-open", "wrench"\)/);
});

test("Info uses the same top position and maximum height as Drop", () => {
  const info = read("../css/item-info.css");
  const drop = read("../css/drop.css");
  assert.match(info, /\.item-info-dialog\{top:12\.2%;max-height:75%/);
  assert.match(drop, /top:\s*12\.2%/);
  assert.match(drop, /max-height:\s*75%/);
});

test("Fist and Wrench pass through INFO rather than being blocked by the tool guard", () => {
  const side = read("../js/side.js");
  assert.match(side, /if \(b\.dataset\.a === 'info'\) \{ A\.info\(it\); return; \}/);
});

test("chat outline and shadow grow by one pixel, text has no shadow, and speech fades in 500ms", () => {
  const css = read("../css/player-chat.css");
  const js = read("../js/player-chat.js");
  assert.match(css, /border:calc\(max\(1px,var\(--bd\)\) \+ 1px\) solid #A5E3FB/);
  assert.match(css, /box-shadow:2px 2px 0 #000,inset 2px 2px 0 #000/);
  assert.match(css, /border:calc\(max\(1px,var\(--bd\)\) \+ 1px\) solid #A5E3FB/);
  assert.match(css, /box-shadow:2px 2px 0 #000,inset 2px 2px 0 #000/);
  assert.match(css, /#playerChat[\s\S]*?text-shadow:none/);
  assert.match(css, /#player-chat-bubble[\s\S]*?text-shadow:none/);
  assert.match(css, /transition:opacity 500ms/);
  assert.match(css, /transition-duration:500ms/);
  assert.match(js, /FADE_IN_MS = 500, FADE_OUT_MS = 500/);
});

test("pickup box gains two more rendered pixels", () => {
  const source = read("../js/drop-world.mjs");
  assert.match(source, /PICKUP_BOX_EXTRA_SIZE = 4/);
});


test("preview chat handle is 10 percent smaller and the topBar opens from the preview top edge", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.match(js, /source\.width \* 0\.9/);
  assert.match(js, /source\.height \* 0\.9/);
  assert.match(js, /topBar\.style\.top = area\.top \+ 'px'/);
  assert.match(css, /#topBar\{position:fixed/);
});

test("player chat has a history pane above a compact Growtopia-style input row", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.match(js, /make\('div', 'player-chat-log'\)/);
  assert.match(js, /const inputRow = make\('div', 'player-chat-input-row'\)/);
  assert.match(js, /inputRow\.className = 'player-chat-input-row panel'/);
  assert.match(js, /P\.rtfont\?\.color\('7', 'Enter a message here'\)/);
  assert.match(js, /make\('span', 'player-chat-counter', '0\/120'\)/);
  assert.match(js, /inputField\.append\(textarea, inputHint, inputText\)/);
  assert.match(js, /inputRow.append\(inputField, counter\)/);
  assert.match(js, /counter\.textContent = length \+ '\/' \+ MAX_LENGTH/);
  assert.match(js, /textarea\.maxLength = MAX_LENGTH \* 2/);
  assert.match(js, /Array\.from\(textarea\.value\)\.length/);
  assert.match(css, /#player-chat-log\{position:relative;flex:1 1 auto/);
  assert.match(css, /\.player-chat-input-row\{[^}]*height:30px/);
});

test("chat history uses fixed EST timestamps, preserves RTFont, and formats title/world roles", () => {
  const js = read("../js/player-chat.js");
  assert.match(js, /const EST_OFFSET_MS = 5 \* 60 \* 60 \* 1000/);
  assert.match(js, /P\.rtfont\?\.color\('o', '\[' \+ time \+ '\]'\)/);
  assert.match(js, /worldRole === 'owner' \? '2'/);
  assert.match(js, /worldRole === 'admin' \? '\^'/);
  assert.match(js, /isDoctor \? '4'/);
  assert.match(js, /isLegend \? '9'/);
  assert.match(js, /name \+= ' of Legend'/);
  assert.match(js, /name = \(isDoctor \? 'Dr\. ' : ''\)/);
  assert.match(js, /body\.textContent = message/);
  assert.match(js, /P\.rtfont\?\.scan\(row\)/);
  assert.match(js, /P\.rtfont\?\.hasCodes\(rawGrowId\)\) return rawGrowId/);
  assert.match(js, /const MAX_LOG_MESSAGES = 50/);
});

test("Player Customization exposes Owner/Admin rank options for chat-name color preview", () => {
  const custom = read("../js/customization.js");
  assert.match(custom, /World Rank \(Chat Preview\)/);
  assert.match(custom, /\['owner', 'World Owner'\]/);
  assert.match(custom, /\['admin', 'World Admin'\]/);
  assert.match(custom, /P\.playerChat\?\.setWorldRole\(chatWorldSelect\.value\)/);
});


test("speech chatbox auto-sizes to its text, stays centered and screen-sized independent of zoom", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.match(js, /const fontSize = 13/);
  assert.doesNotMatch(js, /P\.on\('camzoom', position\)/);
  assert.match(js, /anchor\.y - 18/);
  assert.match(js, /const x = clamp\(anchor\.x/);
  assert.match(css, /width:max-content;height:auto/);
  assert.match(css, /font:400 var\(--player-chat-font-size,13px\)/);
  assert.match(css, /max-width:min\(460px,calc\(100vw - 24px\)\)/);
  assert.match(css, /text-align:center/);
  assert.match(css, /border-radius:calc\(var\(--radius\) \+ 1px\)/);
});

test("topBar keeps its panel frame and the separate input field fills its width", () => {
  const css = read("../css/player-chat.css");
  const js = read("../js/player-chat.js");
  assert.match(js, /chatLog\.className = 'player-chat-log panel'/);
  assert.match(js, /inputRow\.className = 'player-chat-input-row panel'/);
  assert.match(css, /#player-chat-composer\{[\s\S]*?background:transparent;border:0/);
  assert.match(css, /#player-chat-log\{[\s\S]*?background:var\(--fill\);border:var\(--bd\) solid var\(--line\)/);
  assert.match(css, /\.player-chat-input-row\{[\s\S]*?width:100%[\s\S]*?height:30px/);
  assert.match(css, /#player-chat-log\{[\s\S]*?font:400 20px/);
  assert.match(css, /\.player-chat-entry\{[^}]*text-align:left/);
  assert.match(css, /#playerChat:focus-visible\{outline:none!important/);
  assert.match(css, /\.player-chat-input-field\{position:relative/);
  assert.match(css, /\.player-chat-counter\{position:static/);
});

test("live preview controls are small green Play and red two-bar Pause circles", () => {
  const js = read("../js/preview-mode.js");
  const css = read("../css/preview-mode.css");
  assert.match(js, /icon\.textContent=live\?'':'>'/);
  assert.match(js, /Pause Live Preview/);
  assert.match(js, /rect.top-height-8/);
  assert.match(js, /rect.left\+\(rect.width-width\)\/2/);
  assert.doesNotMatch(js, /live-preview-run\.png|Live Preview'<\/span>/);
  assert.match(css, /width:32px;height:32px/);
  assert.match(css, /background:#249b4b/);
  assert.match(css, /background:#d63b3b/);
  assert.match(css, /linear-gradient\(to right,#fff 0 3px,transparent 3px 8px,#fff 8px 11px\)/);
});


test("paused Preview hides player chat/menu controls and clears the live chat state", () => {
  const css = read("../css/player-chat.css");
  const js = read("../js/player-chat.js");
  assert.match(css, /body:not\(\.live-preview\) #preview-actions,[\s\S]*?body:not\(\.live-preview\) #topBar,[\s\S]*?body:not\(\.live-preview\) #player-chat-bubble\{display:none!important/);
  assert.match(css, /body:not\(\.live-preview\) #pads\{display:none!important/);
  assert.match(js, /P\.on\('preview-mode', mode => \{/);
  assert.match(js, /if \(!mode\?\.live\) \{\s*close\(\);\s*clear\(\);/);
});

test("decoded role skins and expressions are connected to the player renderer", () => {
  const custom = read("../js/customization.js");
  const renderer = read("../demo/engine/render.mjs");
  const app = read("../js/app.js");
  assert.ok(custom.includes("player_head_skin1.png"));
  assert.ok(custom.includes("player_head_skin6.png"));
  assert.ok(!custom.includes("Headless"));
  assert.ok(!custom.includes("player_head_skin9.png"));
  assert.ok(custom.includes("player_eyes3.png"));
  assert.ok(renderer.includes("player_face2.png"));
  assert.ok(renderer.includes("player_iris1.png"));
  assert.ok(app.includes("playerAppearanceVisual()"));
});


test("oversized chat text belongs to the message input, not the history panel", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.ok(js.includes("const inputText = make('span', 'player-chat-input-text')"));
  assert.ok(js.includes("inputField.append(textarea, inputHint, inputText)"));
  assert.ok(js.includes("inputText.textContent = textarea.value"));
  assert.ok(css.includes("font:400 20px/1.25 'PlayerChat CG'"));
  assert.ok(css.includes("font:400 36px/1 'PlayerChat CG'"));
  assert.ok(css.includes(".player-chat-input-text{"));
  assert.ok(css.includes(".player-chat-input-row{position:relative;display:flex;flex:0 0 30px"));
  assert.ok(css.includes(".player-chat-input-field{position:relative;flex:1 1 auto;min-width:0;height:100%;overflow:visible}"));
});

test("role skin atlases and all advanced expression layers are preloaded before player rendering", () => {
  const app = read("../js/app.js");
  assert.match(app, /const appearanceAtlases = \[/);
  assert.match(app, /map\(roleSkin => roleSkin\.head\)/);
  assert.match(app, /expression\.sheet === "player_eyes3\.png"/);
  assert.match(app, /\.\.\.names, \.\.\.appearanceAtlases/);
});

test("Duct Taped selects the Grey swatch as a persistent player skin override", () => {
  const app = read("../js/app.js");
  const renderer = read("../demo/engine/render.mjs");
  const skins = read("../js/skin-colors.js");
  assert.match(skins, /\['grey','Grey','#7F7F7F'\]/);
  assert.match(app, /SKINS\.find\(skin => skin\.id === "grey"\)/);
  assert.match(app, /skinOverride: expression\?\.name === "Duct Taped" \? DUCT_TAPED_SKIN : null/);
  assert.match(renderer, /resolveWear\(items,baseSkin=\[255,206,180,255\],skinOverride=null\)/);
  assert.match(renderer, /skin=skinOverride\?\?items\.find\(i=>i\.skin\)\?\.skin\?\?baseSkin/);
  assert.match(renderer, /resolveWear\(contributors,visual\.skin,visual\.skinOverride\)/);
  assert.match(renderer, /wear\.skinPalette=!visual\.skinOverride/);
});
