import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PICKUP_ATLAS_RECT, PICKUP_SIZE, PICKUP_BOX_EXTRA_SIZE, PICKUP_HOVER_HEIGHT, PICKUP_SPAWN_DURATION,
  PICKUP_COLLECTION_DELAY, PICKUP_COLLECTION_DURATION, PICKUP_BOX_SHRINK_DURATION,
  PICKUP_ICON_ART_SIZE, PICKUP_DROP_VARY_MAX, PICKUP_PLAYER_HALF_WIDTH, PICKUP_PLAYER_HEIGHT,
  PICKUP_COLLECTION_TOTAL_DURATION, pickupDropVary,
  PICKUP_FLOAT_AMPLITUDE, PICKUP_FLOAT_PERIOD, pickupPose, pickupIconFlightPose, pickupShouldCollect
} from "../js/drop-world.mjs";
const sample = (worldY = 0) => ({ spawnedAt:0, startX:0, targetX:18, worldX:18, startY:worldY + PICKUP_HOVER_HEIGHT-2, targetY:worldY + PICKUP_HOVER_HEIGHT, worldY:worldY + PICKUP_HOVER_HEIGHT, collectAt:null, collectStartX:null, collectStartY:null });
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

test("the complete pickup box is two rendered pixels larger", () => {
  assert.equal(PICKUP_BOX_EXTRA_SIZE, 2);
  assert.ok(app.includes("const boxBaseSize = baseSize + PICKUP_BOX_EXTRA_SIZE;"));
  assert.ok(app.includes("const size = boxBaseSize * pose.scale;"));
});

test("white pickup frame uses atlas cell X8 Y0 and a 20x20 source rect", () => {
  assert.deepEqual(PICKUP_ATLAS_RECT, {x:160,y:0,width:20,height:20});
  assert.equal(PICKUP_SIZE,12);
  assert.equal(PICKUP_HOVER_HEIGHT,-8.25);
});
test("drop animation grows a tiny item box to full size over 400ms", () => {
  const pickup=sample();
  const first=pickupPose(pickup,0,{x:0,y:0});
  const mid=pickupPose(pickup,PICKUP_SPAWN_DURATION/2,{x:0,y:0});
  const end=pickupPose(pickup,PICKUP_SPAWN_DURATION,{x:0,y:0});
  assert.ok(first.scale>0 && first.scale<mid.scale);
  assert.ok(mid.scale<end.scale);
  assert.equal(end.scale,1);
  assert.equal(end.phase,"floating");
  assert.ok(first.x<end.x);
  const afterPlayerMoves = pickupPose(pickup,PICKUP_SPAWN_DURATION + 1000,{x:200,y:500});
  assert.equal(afterPlayerMoves.x,pickup.worldX, "settled pickup does not follow player X");
  assert.equal(afterPlayerMoves.y,pickup.worldY, "settled pickup does not follow player Y");
});
test("pickup floats continuously after its spawn animation", () => {
  const pickup=sample();
  const a=pickupPose(pickup,PICKUP_SPAWN_DURATION,{x:0,y:0});
  const b=pickupPose(pickup,PICKUP_SPAWN_DURATION+PICKUP_FLOAT_PERIOD/4,{x:0,y:0});
  const c=pickupPose(pickup,PICKUP_SPAWN_DURATION+PICKUP_FLOAT_PERIOD*3/4,{x:0,y:0});
  assert.equal(a.bob,0);
  assert.ok(b.bob>0);
  assert.ok(c.bob<0);
  assert.equal(PICKUP_FLOAT_AMPLITUDE,0.8);
});
test("collection holds the full pickup for 500ms, then shrinks it at its fixed world position", () => {
  const pickup=sample();
  Object.assign(pickup,{collectAt:400,collectStartX:pickup.targetX,collectStartY:0});

  const pause=pickupPose(pickup,400+PICKUP_COLLECTION_DELAY/2,{x:4,y:0});
  assert.equal(pause.phase,"collect-delay");
  assert.equal(pause.scale,1);
  assert.equal(pause.iconProgress,0);

  const beginning=pickupPose(pickup,400+PICKUP_COLLECTION_DELAY,{x:4,y:0});
  assert.equal(beginning.phase,"collecting");
  assert.equal(beginning.scale,1);
  assert.equal(beginning.iconProgress,0);

  const middle=pickupPose(pickup,400+PICKUP_COLLECTION_DELAY+PICKUP_COLLECTION_DURATION/2,{x:4,y:0});
  const whilePlayerMoves=pickupPose(pickup,400+PICKUP_COLLECTION_DELAY+PICKUP_COLLECTION_DURATION/2,{x:-500,y:300});
  assert.ok(middle.scale<1 && middle.scale>0);
  assert.equal(whilePlayerMoves.x,pickup.worldX);
  assert.equal(whilePlayerMoves.y,pickup.worldY);

  const end=pickupPose(pickup,400+PICKUP_COLLECTION_TOTAL_DURATION,{x:4,y:0});
  assert.equal(end.phase,"collected");
  assert.equal(end.scale,0);
  assert.equal(end.iconProgress,1);
  assert.equal(end.x,pickup.worldX);
  assert.equal(end.y,pickup.worldY);
  assert.equal(PICKUP_COLLECTION_DELAY,500);
  assert.equal(PICKUP_COLLECTION_TOTAL_DURATION,PICKUP_COLLECTION_DELAY+PICKUP_COLLECTION_DURATION);
});

