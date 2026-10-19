// Step 7 precondition: what are the units of motion.punch.target?
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {PreviewMotion} from "../src/motion.mjs";
import {PlayerRig} from "../src/rig.mjs";
import {PUNCH_TARGET_UNITS,aimToPunchTarget,punchTargetToParticleSpace,PARTICLE_ORIGIN} from "../src/punch-target.mjs";
const approx=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const frameWithTarget=(target)=>{const m=new PreviewMotion();m.step(16,{});return m.step(16,{punch:true,punchTarget:target}).punch;};

test("7.0 units: PUNCH_TARGET_UNITS records cell pixels, 32 per tile, origin top-left of the 32x32 cell", () => {
  assert.deepEqual(PUNCH_TARGET_UNITS,{unit:"cell-px",pxPerTile:32,origin:"cell-top-left",yAxis:"down",xSpace:"facing-local",
    yRelativeTo:"lifted-player",defaultTarget:[64,16],cell:[32,32]});
});
test("7.0 units: the motion layer stores input.punchTarget verbatim (no tile or pixel conversion) as a copy", () => {
  const input=[96,20],punch=frameWithTarget(input);
  assert.deepEqual(punch.target,[96,20]);
  input[0]=0;assert.deepEqual(punch.target,[96,20],"copied, not aliased");
});
test("7.0 units: one tile to the right of the cell origin is 32 units at any screen scale (s = 1.6, 2.6, 3, 4)", () => {
  for(const s of [1.6,2.6,3,4]) {
    const view={rootX:100,rootY:50,s},tilePx=32*s;
    const t=aimToPunchTarget({aim:{x:100+tilePx,y:50},view});
    approx(t[0],32);approx(t[1],0);
  }
});
test("7.0 units: the default target [64,16] is two tiles ahead and half a tile down in the same units", () => {
  const view={rootX:0,rootY:0,s:3};
  const t=aimToPunchTarget({aim:{x:2*32*3,y:16*3},view});
  assert.deepEqual(t.map(Math.round),PUNCH_TARGET_UNITS.defaultTarget);
});
test("7.0 units: facing -1 sends x mirrored about the 32px cell (32 - x), so the target stays facing-local", () => {
  const view={rootX:0,rootY:0,s:2};
  const right=aimToPunchTarget({aim:{x:96,y:20},view,facing:1}),left=aimToPunchTarget({aim:{x:-32,y:20},view,facing:-1});
  approx(right[0],48);approx(left[0],32-(-16));    // aim 16 cell-px left of the cell edge, mirrored: 32 - (-16) = 48
  approx(right[0],left[0]);
});
test("7.0 units: the lift is subtracted, so y is relative to the lifted player", () => {
  const t=aimToPunchTarget({aim:{x:0,y:90},view:{rootX:0,rootY:0,s:3},liftY:-10});
  approx(t[1],40);
});
test("7.0 units: the rig reads the target in the same cell pixels (shoulder 24,18): an arm aimed at [24, 18+40] points straight down", () => {
  const rig=new PlayerRig(),m=new PreviewMotion();m.step(16,{});
  const aimed=t=>{const f=m.step(16,{punch:true,punchTarget:t});return rig.update({...f,punch:{...f.punch,target:t}},16,{}).punch;};
  const down=aimed([24,58]);   // dx=0, dy=40 -> angle 0 in the rig's convention
  approx(down.angle%360,0);
  const ahead=aimed([64,18]);  // dx=40, dy=0 -> -90 -> 270
  approx(ahead.angle,270);
});
test("7.0 units: the particle origin is the cell's feet-centre (16,32): cell point [16,32] is particle-space [0,0]", () => {
  assert.deepEqual(PARTICLE_ORIGIN,[16,32]);
  assert.deepEqual(punchTargetToParticleSpace([16,32]),[0,0]);
  assert.deepEqual(punchTargetToParticleSpace([64,16]),[48,-16]);
});
test("7.0 units: the demo converts pointer aim through aimToPunchTarget (no private copy of the formula)", () => {
  const app=fs.readFileSync(new URL("../demo/app.js",import.meta.url),"utf8");
  assert.match(app,/aimToPunchTarget\(/);
  assert.doesNotMatch(app,/32-x/);
});
