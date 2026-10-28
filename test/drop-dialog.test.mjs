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
test("dialog matches the reference proportions and the search-box border treatment",()=>{
  assert.match(drop,/const preview = document\.getElementById\("preview"\)/);
  assert.match(css,/width: min\(88%, 1260px, 116\.9cqh\)/);
  assert.match(css,/aspect-ratio: 565 \/ 356/);
  assert.match(css,/background: var\(--fill\)/);
  assert.match(css,/border: var\(--bd\) solid var\(--line\)/);
  assert.match(css,/box-shadow: var\(--sh\) var\(--sh\) 0 0 #000, inset var\(--sh\) var\(--sh\) 0 0 #000/);
  assert.match(css,/top: 70\.8%/);
  assert.match(css,/width: 60\.6%/);
  assert.match(css,/width: 28\.1% !important/);
  assert.match(css,/drop-title[\s\S]*text-shadow: none/);
  assert.match(css,/drop-amount[\s\S]*border: var\(--bd\) solid var\(--line\)/);
});
test("OK creates a local pickup, removes the item while dropped, and returns it after collection",()=>{
  assert.match(drop,/P\.emit\("drop-confirm", \{ item, amount \}\)/);
  assert.match(app,/P\.on\("drop-confirm"/);
  assert.match(app,/state\.pickups\.push\(pickup\)/);
  assert.match(app,/item\.gone = true/);
  assert.match(app,/pickup\.item\.gone = false/);
  assert.match(app,/P\.inv\.refresh\(\)/);
});
test("world pickup is small, level-correct, and uses the player shadow system",()=>{
  assert.match(app,/PICKUP_ATLAS_RECT, PICKUP_SIZE/);
  assert.match(app,/PLAYER_SHADOW_OPACITY/);
  assert.match(app,/PLAYER_SHADOW_COLOR/);
  assert.match(app,/playerShadowOffset\(frame\.facing/);
  assert.match(app,/pickup\.shadowCanvas/);
  assert.match(app,/drawPickups\(c, frame, ground, s, cameraPivotX, playerRect\.height\)/);
  assert.match(world,/x: 160, y: 0, width: 20, height: 20/);
  assert.match(world,/PICKUP_SIZE = 5\.5/);
  assert.match(world,/PICKUP_HOVER_HEIGHT = -17\.5/);
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
