import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=read("../index.html"),css=read("../css/drop.css"),side=read("../js/side.js"),drop=read("../js/drop.js"),app=read("../js/app.js"),world=read("../js/drop-world.mjs"),blackboxCss=read("../css/blackbox.css"),blackboxJs=read("../js/blackbox.js");

test("DROP opens a confirmation dialog for the focused item",()=>{
  assert.match(side,/P\.emit\('drop-request', it\)/);
  assert.match(drop,/P\.on\("drop-request", open\)/);
  assert.match(drop,/title\.textContent = "Drop " \+ item\.name/);
  assert.match(drop,/iconBox\.append\(P\.thumb\(item, 64\)\)/);
});
test("dialog follows text content and keeps a reference-sized starting footprint",()=>{
  assert.match(drop,/const scale = 0\.92 \* Math\.max/);
  assert.match(drop,/dialog\.style\.setProperty\("--drop-min-width"/);
  assert.match(drop,/dialog\.style\.setProperty\("--drop-max-width", rect\.width \* 0\.96/);
  assert.match(css,/max-width: min\(96%, var\(--drop-max-width, 96%\)\)/);
  assert.match(drop,/syncAmountWidth/);
  assert.match(drop,/amountInput\.style\.width/);
  assert.match(css,/width: max-content/);
  assert.match(css,/max-height: 75%/);
  assert.match(css,/overflow: auto/);
  assert.match(css,/text-align: left/);
  assert.match(css,/text-shadow: 1px 1px 0 #000/);
  assert.match(css,/background: var\(--fill\)/);
  assert.match(css,/border: var\(--bd\) solid var\(--line\)/);
  assert.match(css,/box-shadow: var\(--sh\) var\(--sh\) 0 0 #000, inset var\(--sh\) var\(--sh\) 0 0 #000/);
  assert.match(css,/drop-title[\s\S]*text-shadow: none/);
});
test("dialog buttons keep reference dimensions and amount input grows with more digits",()=>{
  assert.match(drop,/226 \* scale/);
  assert.match(drop,/104 \* scale/);
  assert.match(drop,/40 \* scale/);
  assert.match(css,/width: var\(--drop-cancel-width, 226px\)/);
  assert.match(css,/width: var\(--drop-ok-width, 104px\)/);
  assert.match(drop,/const needed = \(digits \* 33 \+ 30\) \* uiScale/);
});
test("OK creates a local pickup and restores the catalog item on collection",()=>{
  assert.match(drop,/P\.emit\("drop-confirm", \{ item, amount \}\)/);
  assert.match(app,/P\.on\("drop-confirm"/);
  assert.match(app,/state\.pickups\.push\(pickup\)/);
  assert.match(app,/item\.gone = true/);
  assert.match(app,/pickup\.item\.gone = false/);
});
test("pickup is larger, lower, closer, and uses the player shadow system",()=>{
  assert.match(world,/PICKUP_SIZE = 12/);
  assert.match(world,/PICKUP_HOVER_HEIGHT = -8\.25/);
  assert.match(world,/PICKUP_PLAYER_HALF_WIDTH = 8/);
  assert.match(world,/PICKUP_PLAYER_HEIGHT = 32 \* 0\.78/);
  assert.match(world,/playerRight >= boxLeft && playerLeft <= boxRight/);
  assert.match(world,/playerBottom >= boxTop && playerTop <= boxBottom/);
  assert.match(app,/startX: frame\.x \+ facing \* 5/);
  assert.match(app,/targetX: dropX/);
  assert.match(app,/worldX: dropX/);
  assert.match(app,/targetY: dropY/);
  assert.match(app,/worldY: dropY/);
  assert.match(app,/P\.plate\.draw\(c, platePoint\.x, platePoint\.y, s \* zoom, state\.clock, 0\.80\)/);
  assert.match(app,/P\.plate\.draw\(c, platePoint\.x, platePoint\.y, s \* zoom, state\.clock, 0\.80\)/);
  assert.ok(app.includes("PICKUP_SIZE * scale * pose.scale * zoom"));
  assert.ok(app.includes("const anchorX = cameraPivotX + (pose.x - frame.x) * scale * zoom"));
  assert.ok(app.includes("const bottomY = cameraPivotY +"));
  assert.match(app,/PLAYER_SHADOW_OPACITY/);
  assert.match(app,/PLAYER_SHADOW_COLOR/);
  assert.match(app,/playerShadowOffset\(-1\)/);
  assert.ok(app.includes("left + shadowDirection.x * zoom,"));
  assert.ok(app.includes("top + shadowDirection.y * zoom, size, size"));
  assert.ok(app.includes("pose.scale * zoom"));
});
test("pickup remains at its recorded world point until the player enters collection range",()=>{
  assert.match(world,/PICKUP_HOVER_HEIGHT = -8\.25/);
  assert.match(world,/PICKUP_PLAYER_HALF_WIDTH = 8/);
  assert.match(world,/PICKUP_PLAYER_HEIGHT = 32 \* 0\.78/);
  assert.match(world,/playerRight >= boxLeft && playerLeft <= boxRight/);
  assert.match(world,/playerBottom >= boxTop && playerTop <= boxBottom/);
  assert.match(app,/const frame = state\.lastFrame/);
  assert.match(app,/startX: frame\.x \+ facing \* 5/);
  assert.match(app,/targetX: dropX/);
  assert.match(app,/worldX: dropX/);
  assert.match(app,/targetY: dropY/);
  assert.match(app,/worldY: dropY/);
  assert.match(app,/P\.plate\.draw\(c, platePoint\.x, platePoint\.y, s \* zoom, state\.clock, 0\.80\)/);
});

test("the item is behind the pickup frame and the popup stays in the preview rectangle",()=>{
  assert.match(app,/artCtx\.drawImage\(pickup\.icon/);
  assert.match(app,/frameCtx\.drawImage\(pickupSprite/);
  assert.match(app,/artCtx\.drawImage\(icon, 0, 0\)/);
  assert.match(app,/artCtx\.drawImage\(frame, 0, 0\)/);
  assert.match(drop,/preview\.getBoundingClientRect\(\)/);
  assert.match(html,/css\/drop\.css/);
  assert.match(css,/position: fixed/);
});


test("Fist/Wrench drop attempts use the reusable blackbox above the inventory",()=>{
  assert.match(html,/css\/blackbox\.css/);
  assert.match(html,/id="blackbox" class="blackbox"/);
  assert.match(html,/js\/blackbox\.js/);
  assert.match(blackboxCss,/background:\s*rgba\(0,\s*0,\s*0,\s*\.75\)/);
  assert.doesNotMatch(blackboxCss,/box-shadow\s*:/);
  assert.match(blackboxCss,/font-family:\s*"Nameplate CG"/);
  assert.match(blackboxJs,/P\.blackbox\s*=/);
  assert.match(blackboxJs,/getBoundingClientRect/);
  assert.match(blackboxJs,/P\.\$\("#inv"\)/);
  assert.match(blackboxJs,/const handle = P\.\$\("#handle"\)/);
  assert.match(blackboxJs,/handleRect\.top - boxRect\.height - 8/);
  assert.match(blackboxJs,/inventoryRect\.left \+ inventoryRect\.width \/ 2/);
  assert.doesNotMatch(blackboxJs,/P\.on\("preview"|addEventListener\("resize"/);
  assert.match(side,/P\.blackbox\?\.\("You can't drop that\."\)/);
  assert.match(drop,/item\?\.tool[\s\S]*P\.blackbox\?\.\("You can't drop that\."\)/);
});


test("drop amount uses a regular text entry field rather than a forced numeric input",()=>{
  assert.match(drop,/amountInput\.type = "text"/);
  assert.match(drop,/amountInput\.inputMode = "text"/);
  assert.match(drop,/const rawAmount = String\(amountInput\.value \|\| ""\)\.trim\(\)/);
  assert.match(drop,/const amount = \/\^\\d\+\$\/\.test\(rawAmount\)/);
  assert.doesNotMatch(drop,/amountInput\.type = "number"|amountInput\.inputMode = "numeric"/);
  assert.match(drop,/\^\\d\+\$/);
});
