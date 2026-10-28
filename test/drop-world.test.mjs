import test from "node:test";
import assert from "node:assert/strict";
import {
  PICKUP_ATLAS_RECT, PICKUP_SIZE, PICKUP_HOVER_HEIGHT, PICKUP_SPAWN_DURATION, PICKUP_COLLECTION_DURATION,
  PICKUP_FLOAT_AMPLITUDE, PICKUP_FLOAT_PERIOD, pickupPose, pickupShouldCollect
} from "../js/drop-world.mjs";
const sample = () => ({ spawnedAt:0, startX:0, targetX:28, startY:PICKUP_HOVER_HEIGHT-2, targetY:PICKUP_HOVER_HEIGHT, collectAt:null, collectStartX:null, collectStartY:null });

test("white pickup frame uses atlas cell X8 Y0 and a 20x20 source rect", () => {
  assert.deepEqual(PICKUP_ATLAS_RECT, {x:160,y:0,width:20,height:20});
  assert.equal(PICKUP_SIZE,6.5);
  assert.equal(PICKUP_HOVER_HEIGHT,-23.5);
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
test("collection pulls the pickup toward the player and shrinks it over time", () => {
  const pickup=sample();
  Object.assign(pickup,{collectAt:400,collectStartX:pickup.targetX,collectStartY:0});
  const beginning=pickupPose(pickup,400,{x:4,y:0});
  const middle=pickupPose(pickup,400+PICKUP_COLLECTION_DURATION/2,{x:4,y:0});
  const end=pickupPose(pickup,400+PICKUP_COLLECTION_DURATION,{x:4,y:0});
  assert.equal(beginning.scale,1);
  assert.ok(middle.scale<1 && middle.scale>0);
  assert.equal(end.scale,0);
  assert.equal(end.x,4);
  assert.equal(end.y,PICKUP_HOVER_HEIGHT);
});
test("collection starts only when the player is grounded and close enough", () => {
  const pickup=sample();
  assert.equal(pickupShouldCollect(pickup,399,{x:20,y:0,ground:true}),false);
  assert.equal(pickupShouldCollect(pickup,400,{x:20,y:-10,ground:false}),false);
  assert.equal(pickupShouldCollect(pickup,400,{x:20,y:0,ground:true}),true);
  assert.equal(pickupShouldCollect(pickup,400,{x:-20,y:0,ground:true}),false);
});
