import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("favorites persist as an ID list, deduplicate, and enforce the 20-item cap", () => {
  const context = { window: { P: {} } };
  vm.runInNewContext(read("../js/favorites.js"), context);
  const favorites = context.window.P.favoriteStore;
  assert.equal(favorites.MAX_FAVORITES, 20);

  const twentyIds = Array.from({ length: 20 }, (_, index) => index + 1);
  assert.deepEqual(Array.from(favorites.normalize([...twentyIds, 2, "bad"])), twentyIds);

  const blocked = favorites.toggle(twentyIds, 21);
  assert.equal(blocked.limitReached, true);
  assert.equal(blocked.action, "limit");
  assert.deepEqual(Array.from(blocked.ids), twentyIds);

  const removed = favorites.toggle(twentyIds, 1);
  assert.equal(removed.action, "removed");
  const added = favorites.toggle(removed.ids, 21);
  assert.equal(added.action, "added");
  assert.equal(added.ids.length, 20);
  assert.equal(added.ids.at(-1), 21);
});

test("the donor ID-list favorite system is restored before inventory boot and saved on every toggle", () => {
  const html = read("../index.html");
  const grid = read("../js/grid.js");
  assert.ok(html.indexOf("js/favorites.js") < html.indexOf("js/grid.js"));
  assert.match(grid, /P\.favoriteStore\.normalize\(P\.store\.get\('favs', \[\]\)\)/);
  assert.match(grid, /P\.store\.set\('favs', result\.ids\)/);
  assert.match(grid, /You can only favorite up to 20 items/);
  assert.match(grid, /syncFlags\(\); renderQuick\(\); P\.inv\.refresh\(\)/);
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

test("player chat uses the large two-lane TopBar reference design", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.match(js, /make\('div', 'player-chat-log'\)/);
  assert.match(js, /const inputRow = make\('div', 'player-chat-input-row'\)/);
  assert.match(js, /inputRow\.className = 'player-chat-input-row panel'/);
  assert.match(js, /inputRow\.append\(textarea, inputHint, inputText, counter\)/);
  assert.match(css, /#player-chat-composer\{[\s\S]*?gap:\.55vw/);
  assert.match(css, /#player-chat-log\{[\s\S]*?font:400 clamp\(10px,2\.65vw,48px\)/);
  assert.ok(css.includes("background:var(--fill);background-image:none"));
  assert.ok(!css.includes("inset 0 0 0 .3vw #05090c"));
  assert.match(css, /\.player-chat-input-row\{[^}]*height:7\.4vw/);
});

test("chat history uses fixed EST timestamps, preserves RTFont, and formats title/world roles", () => {
  const js = read("../js/player-chat.js");
  assert.match(js, /const EST_OFFSET_MS = 5 \* 60 \* 60 \* 1000/);
  assert.match(js, /P\.rtfont\?\.color\('w', '\[' \+ time \+ '\]'\)/);
  assert.match(js, /worldRole === 'owner' \? '2'/);
  assert.match(js, /worldRole === 'admin' \? '\^'/);
  assert.match(js, /isDoctor \? '4'/);
  assert.match(js, /isLegend \? '9'/);
  assert.match(js, /name \+= ' of Legend'/);
  assert.match(js, /name = \(isDoctor \? 'Dr\. ' : ''\)/);
  assert.match(js, /body\.textContent = P\.rtfont\?\.color\(messageColor, text\) \|\| text/);
  assert.ok(js.includes("const messageColor = String(options.messageColor ?? '$')"));
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

test("TopBar uses Demo colors, thin borders, compact corners and message-sized stripes", () => {
  const css = read("../css/player-chat.css");
  assert.ok(css.includes("background:var(--fill);background-image:none"));
  assert.ok(css.includes(".player-chat-entry:nth-child(odd){background-color:rgba(123,186,210,.25)}"));
  assert.ok(!css.includes("background-size:100% 2.2em"));
  assert.ok(css.includes("background:var(--fill);background-image:none"));
  assert.ok(!css.includes("border-radius:1.6vw"));
  assert.ok(!css.includes("inset 0 0 0 .3vw #05090c"));
  assert.match(css, /\.player-chat-entry:nth-child\(odd\)\{background-color:rgba\(123,186,210,\.25\)\}/);
  assert.match(css, /\.player-chat-input-row\{[\s\S]*?height:7\.4vw/);
  assert.match(css, /\.player-chat-input-text\{[^}]*font:400 clamp\(10px,2\.65vw,48px\)/);
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


test("oversized message text stays in the input lane, not the history lane", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.ok(js.includes("const inputText = make('span', 'player-chat-input-text')"));
  assert.ok(js.includes("inputRow.append(textarea, inputHint, inputText, counter)"));
  assert.ok(js.includes("inputText.textContent = textarea.value"));
  assert.ok(css.includes("font:400 clamp(10px,2.65vw,48px)/1 'PlayerChat CG'"));
  assert.ok(css.includes(".player-chat-input-text{"));
  assert.ok(css.includes("height:7.4vw;min-height:28px;max-height:134px"));
  assert.match(css, /#player-chat-composer\{[\s\S]*?overflow:visible/);
});

test("preview menu and chat buttons use the 14eaf6 top-right placement", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.ok(js.includes("const actionWidth = actions.offsetWidth || (compactActions ? 40 : 44)"));
  assert.ok(js.includes("actions.style.left = area.right - actionWidth - gap + 'px';"));
  assert.ok(js.includes("actions.style.top = area.top + gap + 'px';"));
  assert.ok(js.includes("nextPaint(position);"));
  assert.ok(css.includes("#preview-actions{position:fixed;z-index:10"));
  assert.ok(css.includes("align-items:center;gap:5px"));
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


test("TopBar messages use Growtopia Signal lanes and default player message color $", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.ok(js.includes("signal: 'W', color: '6', includePlayerName: true"));
  assert.ok(js.includes("signal: 'S', color: 'w', includePlayerName: false"));
  assert.ok(js.includes("signal: 'B', color: '#', includePlayerName: false"));
  assert.ok(js.includes("P.rtfont?.color(signalColor, '[' + signalText + ']')"));
  assert.ok(js.includes("P.rtfont?.color('w', '[' + time + ']')"));
  assert.ok(js.includes("options.messageColor ?? '$'"));
  assert.ok(js.includes("appendChatLogMessage(text, messageAtMs, { type: 'world', messageColor: '$' })"));
  assert.ok(js.includes("P.rtfont?.color(String(options.nameBracketColor ?? '6'), '<')"));
  assert.ok(css.includes(".player-chat-signal"));
  assert.ok(css.includes("rgba(123,186,210,.25)"));
  assert.ok(css.includes(".player-chat-entry:nth-child(odd){background-color:rgba(123,186,210,.25)}"));
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

test("topBar matches the reference without oversized black strokes or inflated corners", () => {
  const css = read("../css/player-chat.css");
  const js = read("../js/player-chat.js");
  assert.match(js, /chatLog\.className = 'player-chat-log panel'/);
  assert.match(js, /inputRow\.className = 'player-chat-input-row panel'/);
  assert.match(css, /#player-chat-composer\{[\s\S]*?background:transparent;border:0/);
  assert.match(css, /#player-chat-log\{[\s\S]*?background-color:#277D9F/);
  assert.match(css, /repeating-linear-gradient\(to bottom,rgba\(123,186,210,\.25\)/);
  assert.ok(css.includes("background:var(--fill);background-image:none"));
  assert.ok(!css.includes("border-radius:1.6vw"));
  assert.ok(!css.includes("inset 0 0 0 .3vw #05090c"));
  assert.match(css, /\.player-chat-input-row\{[\s\S]*?height:7\.4vw/);
  assert.match(css, /\.player-chat-input-text\{[^}]*font:400 clamp\(10px,2\.65vw,48px\)/);
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


test("oversized message text stays in the input lane, not the history lane", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.ok(js.includes("const inputText = make('span', 'player-chat-input-text')"));
  assert.ok(js.includes("inputRow.append(textarea, inputHint, inputText, counter)"));
  assert.ok(js.includes("inputText.textContent = textarea.value"));
  assert.ok(css.includes("font:400 clamp(10px,2.65vw,48px)/1 'PlayerChat CG'"));
  assert.ok(css.includes(".player-chat-input-text{"));
  assert.ok(css.includes("height:7.4vw;min-height:28px;max-height:134px"));
  assert.match(css, /#player-chat-composer\{[\s\S]*?overflow:visible/);
});

test("preview menu and chat buttons use the 14eaf6 top-right placement", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.ok(js.includes("const actionWidth = actions.offsetWidth || (compactActions ? 40 : 44)"));
  assert.ok(js.includes("actions.style.left = area.right - actionWidth - gap + 'px';"));
  assert.ok(js.includes("actions.style.top = area.top + gap + 'px';"));
  assert.ok(js.includes("nextPaint(position);"));
  assert.ok(css.includes("#preview-actions{position:fixed;z-index:10"));
  assert.ok(css.includes("align-items:center;gap:5px"));
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




test("TopBar uses the shared Demo 75%-fill panel contract and 25% per-message stripes", () => {
  const css = read("../css/player-chat.css");
  const base = read("../css/base.css");
  assert.ok(base.includes("--fill:rgba(39,125,159,.75)"));
  assert.ok(base.includes("--line:#7BBAD2"));
  assert.ok(base.includes("border:var(--bd) solid var(--edge,var(--line))"));
  assert.ok(base.includes("border-radius:var(--radius)"));
  assert.ok(base.includes("box-shadow:var(--sh) var(--sh) 0 0 #000"));
  assert.ok(base.includes("box-shadow:inset var(--sh) var(--sh) 0 0 #000"));
  assert.ok(css.includes("background:var(--fill);background-image:none"));
  assert.ok(css.includes(".player-chat-entry:nth-child(odd){background-color:rgba(123,186,210,.25)}"));
  assert.ok(!css.includes("repeating-linear-gradient"));
  assert.ok(!css.includes("inset 0 0 0 .3vw #05090c"));
  assert.ok(!css.includes("border-radius:1.6vw"));
});

test("TopBar placeholder and typed message layer are vertically centered in the input lane", () => {
  const css = read("../css/player-chat.css");
  assert.ok(css.includes(".player-chat-placeholder{position:absolute;left:.45em;top:0;bottom:0;z-index:2;"));
  assert.ok(css.includes("display:flex;align-items:center;width:max-content;height:100%"));
  assert.ok(css.includes(".player-chat-input-text{position:absolute;left:.45em;top:0;bottom:0;z-index:3;"));
  assert.ok(css.includes("font:400 clamp(10px,2.65vw,48px)/clamp(28px,7.4vw,134px) 'PlayerChat CG'"));
});

test("GrowID plate and pickup rendering remain intact beneath the translucent TopBar", () => {
  const app = read("../js/app.js");
  const plate = read("../js/plate.js");
  const drop = read("../js/drop-world.mjs");
  assert.ok(app.includes("drawPickups(c, frame, s, cameraPivotX, cameraPivotY, zoom)"));
  assert.ok(app.includes("P.plate.draw(c, platePoint.x, platePoint.y, s * zoom, state.clock, 0.80)"));
  assert.ok(plate.includes("rgba(0,0,0,.5)"));
  assert.ok(plate.includes("img/flags/"));
  assert.ok(drop.includes("x: 160, y: 0, width: 20, height: 20"));
});
