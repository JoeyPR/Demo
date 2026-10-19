import test from "node:test";
import assert from "node:assert/strict";
import {evalNode, makeRng, resolveProperties, sampleCurves, curveAt} from "../src/xml-expr.mjs";
const n = (tag, a = {}, v = "", c = []) => ({tag, a, v, c});
const ctx = (extra = {}) => ({rng: makeRng(7), t: 0, inputs: {}, resolved: new Map(), env: {}, ...extra});

test("RandomRadial stays inside angleRange x radiusRange and is seed-deterministic", () => {
  const node = n("RandomRadial", {name: "initialVelocity", angleRange: "230,310", radiusRange: "150,200"});
  const rng = makeRng(99);
  for (let i = 0; i < 10000; i++) {
    const {value} = evalNode(node, ctx({rng}));
    const r = Math.hypot(...value), a = ((Math.atan2(value[1], value[0]) * 180 / Math.PI) + 360) % 360;
    assert.ok(r >= 150 - 1e-9 && r <= 200 + 1e-9);
    assert.ok(a >= 230 - 1e-9 && a <= 310 + 1e-9);
  }
  assert.deepEqual(evalNode(node, ctx({rng: makeRng(5)})).value, evalNode(node, ctx({rng: makeRng(5)})).value);
});

test("RandomRadial with baseAnglePosition needs targetPos, else explicit unsupported (never NaN)", () => {
  const node = n("RandomRadial", {name: "initialVelocity", angleRange: "-5,5", radiusRange: "150,200", baseAnglePosition: "targetPos", baseOffset: "0,16"});
  assert.match(evalNode(node, ctx()).unsupported, /targetPos unavailable/);
  assert.ok(evalNode(node, ctx({env: {targetPos: [100, 0]}})).value.every(Number.isFinite));
});

test("Multiply: InfinityAura offset = initialVelocity * (0.1, 0)", () => {
  const parent = n("Particle", {}, "", [
    n("Set", {name: "initialVelocity"}, "100, 40"),
    n("Multiply", {name: "offset", source: "initialVelocity", scale: "0.1,0"})]);
  const {values, unsupported} = resolveProperties(parent, ctx());
  assert.deepEqual(unsupported, []);
  assert.deepEqual(values.get("offset"), [10, 0]);
});

test("Increment resolves dependency regardless of document order: finalScale = initialScale * 2.5", () => {
  const parent = n("Particle", {}, "", [
    n("Increment", {name: "finalScale", source: "initialScale", multiplier: "2.5,2.5"}),
    n("Set", {name: "initialScale"}, "2, 4")]);
  assert.deepEqual(resolveProperties(parent, ctx()).values.get("finalScale"), [5, 10]);
});

test("Unresolvable dependency is reported, not zeroed", () => {
  const parent = n("Particle", {}, "", [n("Multiply", {name: "offset", source: "missing", scale: "1,1"})]);
  const r = resolveProperties(parent, ctx());
  assert.equal(r.values.has("offset"), false);
  assert.equal(r.unsupported[0].name, "offset");
});

test("Curve is piecewise linear over normalised age and clamps", () => {
  const c = n("Curve", {name: "initialScale"}, "", [n("KeyFrame", {}, "0, 0.8, 0.8"), n("KeyFrame", {}, "1, 1.2, 1.2")]);
  assert.deepEqual(curveAt(c, 0).value, [0.8, 0.8]);
  assert.ok(Math.abs(curveAt(c, 0.5).value[0] - 1.0) < 1e-12);
  assert.deepEqual(curveAt(c, 2).value, [1.2, 1.2]);
  assert.deepEqual(sampleCurves(new Map([["initialScale", c]]), 0.25).get("initialScale").map(x => +x.toFixed(6)), [0.9, 0.9]);
});

test("Select indexes by its declared input (punchCount, particleIndex, variantId) with modulo; randomNumber uses rng", () => {
  const sel = input => n("Select", {name: "offset", input}, "", [n("Item", {}, "-40, -36"), n("Item", {}, "40, -36"), n("Item", {}, "0, -46")]);
  assert.deepEqual(evalNode(sel("punchCount"), ctx({inputs: {punchCount: 1}})).value, [40, -36]);
  assert.deepEqual(evalNode(sel("particleIndex"), ctx({inputs: {particleIndex: 5}})).value, [0, -46]);
  assert.match(evalNode(sel("variantId"), ctx()).unsupported, /not available/);
  assert.ok(evalNode(sel("randomNumber"), ctx()).value.length === 2);
});

test("VectorTo reaches targetPos at t = duration when nothing else moves it", () => {
  const node = n("VectorTo", {name: "initialVelocity", source: "targetPos", duration: "lifeTime", x: "1"});
  const env = {targetPos: [120, -60], lifeTime: 0.5};
  const {value} = evalNode(node, ctx({env}));
  assert.ok(Math.abs(value[0] * env.lifeTime - 120) < 1e-9 && Math.abs(value[1] * env.lifeTime + 60) < 1e-9);
  assert.match(evalNode(node, ctx({env: {lifeTime: 1}})).unsupported, /targetPos unavailable/);
});

test("unknown operator is an explicit coverage warning", () => {
  assert.match(evalNode(n("Wobble", {name: "x"}), ctx()).unsupported, /not implemented/);
});