test("pickup artwork retains its current size and the empty box shrinks faster than the icon flies", () => {
  assert.equal(PICKUP_ICON_ART_SIZE, 50.96);
  assert.equal(PICKUP_BOX_SHRINK_DURATION, 450);
  assert.ok(PICKUP_BOX_SHRINK_DURATION < PICKUP_COLLECTION_DURATION);

  const pickup=sample();
  Object.assign(pickup,{collectAt:100});
  const boxGone=pickupPose(pickup,100+PICKUP_COLLECTION_DELAY+PICKUP_BOX_SHRINK_DURATION,{x:0,y:0});
  assert.equal(boxGone.scale,0);
  assert.equal(boxGone.phase,"collecting");
  assert.ok(boxGone.iconProgress<1,"the icon continues traveling after the pickup frame vanishes");
});

test("the item icon jumps right, swerves left into the inventory, grows, then fades out", () => {
  const start={x:100,y:200};
  const target={x:20,y:500};
  const first=pickupIconFlightPose(start,target,0,10);
  const early=pickupIconFlightPose(start,target,0.2,10);
  const middle=pickupIconFlightPose(start,target,0.5,10);
  const late=pickupIconFlightPose(start,target,0.8,10);
  const end=pickupIconFlightPose(start,target,1,10);

  assert.equal(first.x,start.x);
  assert.equal(first.y,start.y);
  assert.equal(first.scale,1);
  assert.equal(first.alpha,1);
  assert.ok(early.x>start.x,"the icon initially jumps right out of the pickup box");
  assert.ok(middle.scale>early.scale && middle.scale>1,"the icon slowly grows during its flight");
  assert.equal(middle.alpha,1,"the icon remains visible during most of the flight");
  assert.ok(late.alpha>0 && late.alpha<1,"the icon fades as it approaches the inventory");
  assert.equal(end.x,target.x);
  assert.equal(end.y,target.y);
  assert.equal(end.scale,5);
  assert.equal(end.alpha,0);
  assert.equal(end.scale,5,"the icon scales to 5× its initial flight size");
});

test("the renderer separates the pickup frame from the flying item icon", () => {
  assert.ok(app.includes("pickup.frameCanvas = frame;"));
  assert.ok(app.includes("pickup.iconCanvas = icon;"));
  assert.ok(app.includes('const isFlying = pose.phase === "collecting";'));
  assert.ok(app.includes("pickup.frameShadowCanvas"));
  assert.ok(app.includes("pickupIconFlightPose(start, inventoryTarget, pose.iconProgress, baseSize)"));
  assert.ok(app.includes("PICKUP_ICON_ART_SIZE"));
  assert.ok(app.includes("const iconSize = PICKUP_ICON_ART_SIZE;"));
  assert.ok(app.includes("state.clock - pickup.collectAt >= PICKUP_COLLECTION_TOTAL_DURATION"));
});

test("collection starts on first contact with the pickup box, including airborne contact", () => {
  const pickup=sample();
  assert.equal(pickupShouldCollect(pickup,399,{x:18,y:0,ground:true}),false,
    "the pickup is not collidable before its spawn animation finishes");
  assert.equal(pickupShouldCollect(pickup,400,{x:18,y:-22,ground:false}),false,
    "the player's body is above the pickup box");
  assert.equal(pickupShouldCollect(pickup,400,{x:0,y:0,ground:true}),false,
    "must not collect from the original drop point when pickup is away");
  assert.equal(pickupShouldCollect(pickup,400,{x:3,y:0,ground:true}),false,
    "no collection while the player's collision bounds remain outside the box");
  assert.equal(pickupShouldCollect(pickup,400,{x:4,y:0,ground:true}),true,
    "pickup begins at the player's edge touching the box pixels");
  assert.equal(pickupShouldCollect(pickup,400,{x:12,y:0,ground:true}),true);
  assert.equal(pickupShouldCollect(pickup,400,{x:18,y:-10,ground:false}),true,
    "ground state does not block a real body/box overlap");
  assert.equal(PICKUP_PLAYER_HALF_WIDTH,8);
  assert.equal(PICKUP_PLAYER_HEIGHT,32*0.78);
});

test("dropVary stays within a five-pixel radial range", () => {
  const zero=pickupDropVary(()=>0);
  assert.deepEqual(zero,{x:0,y:0,radius:0});
  let values=[1,0];
  const maximum=pickupDropVary(()=>values.shift());
  assert.ok(Math.abs(maximum.x-5)<1e-9);
  assert.ok(Math.abs(maximum.y)<1e-9);
  assert.equal(maximum.radius,PICKUP_DROP_VARY_MAX);
});
