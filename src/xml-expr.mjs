// Pure, data-driven evaluator for Growtopia ItemRenderer particle/emitter property nodes.
// NO eval / Function. Every operator returns {value} or {unsupported:"reason"} - never NaN, never a silent 0.
// Node shape is the compiled IR from tools/compile-renderers.py:  {tag, a:{attrs}, v:"text", c:[children]}.
// Evidence tags in comments: [DATA] proven by shipped XML, [HYP] hypothesis that needs an in-game capture
// before the result may be called native (see PERPLEXITY_BRIEF section 6 / 12).

export const ANGLE_CONVENTION = {
  // [HYP] RandomRadial/VectorTo angles are DEGREES (strong data evidence), 0 = +x axis, increasing toward +y.
  // On a y-down canvas that is clockwise on screen. If the capture of Infinity Aura shows otherwise, flip ONE constant here.
  unit: "deg", sign: 1
};
const DEG = Math.PI / 180;

// Deterministic RNG (mulberry32). Seed per particle so the same seed always replays identically.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kids = (n, tag) => (n?.c ?? []).filter(c => !tag || c.tag === tag);
export const propNode = (parent, name) => kids(parent).find(c => c.a?.name === name);
const NUMLIST = /^\s*-?\d*\.?\d+(?:e-?\d+)?(?:\s*,\s*-?\d*\.?\d+(?:e-?\d+)?)*\s*$/i;
export const nums = s => String(s ?? "").split(",").map(x => Number(x.trim()));
export const isNumList = s => NUMLIST.test(String(s ?? ""));
export const asBool = v => v === true || (Array.isArray(v) ? false : String(v).trim().toLowerCase() === "true");
const ok = value => ({ value });
const no = reason => ({ unsupported: reason });
const bad = a => a.some(x => !Number.isFinite(x));

// Parse a literal (Set value, Select Item, Curve key component list).
export function literal(text) {
  const s = String(text ?? "").trim().replaceAll('"', "");
  if (isNumList(s)) return nums(s);
  return s;                       // strings, booleans ("true"/"false"), sprite names, enums
}

// ctx = { rng, t, inputs, resolved, env }
//   rng()      -> [0,1)
//   t          -> normalised age 0..1 [DATA: 1,042/1,048 particle Curves end at key-time 1.0]
//   inputs     -> {randomNumber?, variantId, punchCount, particleIndex, particleCounter, intervalMS}   (Select inputs [DATA])
//   resolved   -> Map(name -> number[]|string) already-evaluated sibling properties (for Multiply/Increment/VectorTo)
//   env        -> {targetPos:[x,y], targetPosOffset:[x,y], lifeTime:Number, ...}
export function curveAt(node, t) {
  const f = kids(node, "KeyFrame").map(k => nums(k.v)).filter(a => !bad(a) && a.length >= 2).sort((a, b) => a[0] - b[0]);
  if (!f.length) return no("Curve has no usable KeyFrame");
  if (t <= f[0][0]) return ok(f[0].slice(1));
  if (t >= f.at(-1)[0]) return ok(f.at(-1).slice(1));
  const i = f.findIndex(k => k[0] > t), a = f[i - 1], b = f[i], u = (t - a[0]) / (b[0] - a[0]);
  return ok(a.slice(1).map((x, j) => x + ((b[j + 1] ?? x) - x) * u));   // [HYP] linear easing
}

function numArg(raw, ctx, what) {
  if (raw === undefined) return no(`${what} missing`);
  if (isNumList(raw)) return ok(nums(raw));
  if (raw === "lifeTime") {
    const lt = ctx.resolved?.get("lifeTime")?.[0] ?? ctx.env?.lifeTime;
    return Number.isFinite(lt) ? ok([lt]) : no("lifeTime not resolved");
  }
  const r = ctx.resolved?.get(raw);
  return Array.isArray(r) ? ok(r) : no(`${what} references unresolved '${raw}'`);
}

