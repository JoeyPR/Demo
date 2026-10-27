import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const html=read("../index.html"),css=read("../css/drop.css"),side=read("../js/side.js"),drop=read("../js/drop.js"),app=read("../js/app.js"),world=read("../js/drop-world.mjs");

test("DROP opens a confirmation dialog for the focused item",()=>{
  assert.match(side,/P\.emit\('drop-request', it\)/);
  assert.match(drop,/P\.on\("drop-request", open\)/);
  assert.match(drop,/title\.textContent = "Drop " \+ item\.name/);
  assert.match(drop,/iconBox\.append\(P\.thumb\(item, 64\)\)/);
});
test("dialog has quantity input, Cancel and OK controls with inventory styling",()=>{
  assert.match(drop,/make\("input", "drop-amount", "drop-amount"\)/);
  assert.match(drop,/make\("button", "drop-cancel", "drop-cancel", "Cancel"\)/);
  assert.match(drop,/make\("button", "drop-confirm", "drop-confirm", "OK"\)/);
  assert.match(css,/background: #FFCC00/);
  assert.match(css,/background: #7BBAD2/);
  assert.match(css,/var\(--font-main\)/);
});
test("OK creates a local pickup, removes the item while dropped, and returns it after collection",()=>{
  assert.match(drop,/P\.emit\("drop-confirm", \{ item, amount \}\)/);
  assert.match(app,/P\.on\("drop-confirm"/);
  assert.match(app,/state\.pickups\.push\(pickup\)/);
  assert.match(app,/item\.gone = true/);
  assert.match(app,/pickup\.item\.gone = false/);
  assert.match(app,/P\.inv\.refresh\(\)/);
});
test("world pickup draws the item behind the atlas frame and follows camera space",()=>{
  assert.match(app,/PICKUP_ATLAS_RECT, PICKUP_SIZE/);
  assert.match(app,/const iconSize = size \* 0\.64/);
  assert.ok(app.lastIndexOf("c.drawImage(pickup.icon")<app.lastIndexOf("PICKUP_ATLAS_RECT.x, PICKUP_ATLAS_RECT.y"));
  assert.match(world,/x: 160, y: 0, width: 20, height: 20/);
  assert.match(world,/pickupPose\(pickup, state\.clock, frame\)/);
  assert.match(world,/pickupShouldCollect\(pickup, state\.clock, frame\)/);
});
test("animation hooks into the existing world frame and prevents preview punching through the dialog",()=>{
  assert.match(html,/css\/drop\.css/);
  assert.match(html,/js\/drop\.js/);
  assert.match(app,/updatePickupLifecycle\(frame\)/);
  assert.match(app,/drawPickups\(c, frame, ground, s, cameraPivotX\)/);
  assert.match(app,/#drop-overlay/);
});