export function evalNode(node, ctx) {
  switch (node.tag) {
    case "Set": return ok(literal(node.v));
    case "Random": {
      const lo = nums(node.a.min), hi = nums(node.a.max);
      if (bad(lo) || bad(hi)) return no("Random min/max not numeric");
      return ok(lo.map((x, i) => x + ((hi[i] ?? hi[0]) - x) * ctx.rng()));
    }
    case "Curve": return curveAt(node, ctx.t ?? 0);
    case "Select": {                                   // [HYP] index = input value modulo item count
      const items = kids(node, "Item"); if (!items.length) return no("Select has no Item");
      const input = node.a.input;
      let idx;
      if (input === "randomNumber") idx = Math.floor((ctx.inputs?.randomNumber ?? ctx.rng()) * items.length);
      else idx = Math.floor(Number(ctx.inputs?.[input]));
      if (!Number.isFinite(idx)) return no(`Select input '${input}' not available`);
      return ok(literal(items[((idx % items.length) + items.length) % items.length].v));
    }
    case "RandomRadial": {
      const ar = nums(node.a.angleRange), rr = nums(node.a.radiusRange);
      if (bad(ar) || bad(rr) || ar.length < 2 || rr.length < 2) return no("RandomRadial ranges invalid");
      let base = 0;
      if (node.a.baseAnglePosition) {                  // [HYP] angle measured from the direction to that position (+baseOffset)
        const p = ctx.env?.[node.a.baseAnglePosition]; if (!Array.isArray(p)) return no(`${node.a.baseAnglePosition} unavailable`);
        const o = node.a.baseOffset ? nums(node.a.baseOffset) : [0, 0];
        if (bad(o)) return no("baseOffset invalid");
        base = Math.atan2(p[1] + (o[1] ?? 0), p[0] + (o[0] ?? 0)) / DEG;
      }
      const ang = (base + ar[0] + (ar[1] - ar[0]) * ctx.rng()) * DEG * ANGLE_CONVENTION.sign;
      const r = rr[0] + (rr[1] - rr[0]) * ctx.rng();
      return ok([r * Math.cos(ang), r * Math.sin(ang)]);
    }
    case "Multiply": {                                  // [DATA] InfinityAura offset = initialVelocity * (0.1, 0)
      const s = ctx.resolved?.get(node.a.source); const k = nums(node.a.scale);
      if (!Array.isArray(s)) return no(`Multiply source '${node.a.source}' unresolved`);
      if (bad(k)) return no("Multiply scale invalid");
      return ok(s.map((x, i) => x * (k[i] ?? k[0])));
    }
    case "Increment": {                                 // [HYP] value = source * multiplier (AstralAura finalScale = initialScale*2.5)
      const s = ctx.resolved?.get(node.a.source); const k = nums(node.a.multiplier);
      if (!Array.isArray(s)) return no(`Increment source '${node.a.source}' unresolved`);
      if (bad(k)) return no("Increment multiplier invalid");
      return ok(s.map((x, i) => x * (k[i] ?? k[0])));
    }
    case "VectorTo": {                                  // [HYP] velocity reaching (target+offset) after `duration` seconds
      const tp = ctx.env?.[node.a.source]; if (!Array.isArray(tp)) return no(`${node.a.source} unavailable (needs a hit target)`);
      let off = [0, 0];
      if (node.a.offset) { const o = numArg(node.a.offset, { ...ctx, resolved: new Map([...(ctx.resolved ?? []), ["targetPosOffset", ctx.env?.targetPosOffset ?? [0, 0]]]) }, "offset"); if (o.unsupported) return o; off = o.value; }
      const d = numArg(node.a.duration, ctx, "duration"); if (d.unsupported) return d;
      const x = numArg(node.a.x ?? "1", ctx, "x"); if (x.unsupported) return x;
      if (!(d.value[0] > 0)) return no("VectorTo duration <= 0");
      let v = [(tp[0] + off[0]) * x.value[0] / d.value[0], (tp[1] + off[1]) * x.value[0] / d.value[0]];
      let rot = 0;
      if (node.a.angle !== undefined) { const a = numArg(node.a.angle, ctx, "angle"); if (a.unsupported) return a; rot = a.value[0]; }
      if (rot) { const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG); v = [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
      if (node.a.upSpeed !== undefined) { const u = Number(node.a.upSpeed); if (!Number.isFinite(u)) return no("upSpeed invalid"); v = [v[0], v[1] + u]; }
      const out = { value: v };
      if (node.a.angleOutVar) out.writes = { [node.a.angleOutVar]: [Math.atan2(v[1], v[0]) / DEG] };
      return out;
    }
    case "SetVar": { const s = ctx.resolved?.get(node.a.source); return Array.isArray(s) || typeof s === "string" ? ok(s) : no(`SetVar source '${node.a.source}' unresolved`); }
    default: return no(`operator <${node.tag}> not implemented`);
  }
}

const DEPENDENT = new Set(["Multiply", "Increment", "VectorTo", "SetVar"]);
// Resolve every property node of an <Emitter> or <Particle> once (at spawn). Curves are kept lazy so the caller samples them by age
// with sampleCurves(). Returns {values:Map, curves:Map, unsupported:[{name,tag,reason}]} - callers must surface `unsupported`.
export function resolveProperties(parent, ctx) {
  const values = new Map(), curves = new Map(), unsupported = [];
  const c0 = { ...ctx, resolved: values };
  const nodes = kids(parent).filter(n => n.a?.name && n.tag !== "OrbitOffset" && n.tag !== "OnFinish");
  const pending = [];
  for (const n of nodes) {
    if (n.tag === "Curve") { curves.set(n.a.name, n); continue; }
    if (DEPENDENT.has(n.tag)) { pending.push(n); continue; }
    const r = evalNode(n, c0);
    if (r.unsupported) unsupported.push({ name: n.a.name, tag: n.tag, reason: r.unsupported }); else values.set(n.a.name, r.value);
  }
  for (const [name, node] of curves) {            // Curve outputs may feed Multiply/Increment sources at t=0
    const r = curveAt(node, 0); if (!r.unsupported && !values.has(name)) values.set(name, r.value);
  }
  for (let pass = 0; pass < 4 && pending.length; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const n = pending[i], r = evalNode(n, c0);
      if (r.unsupported) { if (pass === 3) unsupported.push({ name: n.a.name, tag: n.tag, reason: r.unsupported }); continue; }
      values.set(n.a.name, r.value); for (const [k, v] of Object.entries(r.writes ?? {})) values.set(k, v);
      pending.splice(i, 1);
    }
  }
  return { values, curves, unsupported };
}
export function sampleCurves(curves, t) {
  const out = new Map();
  for (const [name, node] of curves) { const r = curveAt(node, t); if (!r.unsupported) out.set(name, r.value); }
  return out;
}
