// Set Planner GT pet engine port. Source-assisted reference, NOT an official
// Growtopia client reconstruction.
//
// Evidence: research/pet-engine-reference.js (extracted verbatim from the
// deobfuscated SetPlannerGT bundle in JoeyPR/Website app.js). Every constant,
// kind table, movement rule and cell-selection rule below is a direct port of
// that reference; the integration layer (advancePet) adapts the engine to this
// repo's piece model. See PET_SYSTEM_REVISION.md for the mapping notes.

// ---- Engine constants (reference: EO table) ----
export const PET = Object.freeze({
  TICK: 1 / 60, TRAIL: 20, BEHIND: 16, HALVE: 20, TRAIL_SPEED: 350, TRAIL_SNAP: 60,
  BOX: 32, PUSH: 800, SIDE: 80, JITTER: 30, MAX: 250, FACE_V: 5, FLY_SNAP: 350,
  FLY_FAR: 100, DRIFT: 20, STILL_FAST: 40, STILL_SLOW: 100, WANDER: 60,
  HOVER_AT: [16, -8], HOVER_MIN: 90, HOVER_DAMP: 40, HOVER_NEAR: 16,
  HOVER_JITTER: 120, HOVER_MAX: 32, HOVER_SNAP: 800, HOVER_TURN: 0.5,
});
const HEAD = 30; // j0: head height, reference line 2839.

// ---- Kind tables (reference: Eb / l8 / d8(ED) / n8(Ed) / En / Ex / Eh / N5) ----
// Movement kind 1..38 per item id (Eb inverted). Kind 0 (absent) follows the
// trail table. Kind 200 = machine pet, 100 = hidden.
const KIND_LISTS = {
  1: [882, 900, 1228, 1232, 1378, 1576, 1868, 1998, 2212, 2450, 3430, 4340, 4528, 5642, 7136, 7748, 7750, 7754, 7758, 7760, 7998, 9048, 9068, 9086, 9254, 9654, 9714, 10998, 11284, 11874, 12232, 12288, 12850, 13220, 14632, 14916, 15082, 15278, 15394, 15518, 16052, 16230],
  2: [1014], 3: [1180, 1440, 1760, 2224, 15344, 15474], 4: [1376, 1670, 2762, 4476],
  5: [1540, 2484, 7206, 7648, 14750], 6: [1534], 7: [1552, 2222, 2494, 3216],
  8: [1742, 2702, 5480, 7430, 8894, 9062, 9084, 9192, 10050, 10128, 10454, 10506, 10600, 10602, 10604, 10606, 10608, 10610, 10612, 10614, 10624, 10728, 10994, 10996, 11000, 11078, 11080, 11082, 11460, 11534, 11620, 11712, 11764, 11788, 12178, 12284, 12290, 12416, 13064, 13270, 13272, 13274, 13276, 13326, 13576, 13696, 13698, 13700, 13702, 13704, 13706, 13832, 14002, 14036, 14188, 14430, 14508, 14562, 14568, 14704, 14748, 14754, 14816, 14980, 15148, 15496, 15526, 15664, 15870, 16008, 16432],
  9: [1782], 10: [1952], 11: [1968, 3678, 4362, 5546, 5550, 5556, 5564, 5568, 5578, 5586, 5588, 5590, 5592, 5594, 5596, 5598, 5600, 5736, 5986, 6106, 6318, 7060, 7132, 7134, 7468],
  12: [1986], 13: [2240], 14: [2278], 15: [2422], 16: [2512], 17: [2854],
  18: [2878, 2880, 6670], 19: [3238], 20: [3396, 4374, 4608],
  21: [3632, 3634, 3636, 3638, 3640, 3642, 3644, 3646, 3648], 22: [3680, 3686],
  23: [3738], 24: [3886, 4110, 4252],
  25: [3952, 3960, 3968, 3976, 3984, 3992, 4000, 4008, 4016, 4024, 4032, 4040, 4048, 4056, 4064, 4072],
  26: [3954, 3956, 3958, 3962, 3964, 3966, 3970, 3972, 3974, 3978, 3980, 3982, 3986, 3988, 3990, 3994, 3996, 3998, 4002, 4004, 4006, 4010, 4012, 4014, 4018, 4020, 4022, 4026, 4028, 4030, 4034, 4036, 4038, 4042, 4044, 4046, 4050, 4052, 4054, 4058, 4060, 4062, 4066, 4068, 4070, 4074, 4076, 4078],
  27: [4150, 5122, 9066], 28: [4760, 8912, 9280, 9734], 29: [5002, 5004, 5006, 5008],
  30: [4936, 4938, 4940, 8036, 11180],
  31: [5560, 5570, 5572, 5584, 7746, 7752, 8046, 8288, 8290, 8292, 8294, 8462, 9272, 10618, 14066, 16320],
  32: [7192], 33: [7414, 10064, 10288, 10778], 34: [7568, 7570, 7572, 7574],
  35: [8590, 12304, 14570], 36: [9060], 37: [10686],
  38: [14090, 14702, 14710, 14864, 15336, 15338, 15514, 15592, 15606, 15720, 16050, 16090, 16384],
};
export const PET_KIND_ITEMS = Object.freeze(Object.fromEntries(
  Object.entries(KIND_LISTS).flatMap(([kind, ids]) => ids.map(id => [id, +kind]))));
export const PET_HIDDEN = Object.freeze(new Set([12350]));
// d8 (ED): per-item petPoint offset; only one item uses it.
export const PET_KIND_OFFSETS = Object.freeze({ 11354: [16, 0] });
// n8 (Ed): per-item drawn offset applied on top of the engine position.
export const PET_DRAWN = Object.freeze({
  1014: [0, -8], 1534: [0, -8], 1782: [5.3, -11], 2240: [0, -8], 2878: [0, -8],
  2880: [0, -8], 3952: [3, -7], 3954: [6, -11.5], 3956: [4, -11], 3958: [3.5, -4.5],
  3960: [-1.2, -7], 3962: [6, -11.5], 3964: [4, -11], 3966: [3.5, -4.5], 3968: [0.5, -7],
  3970: [6, -11.5], 3972: [4, -11], 3974: [3.5, -4.5], 3976: [1.4, -7], 3978: [6, -11.5],
  3980: [4, -11], 3982: [3.5, -4.5], 3984: [2.1, -7], 3986: [6, -11.5], 3988: [4, -11],
  3990: [3.5, -4.5], 3992: [0.1, -7], 3994: [6, -11.5], 3996: [4, -11], 3998: [3.5, -4.5],
  4000: [1.5, -7], 4002: [6, -11.5], 4004: [4, -11], 4006: [3.5, -4.5], 4008: [-0.5, -7],
  4010: [6, -11.5], 4012: [4, -11], 4014: [3.5, -4.5], 4016: [3, -7], 4018: [6, -11.5],
  4020: [4, -11], 4022: [3.5, -4.5], 4024: [-1.2, -7], 4026: [6, -11.5], 4028: [4, -11],
  4030: [3.5, -4.5], 4032: [2.2, -7], 4034: [6, -11.5], 4036: [4, -11], 4038: [3.5, -4.5],
  4040: [-2.1, -7], 4042: [6, -11.5], 4044: [4, -11], 4046: [3.5, -4.5], 4048: [3, -7],
  4050: [6, -11.5], 4052: [4, -11], 4054: [3.5, -4.5], 4056: [-2.9, -7], 4058: [6, -11.5],
  4060: [4, -11], 4062: [3.5, -4.5], 4064: [0.8, -7], 4066: [6, -11.5], 4068: [4, -11],
  4070: [3.5, -4.5], 4072: [-0.6, -7], 4074: [6, -11.5], 4076: [4, -11], 4078: [3.5, -4.5],
  6670: [0, -8],
});
// En (Eu): pets that fly to a perch and sit (Mighty Eagle).
export const PET_SIT = Object.freeze({
  14914: Object.freeze({ off: [-12, -14], speed: 100, flyTime: 2 }),
});

// m8: cell builders for the machine state machines. Rows are rect-relative
// (verified against tf_page1.png: the wolf animation row and its leap row sit
// directly below the part rect; the dragon row starts at the part rect x=192).
function machineCells(machine, row) {
  if (machine === "wolf") return [
    { cells: [0, 1, 2, 3, 4, 5].map(g => [g, row]), ms: 200 },
    { cells: [6, 7, 8, 9, 10, 11, 12, 13].map(g => [g, row]), ms: 100 },
    { cells: [[14, row]], ms: 200 },
    { cells: [[15, row]], ms: 200 },
    { cells: [0, 1, 2, 3, 4, 5].map(g => [g, row + 1]) },
    { cells: [0, 1, 2, 3, 4, 5].map(g => [g, row + 1]) },
    { cells: [6, 7, 8, 9].map(g => [g, row + 1]), ms: 100 },
  ];
  return [ // dragon
    { cells: [0, 1, 2, 3, 4, 5, 6, 7].map(g => [g, row]), ms: 200 },
    { cells: [8, 9, 10, 11, 12, 13, 14, 15].map(g => [g, row]), ms: 100 },
    { cells: [[0, row + 1]], ms: 200 },
    { cells: [[1, row + 1]], ms: 200 },
    { cells: [2, 3, 4].map(g => [g, row + 1]), ms: 100 },
  ];
}

// Ex: kind-200 machine configs.
export const PET_MACHINES = Object.freeze({
  11704: { off: [-36, -32], speed: [350, 340], snap: 320, trail: 20, lerp: [1, 1], machine: "wolf", row: 13 },
  11706: { off: [-36, -32], speed: [350, 340], snap: 320, trail: 20, lerp: [1, 1], machine: "wolf", row: 11 },
  11562: { off: [-36, -32], speed: [350, 340], snap: 320, trail: 20, lerp: [1, 1], machine: "dragon", row: 8 },
  13116: { off: [-28, -56], speed: [350, 300], snap: 250, trail: 20, lerp: [1, 1], ms: 200, cells: { idle: [[6, 14], [7, 14], [8, 14], [9, 14], [10, 14]], moving: [[6, 14], [7, 14], [8, 14], [9, 14], [10, 14]], punch: [[6, 14], [7, 14], [8, 14], [9, 14], [10, 14]] } },
  11142: { off: [-36, -72], speed: [350, 40], snap: 250, trail: 12, lerp: [1, 0], ms: 100, cells: { idle: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]], moving: [[0, 2], [1, 2], [2, 2], [3, 2]], punch: [[0, 3], [1, 3], [2, 3], [3, 3]] } },
});

// Eh: flyWalk parameters (W5 items 15336/15338).
export const PET_FLY_WALK = Object.freeze({
  landingSpeed: 100, walkSpeed: 400, flySpeed: 3000, warp: 800, flight: 2,
  landingStart: 0.2, flightStart: 1.9, flyOff: [35, 0], walkOff: [35, 0],
});
// N5: walkRunJump speed tables.
export const PET_WALK_RUN_JUMP = Object.freeze({
  14090: { minSpeed: 500, mult: 20 }, 14702: { minSpeed: 500, mult: 20 },
  14710: { minSpeed: 500, mult: 10 }, 14864: { minSpeed: 500, mult: 10 },
  15514: { minSpeed: 500, mult: 20 }, 15592: { minSpeed: 500, mult: 10 },
  15606: { minSpeed: 500, mult: 10 }, 15720: { minSpeed: 500, mult: 10 },
  16050: { minSpeed: 500, mult: 20 }, 16090: { minSpeed: 500, mult: 10 },
  16384: { minSpeed: 500, mult: 10 },
});
// W5: flyWalk items.
export const PET_FLY_WALK_ITEMS = Object.freeze(new Set([15336, 15338]));

// aZ: kind lookup.
export function petKindFor(itemId) {
  itemId = Number(itemId);
  if (PET_MACHINES[itemId]) return 200;
  if (PET_HIDDEN.has(itemId)) return 100;
  return PET_KIND_ITEMS[itemId] ?? 0;
}
export function petConfigFor(itemId) {
  itemId = Number(itemId);
  return {
    kind: petKindFor(itemId),
    offset: PET_KIND_OFFSETS[itemId] ?? [0, 0],
    drawn: PET_DRAWN[itemId] ?? null,
    machine: PET_MACHINES[itemId] ?? null,
    sit: PET_SIT[itemId] ?? null,
  };
}

// ---- Small math helpers (reference: FQ / hQ) ----
const approachLinear = (from, to, max) => Math.abs(to - from) <= max ? to : from + Math.sign(to - from) * max;
const randRange = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * PetEngine — direct port of the SetPlannerGT PlayerMotionController pet step.
 * One instance per pet item; state persists across frames on the engine.
 * host: {x, y, vx, vy, facing, ground, punchT, punchAim, punchId, petItem,
 *   petCells, petDrawn, bareHead, lift, armAngle, solidAt(x,y), walkRunJump, flyWalk}
 */
export class PetEngine {
  constructor() {
    this.petQ = null;
    this.pet = null;
    this.lastPunchId = null;
    this.punchN = 0;
    this.punchDelay = 0; // PunchDelay custom variable: 1 on punch start, decrements.
  }

  step(host, dt) {
    const cfg = petConfigFor(host.petItem);
    this.host = host;
    this.punchDelay = Math.max(-99, this.punchDelay - dt);
    if (host.punchId != null && host.punchId !== this.lastPunchId) {
      this.lastPunchId = host.punchId;
      this.punchN++;
      this.punchDelay = 1;
    }
    if (cfg.kind === 200) return this.petOwn(host, cfg.machine, dt);
    if (cfg.kind === 100) { this.petQ = null; this.pet = null; return; }
    if (cfg.sit) return this.petSit(host, cfg.sit, dt);
    this.petStep(host, cfg, dt);
  }

  // ---- petStep: trail-based pets, kinds 0..38 ----
  petStep(host, cfg, dt) {
    const w = cfg.kind;
    const center = [host.x + 16, host.y + 32];
    const e = host.facing < 0 ? 1 : 0;
    const l = 1 - 2 * e;
    const [O, b] = cfg.offset;
    let p = this.petQ;
    if (!p || p.item !== host.petItem) {
      const s = [center[0] - l * (O + PET.BEHIND), center[1] - l * b];
      p = this.petQ = {
        item: host.petItem, kind: w, p: [...s], v: [0, 0], acc: 1, turn: 0, face: e,
        scale: 0.01, t74: 0, mode: 0, idle: 0, rot: 0, hop: 0, hopV: 0, hopTo: null,
        hopSpeed: 0, off: [0, 0], floor: center[1], clock: 0,
        trail: Array.from({ length: PET.TRAIL }, () => ({ x: s[0], y: s[1], ground: true, face: e })),
      };
    }
    p.scale = Math.min(1, p.scale + dt);
    if (p.turn > 0 && w !== 18) p.turn -= dt;
    p.clock += dt * 1000;
    if (p.acc < PET.TICK) p.acc += dt;
    if (p.acc >= PET.TICK) {
      p.acc = 0;
      const q = this.petPoint(p, center, O, b);
      p.trail.shift();
      p.trail.push({ x: q[0], y: q[1], vx: host.vx, vy: host.vy, ground: host.ground, face: e });
      p.idle = host.vx === 0 && host.vy === 0 && host.punchT < 0 ? p.idle + dt : 0;
      const before = [...p.p];
      this.petMove(p, center, dt, w, O, b);
      p.d = [p.p[0] - before[0], p.p[1] - before[1]];
      p.t68 = (p.t68 ?? 0) + dt;
    }
    const trailKinds = [0, 7, 8, 12, 13, 14, 15, 16, 19, 20, 21, 22, 24, 26, 33, 36, 38];
    if (trailKinds.includes(w) || (w === 17 && p.t74 <= 0)) p.face = p.trail[0].face;
    const x = p.face ? -1 : 1;
    const [d, u] = cfg.drawn ?? host.petDrawn ?? [0, 0];
    const h = [2, 13, 18, 28, 29].includes(w) ? p.hop : 0;
    const o = [2, 13, 18, 37].includes(w) ? p.rot : 0;
    this.pet = {
      x: p.p[0] + d * x * p.scale, y: p.p[1] + (u + h) * p.scale, face: x, scale: p.scale,
      rot: o, string: this.petString(p, center, w), landed: !!p.landed, idle: p.idle ?? 0,
      v: [...p.v], dist: Math.hypot(p.p[0] - center[0], p.p[1] - center[1]),
      ...(w === 17 ? { frame: this.phoenixFrame(p) } : {}),
      ...(p.flyWalk ? { flyWalk: { ...p.flyWalk } } : {}),
    };
    if (w === 38) return; // script pets animate through the renderer machine
    let r = [0, 15, 21].includes(w) ? this.walkFrame(p) : [5, 35].includes(w) ? this.perchFrame(p) : null;
    if (r !== null) this.pet.frame = r;
    if (w === 8 || w === 36) this.pet.cell = this.petCell8(p, Number(host.petItem));
    const cells = host.petCells;
    if (cells) {
      const a = this.petCellNow(p, cells);
      if (a) this.pet.cell = a;
    }
  }

  // ---- petOwn: kind-200 machines ----
  petOwn(host, machine, dt) {
    const O = [host.x + 16, host.y + 32];
    const b = host.facing < 0 ? 1 : 0;
    const target = () => [O[0] + (b ? -1 : 1) * (machine.off[0] - 16), O[1] + machine.off[1]];
    let e = this.petQ;
    if (!e || e.item !== host.petItem) {
      const x = target();
      e = this.petQ = {
        item: host.petItem, kind: 200, p: x, acc: PET.TICK, count: 1, clock: 0, face: 0,
        trail: Array.from({ length: machine.trail }, () => ({ x: x[0], y: x[1], vx: 0, vy: 0, face: 0 })),
        st: 0, k23c: 0, k24c: 0, f240: false, o244: [0, 0], s250: [0, 0], t258: [0, 0],
        cell: null, faceT: 0, faceFb: 0, punchN: this.punchN,
      };
    }
    if (machine.machine === "wolf" && e.punchN !== this.punchN) {
      e.punchN = this.punchN;
      const [u, h] = host.punchAim ?? [64, 16];
      const o = host.x + (host.facing < 0 ? 32 - u : u);
      e.f240 = true; e.s250 = [...e.o244]; e.t258 = [o, host.y + h - 16]; e.k24c = 0;
    }
    e.clock += dt * 1000;
    e.acc += dt;
    while (e.acc >= PET.TICK) {
      e.acc -= PET.TICK;
      const r = PET.TICK;
      if (e.faceT > 0) e.faceT -= r;
      const v = e.faceT > 0 ? e.faceFb : b;
      const s = [O[0] + (v ? -1 : 1) * (machine.off[0] - 16), O[1] + machine.off[1]];
      if (e.count < machine.trail) e.count++;
      e.trail.shift();
      e.trail.push({ x: s[0], y: s[1], vx: host.vx, vy: host.vy, face: v });
      if (e.count < machine.trail) {
        for (const a of e.trail) Object.assign(a, { x: s[0], y: s[1], vx: 0, vy: 0, face: 0 });
        e.p = [...s];
        continue;
      }
      const R = e.trail[0], q = e.trail[machine.trail - 1];
      const I = [q.x + (R.x - q.x) * machine.lerp[0], q.y + (R.y - q.y) * machine.lerp[1]];
      e.p = [approachLinear(e.p[0], I[0], machine.speed[0] * r), approachLinear(e.p[1], I[1], machine.speed[1] * r)];
      if (Math.hypot(e.p[0] - R.x, e.p[1] - R.y) > machine.snap) e.p = [R.x, R.y];
    }
    if (machine.machine) return this.petStates(e, machine, dt * 1000);
    // Machine config without a state machine (13116, 11142): plain cell clock.
    const l = e.trail[0];
    const p = host.punchT >= 0 ? machine.cells.punch : Math.abs(l.vx) > 0.1 ? machine.cells.moving : machine.cells.idle;
    this.pet = {
      x: e.p[0], y: e.p[1], face: l.face ? -1 : 1, scale: 1, rot: 0, string: null, own: true,
      cell: p[Math.floor(e.clock / (machine.ms ?? 100)) % p.length],
    };
  }

  // ---- petStates: wolf/dragon punch choreography (state machine) ----
  petStates(E, machine, w) {
    const O = machineCells(machine.machine, machine.row);
    const b = E.trail[0];
    const clamp01 = o => Math.min(1, Math.max(0, o));
    const faceByVelocity = () => {
      E.faceT = 0.2;
      E.faceFb = this.host.vx !== 0 ? (this.host.vx < 0 ? 1 : 0) : (this.host.facing < 0 ? 1 : 0);
    };
    const moveState = () => b.vy < 0 ? 2 : b.vy > 0 ? 3 : Math.abs(b.vx) > 0.01 ? 1 : 0;
    if (machine.machine === "dragon") {
      // Dragon: cell follows the motion state directly, no lunge.
      const o = this.host.punchT >= 0 ? 4 : moveState();
      if (o === 4) faceByVelocity();
      const r = O[o];
      E.cell = r.cells[Math.floor(E.clock / r.ms) % r.cells.length];
      this.pet = {
        x: E.p[0], y: E.p[1], face: b.face ? -1 : 1, scale: 1, rot: 0, string: null,
        cell: E.cell, own: true,
      };
      return;
    }
    // Wolf: lunge state machine (4 = lunge out, 5 = recoil, 6 = hover at target).
    let p = O[E.st], x = p.cells.length;
    if (E.st === 4 || E.st === 5) {
      const v = Math.floor(200 / x) * x, s = E.st === 4 ? 1 : -1;
      E.k23c += s * w / v;
      E.k24c = clamp01(E.k24c + s * w / 200);
      E.cell = p.cells[Math.max(0, Math.min(x - 1, Math.floor(E.k23c * x)))];
    } else {
      if (E.st === 6) { faceByVelocity(); E.k24c = clamp01(E.k24c + w / 200); }
      E.cell = p.cells[Math.floor(E.clock / p.ms) % x];
    }
    const d = E.f240 && this.host.punchT >= 0;
    if (E.st <= 3) {
      if (d) { E.st = 4; E.k23c = 0; }
      else E.st = moveState();
    } else if (E.st === 4) {
      if (E.k23c >= 1) { E.st = 6; E.k23c = 1; }
      if (!d) E.st = 5;
    } else if (E.st === 5) {
      if (E.k23c <= 0) { E.st = 0; E.k23c = 0; }
      if (d) { E.st = 4; E.k23c = 0; E.k24c = 0; E.s250 = [0, 0]; }
    } else if (E.st === 6 && !d) {
      E.st = 5; E.s250 = [0, 0];
    }
    E.f240 = d;
    let u = [0, 0];
    if (E.st >= 4) {
      u = [0, 1].map(R => E.s250[R] + (E.t258[R] - (E.s250[R] + E.p[R])) * E.k24c);
      E.o244 = [...u];
    }
    const h = b.face ? -1 : 1;
    this.pet = {
      x: E.p[0] + u[0], y: E.p[1] + u[1] + (E.st === 6 ? 16 : 0), face: h, scale: 1, rot: 0,
      string: null, cell: E.cell, own: true,
      extra: E.st === 6 ? [{ cell: [10, machine.row + 1], dx: 4, dy: 0, r: Math.floor(E.clock / 2) % 360, add: true }] : null,
    };
  }

  // ---- petSit: fly to a perch and sit ----
  petSit(host, sit, dt) {
    const w = [host.x + 16, host.y + 32];
    const O = host.facing < 0 ? 1 : 0;
    const b = 1 - 2 * O;
    const k = [w[0] + b * sit.off[0], w[1] + sit.off[1]];
    let e = this.petQ;
    if (!e || e.item !== host.petItem)
      e = this.petQ = { item: host.petItem, kind: "sit", p: [w[0] - b * PET.BEHIND, w[1]], v: [0, 0], turn: 0, face: O, idle: 0, acc: 0 };
    let l = 0;
    if (e.idle < sit.flyTime) {
      const p = [...e.p];
      this.petFly(e, w, dt);
      l = Math.hypot(e.p[0] - p[0], e.p[1] - p[1]) / Math.max(dt, 0.000001);
    } else {
      const x = [k[0] - e.p[0], k[1] - e.p[1]];
      const d = Math.hypot(x[0], x[1]);
      e.p = [approachLinear(e.p[0], k[0], sit.speed * dt), approachLinear(e.p[1], k[1], sit.speed * dt)];
      if (d < 1) { e.v = [0, 0]; e.face = O; }
      else { e.v = [x[0] * sit.speed, x[1] * sit.speed]; e.face = x[0] < 0 ? 1 : 0; }
      l = Math.hypot(e.v[0], e.v[1]);
    }
    e.idle = host.ground && host.vx === 0 && host.punchT < 0 ? e.idle + dt : 0;
    this.pet = { x: e.p[0], y: e.p[1], face: e.face ? -1 : 1, scale: 1, rot: 0, string: null, speed: l, v: e.v };
  }

  // ---- petPoint: the trail anchor behind the player ----
  petPoint(E, center, offX, offY) {
    const b = this.host.facing < 0 ? -1 : 1;
    const k = E.trail[E.trail.length - 1];
    if (!(Math.hypot(offX, offY) > 0))
      return [center[0] - PET.BEHIND * b, center[1]];
    let e = [center[0] - b * (offX + PET.BEHIND), center[1] - b * offY];
    if (Math.hypot(e[0] - k.x, e[1] - k.y) > PET.HALVE)
      e = [k.x + (e[0] - k.x) / 2, k.y + (e[1] - k.y) / 2];
    if (this.host.ground && this.host.solidAt) {
      // Flat-ground shortcut: when the tile under the offset point is standable,
      // the pet walks directly behind at the player's own level.
      if (this.host.solidAt(e[0], e[1] + 16) === false)
        e = [center[0] - PET.BEHIND * b, center[1]];
    }
    return e;
  }

  // ---- petMove dispatch ----
  petMove(E, center, dt, kind, offX, offY) {
    switch (kind) {
      case 1: case 3: case 9: case 23: case 25: case 27: return this.petFly(E, center, dt);
      case 11: case 31: return this.petHover(E, center, dt, 90);
      case 32: return (this.petHover(E, center, dt, 180), this.petHover(E, center, dt, 90));
      case 2: case 13: return this.petRoll(E, dt);
      case 4: case 30: case 34: return this.petKite(E, center, dt, kind);
      case 5: case 35: return this.petPerch(E, center, dt, kind, offX, offY);
      case 6: return this.petPiranha(E, center, dt);
      case 10: return this.petOwlbeard(E, center, dt);
      case 17:
        if (E.t74 > 0) { E.t74 -= dt; this.petFly(E, center, dt); }
        else this.petTrail(E, dt, 250);
        if (!this.host.ground) E.t74 = 2;
        return;
      case 18: return this.petBall(E, center, dt);
      case 28: case 29: return this.petHop(E, dt);
      case 37: return this.petAgent(E, center, dt);
      case 38: {
        if (this.host.walkRunJump) return this.petWalkRunJump(E, dt, this.host.walkRunJump);
        if (this.host.flyWalk) return this.petFlyWalk(E, center, dt, this.host.flyWalk, offX, offY);
        return this.petTrail(E, dt, PET.TRAIL_SNAP);
      }
      default: return this.petTrail(E, dt, PET.TRAIL_SNAP);
    }
  }

  petWalkRunJump(E, dt, table) {
    const O = E.trail[0];
    const b = [O.x - E.p[0], O.y - E.p[1]];
    const k = Math.hypot(b[0], b[1]);
    const e = Math.max(table.minSpeed, table.mult * k);
    const l = e * dt;
    E.p = [approachLinear(E.p[0], O.x, l), approachLinear(E.p[1], O.y, l)];
    E.v = k ? [b[0] / k * e, b[1] / k * e] : [0, 0];
  }

  petFlyWalk(g, center, dt, b, offX, offY) {
    const state = { timer: 0, IsFlying: false, IsLanding: false, IsTakeoff: false, IsPunching: false, IsWalking: false };
    const p = g.trail[0];
    const x = p.face ? -1 : 1;
    const d = g.flyWalk ??= state;
    d.IsPunching = this.host.punchT >= 0;
    if (d.timer > 0) {
      d.timer = Math.fround(d.timer - Math.fround(dt));
      d.IsFlying = true; d.IsWalking = false;
      d.IsTakeoff = d.timer > Math.fround(b.flightStart);
      d.IsLanding = d.timer < Math.fround(b.landingStart);
      if (d.IsLanding) {
        const u = b.landingSpeed * dt;
        g.p = [approachLinear(g.p[0], p.x, u), approachLinear(g.p[1], p.y, u)];
      } else {
        const h = this.petPoint(g, center, offX, offY);
        const o = [h[0] + x * b.flyOff[0], h[1] + b.flyOff[1] - 40];
        const r = Math.hypot(o[0] - g.p[0], o[1] - g.p[1]);
        if (r > b.warp) g.p = [...o];
        if (r > 16) {
          const v = Math.atan2(o[1] - g.p[1], o[0] - g.p[0]);
          g.v = [approachLinear(g.v[0], 2 * r * Math.cos(v), b.flySpeed * dt), approachLinear(g.v[1], 2 * r * Math.sin(v), b.flySpeed * dt)];
        } else {
          g.v = [approachLinear(g.v[0], 0, 5 * dt), approachLinear(g.v[1], 0, 5 * dt)];
        }
        g.v = [g.v[0] + randRange(-10, 10), g.v[1] + randRange(-10, 10)];
        g.p = [g.p[0] + g.v[0] * dt, g.p[1] + g.v[1] * dt];
      }
    } else {
      d.IsFlying = false;
      d.IsWalking = Math.abs(p.vx ?? 0) > 0.1;
      const s = b.walkSpeed * dt;
      g.p = [approachLinear(g.p[0], p.x + x * b.walkOff[0], s), approachLinear(g.p[1], p.y + b.walkOff[1], s)];
    }
    if (this.host.vy > 0.1) d.timer = b.flight;
    return d;
  }

  petTrail(E, dt, speed) {
    const O = E.trail[0];
    const b = PET.TRAIL_SPEED * dt;
    E.p = [approachLinear(E.p[0], O.x, b), approachLinear(E.p[1], O.y, b)];
    E.v = [0, 0];
    if (Math.hypot(E.p[0] - O.x, E.p[1] - O.y) > speed) E.p = [O.x, O.y];
  }

  petRollHop(E, dir, dt) {
    E.rot = ((E.rot + dir * 300 * dt) % 360 + 360) % 360;
    E.hop += E.hopV * dt;
    E.hopV += 400 * dt;
    if (E.hop >= 0) {
      E.hop = 0;
      if (dt !== 0) E.hopV = -60;
    }
  }

  petRoll(E, dt) {
    this.petRollHop(E, E.trail[0].x - E.p[0], dt);
    this.petTrail(E, dt, PET.TRAIL_SNAP);
  }

  petStill(E, dt, w = PET.WANDER, O = PET.WANDER) {
    if (Math.hypot(this.host.vx, this.host.vy) >= 1) return;
    for (const b of [0, 1])
      if (Math.abs(E[b]) > PET.STILL_FAST) E[b] = approachLinear(E[b], 0, PET.STILL_SLOW * dt);
    E[0] += randRange(-w, w) * dt;
    E[1] += randRange(-O, O) * dt;
  }

  petFar(E, g, dt, O, b = PET.DRIFT) {
    const k = Math.hypot(g[0] - E[0], g[1] - E[1]);
    if (k > O) { E[0] = g[0]; E[1] = g[1]; }
    else if (k > PET.FLY_FAR) {
      const e = Math.atan2(E[1] - g[1], E[0] - g[0]);
      E[0] += PET.DRIFT * dt * Math.cos(e);
      E[1] += b * dt * Math.sin(e);
    }
  }

  petFly(E, g, dt, O = g, b = PET.PUSH, k = PET.SIDE) {
    const [e, l] = [E.p, E.v];
    const p = PET.BOX;
    if (e[0] > O[0] + p) { l[0] -= b * dt; l[1] += k * dt; }
    if (e[0] < O[0] - p) { l[0] += b * dt; l[1] -= k * dt; }
    if (e[1] < O[1] - p) { l[0] += k * dt; l[1] += b * dt; }
    if (e[1] > O[1] + p) { l[0] -= k * dt; l[1] -= b * dt; }
    l[0] += randRange(-PET.JITTER, PET.JITTER) * dt;
    l[1] += randRange(-PET.JITTER, PET.JITTER) * dt;
    l[0] = Math.max(-PET.MAX, Math.min(PET.MAX, l[0]));
    l[1] = Math.max(-PET.MAX, Math.min(PET.MAX, l[1]));
    e[0] += l[0] * dt; e[1] += l[1] * dt;
    if (E.turn <= 0) {
      if (l[0] > PET.FACE_V) E.face = 0;
      else if (l[0] < -PET.FACE_V) E.face = 1;
    }
    this.petFar(e, O, dt, PET.FLY_SNAP);
    this.petStill(l, dt);
  }

  petHover(E, g, dt, O) {
    const [b, k] = [E.p, E.v];
    const e = [g[0] + (this.host.facing < 0 ? PET.HOVER_AT[0] : -PET.HOVER_AT[0]), g[1] + PET.HOVER_AT[1]];
    const l = Math.hypot(e[0] - b[0], e[1] - b[1]);
    if (l > PET.HOVER_SNAP) { b[0] = e[0]; b[1] = e[1]; }
    k[0] = approachLinear(k[0], 0, PET.HOVER_DAMP * dt);
    k[1] = approachLinear(k[1], 0, PET.HOVER_DAMP * dt);
    let p = PET.HOVER_MAX;
    if (l > PET.HOVER_NEAR) {
      p = Math.max(l, PET.HOVER_MIN);
      const x = Math.atan2(e[1] - b[1], e[0] - b[0]);
      k[0] = approachLinear(k[0], p * Math.cos(x), O * dt);
      k[1] = approachLinear(k[1], p * Math.sin(x), O * dt);
    } else {
      k[0] += randRange(-PET.HOVER_JITTER, PET.HOVER_JITTER) * dt;
      k[1] += randRange(-PET.HOVER_JITTER, PET.HOVER_JITTER) * dt;
    }
    k[0] = Math.max(-p, Math.min(p, k[0]));
    k[1] = Math.max(-p, Math.min(p, k[1]));
    if (E.turn <= 0) { E.face = b[0] > g[0] ? 1 : 0; E.turn = PET.HOVER_TURN; }
    b[0] += k[0] * dt; b[1] += k[1] * dt;
  }

  petKite(E, g, dt, O) {
    const [b, k] = [E.p, E.v];
    const e = this.host.facing < 0 ? 1 : 0;
    const [l, p] = O === 4 ? [96, -96] : O === 30 ? [32, -64] : [48, -48];
    const x = [g[0] + (e ? l : -l), g[1] + p];
    const [d, u] = b;
    if (d < x[0] - 32) k[0] += 200 * dt;
    if (u < x[1] - 32) k[1] += 200 * dt;
    if (d > x[0] + 32) k[0] -= 200 * dt;
    if (u > x[1] + 32) k[1] -= 200 * dt;
    k[0] += randRange(-90, 90) * dt;
    k[1] += randRange(-90, 90) * dt;
    k[0] = Math.max(-250, Math.min(250, k[0]));
    k[1] = Math.max(-250, Math.min(250, k[1]));
    b[0] += k[0] * dt; b[1] += k[1] * dt;
    if (O === 34) {
      if (k[0] >= 6) E.face = 0;
      else if (k[0] <= -6) E.face = 1;
      if (this.host.punchT >= 0) E.face = this.punchAt()[0] < b[0] ? 1 : 0;
    } else if (E.turn <= 0) {
      if (b[0] > g[0] + 32) E.face = 0;
      else if (b[0] < g[0] - 32) E.face = 1;
    }
    this.petFar(b, x, dt, 700);
    this.petStill(k, dt);
  }

  punchAt() {
    const E = this.host.punchAim ?? [this.host.facing < 0 ? 32 - 64 : 64, 16];
    return [this.host.x + E[0], this.host.y + E[1]];
  }

  petApproach(E, g, dt) {
    const [O, b] = [E.p, E.v];
    if (Math.hypot(g[0] - O[0], g[1] - O[1]) < 4) { O[0] = g[0]; O[1] = g[1]; return true; }
    const [k, e] = O;
    if (k < g[0]) b[0] += 300 * dt;
    if (e < g[1]) b[1] += 300 * dt;
    if (k > g[0]) b[0] -= 300 * dt;
    if (e > g[1]) b[1] -= 300 * dt;
    b[0] = Math.max(-50, Math.min(50, b[0]));
    b[1] = Math.max(-50, Math.min(50, b[1]));
    O[0] += b[0] * dt; O[1] += b[1] * dt;
    if (E.turn <= 0) {
      if (b[0] > 5) E.face = 0;
      else if (b[0] < -5) E.face = 1;
    }
    O[0] = approachLinear(O[0], g[0], 5 * dt);
    O[1] = approachLinear(O[1], g[1], 5 * dt);
    return false;
  }

  petPerch(E, g, dt, O, offX, offY) {
    const e = Number(this.host.petItem);
    const l = this.host.facing < 0 ? 1 : 0;
    const p = 1 - 2 * l;
    let x;
    if (O === 35) {
      const d = this.petPoint(E, g, offX, offY);
      x = [d[0] + (l ? -6 : 6), d[1] - 8];
    } else {
      x = [g[0], g[1] - HEAD + 5];
    }
    if (e === 7648) x = [g[0] - 15 * p, g[1] - 10];
    if (e === 12304) x = [g[0] - 9 * p, g[1] - 15];
    if (this.host.bareHead) x[1] += 2;
    if (e === 2484) x[1] -= 4;
    x[1] += this.host.lift ?? 0;
    if (E.idle < 2) { E.mode = 0; return this.petFly(E, g, dt); }
    if (E.idle < 10) {
      if (this.petApproach(E, x, dt)) {
        if (e === 2484) E.face = l;
        E.mode = 1;
      }
    } else {
      E.mode = 2; E.p = [...x];
    }
  }

  petPiranha(E, g, dt) {
    E.t74 -= dt;
    E.p = [g[0] + E.off[0], g[1] - HEAD / 2 + E.off[1]];
    if (E.t74 > 0) return;
    E.off = [randRange(-10, 10), randRange(-HEAD / 2, HEAD * 0.3)];
    let O = randRange(0, 90);
    if (E.off[0] > 0) O += 90;
    if (E.off[1] > 0) O = 360 - O;
    if (Math.random() < 0.5) E.face = 0;
    else { O = -O; E.face = 1; }
    E.rot = O;
    E.t74 = randRange(0.1, 1);
  }

  petOwlbeard(E, g, dt) {
    const O = this.host.facing < 0 ? 1 : 0;
    const b = [g[0] + 3 - 6 * O, g[1] - HEAD + 37];
    if (E.idle < 2) { E.mode = 0; return this.petFly(E, g, dt); }
    if (E.mode >= 5) {
      E.t74 += dt;
      E.p = [b[0], b[1] + 2];
      E.face = O;
      if (E.mode === 6) {
        if (E.t74 > 2.2) { E.t74 -= randRange(0.1, 4); E.mode = 5; }
      } else if (E.t74 >= 2) E.mode = 6;
    } else if (E.mode >= 1) {
      E.p = [b[0], b[1] + E.mode - 3];
      E.t74 += dt;
      if (E.t74 > 1) { E.t74 -= 1; E.mode++; }
    } else if (this.petApproach(E, b, dt)) {
      E.mode = 3; E.t74 = 0; E.face = O;
    }
  }

  petBall(E, g, dt) {
    const [O, b] = [E.p, E.v];
    const k = this.host.facing < 0 ? 1 : 0;
    if (this.host.punchT >= 0) {
      // Punch throw: the ball is flung toward the punch aim.
      E.t74 = -10;
      const e = Math.min(1, Math.max(0, this.host.punchT * 4));
      const l = this.punchAt();
      E.p = [g[0] * (1 - e) + l[0] * e, g[1] * (1 - e) + l[1] * e];
      E.v = [randRange(40, 300) * (k ? 1 : -1), randRange(-200, -20)];
      E.floor = l[1];
      return;
    }
    if (E.t74 < -1) { E.t74 = 1; return; }
    if (E.t74 > 0) {
      // Thrown: ballistic arc with bounce off the recorded floor.
      E.t74 = Math.max(0, E.t74 - dt);
      O[0] += b[0] * dt; O[1] += b[1] * dt;
      b[1] += 400 * dt;
      b[0] = approachLinear(b[0], 0, 100 * dt);
      E.rot = ((E.rot + b[0] * 3 * dt) % 360 + 360) % 360;
      if (g[1] > E.floor) E.floor = g[1];
      if (O[1] > E.floor && b[1] > 0) b[1] = -b[1];
      if (E.t74 < 1.25 && O[0] >= g[0] - 10 && O[0] <= g[0] + 10 && O[1] < g[1] && O[1] > g[1] - 30)
        E.t74 = 0;
      return;
    }
    this.petRollHop(E, g[0] - O[0], dt);
    E.p = [approachLinear(O[0], g[0], 700 * dt), approachLinear(O[1], g[1], 700 * dt)];
    E.v = [0, 0];
    if (Math.hypot(E.p[0] - g[0], E.p[1] - g[1]) > 200) E.p = [...g];
    // Player bumps the ball while running: kick it.
    if (Math.hypot(E.p[0] - g[0], E.p[1] - g[1]) < 4 && Math.hypot(this.host.vx, this.host.vy) > 50) {
      E.t74 = 1.5;
      E.v = [randRange(160, 240) * (k ? -1 : 1), this.host.vy * 0.25 - 110];
      E.floor = g[1] + 2;
    }
  }

  petHop(E, dt) {
    const w = E.trail[0];
    E.t74 = Math.fround(E.t74 - Math.fround(dt));
    if (E.t74 > 0) {
      // Mid-hop: sine arc toward the recorded landing point.
      E.hop = Math.sin(2 * E.t74 * Math.PI) * E.hopSpeed * -0.2;
      E.hopV = 0;
      E.p = [approachLinear(E.p[0], E.hopTo[0], E.hopSpeed * dt), approachLinear(E.p[1], E.hopTo[1], E.hopSpeed * dt)];
      E.v = [0, 0];
      return;
    }
    if (E.p[0] > w.x + 1) E.face = 1;
    else if (E.p[0] < w.x - 1) E.face = 0;
    E.hop = 0;
    const O = Math.hypot(E.p[0] - w.x, E.p[1] - w.y);
    if (O >= 5 && w.ground) {
      E.t74 = 0.5;
      E.hopTo = [w.x, w.y];
      E.hopSpeed = 2 * O;
    }
  }

  petAgent(E, g, dt) {
    const [O, b] = [E.p, E.v];
    const k = this.host.facing < 0 ? 1 : 0;
    const e = [g[0] + (k ? 16 : -16), g[1] - 48];
    if (E.idle >= 2) {
      // Idle: settle onto the shoulder and stand upright.
      E.rot = approachLinear(E.rot, E.face ? -10 : 10, 180 * dt);
      if (this.petApproach(E, [e[0] + (k ? -16 : 16), g[1] - HEAD - 10], dt)) {
        E.v = [0, 0]; E.rot = 0; E.landed = true;
      } else {
        E.rot = approachLinear(E.rot, 0, 2 * dt); E.landed = false;
      }
      return;
    }
    E.landed = false;
    const [l, p] = O;
    if (l < e[0] - 32) b[0] += 800 * dt;
    if (p < e[1] - 32) b[1] += 800 * dt;
    if (l > e[0] + 32) b[0] -= 800 * dt;
    if (p > e[1] + 32) b[1] -= 800 * dt;
    b[0] = Math.max(-250, Math.min(250, b[0]));
    b[1] = Math.max(-250, Math.min(250, b[1]));
    b[0] += randRange(-30, 30) * dt;
    O[0] += b[0] * dt; O[1] += b[1] * dt;
    let x = 0;
    if (b[0] >= 6) { E.face = 0; x = 10; }
    else if (b[0] <= -6) { E.face = 1; x = -10; }
    E.rot = approachLinear(E.rot, x, 180 * dt);
    this.petFar(O, e, dt, 700, 5);
    this.petStill(b, dt, PET.WANDER, 5);
  }

  // ---- Kite string (kinds 4 and 30) ----
  petString(g, w, O) {
    if (O !== 4 && O !== 30) return null;
    const b = Math.PI / 180;
    const k = g.scale, e = g.face;
    let l;
    if (O === 4) {
      l = [g.p[0] + Math.cos(g.rot * b) * (e ? 4 : -4) * k, g.p[1] - (16 + g.hop) * Math.sin((g.rot + 90) * b) * k];
    } else {
      const r = (Math.sin(g.clock % 4000 / 4000 * Math.PI * 2) * 20 + (e ? 45 : 135)) * b;
      l = [g.p[0] + 16 * Math.cos(r) * k, g.p[1] + 15 * Math.sin(r) * k];
    }
    const p = this.host.facing < 0 ? 1 : 0;
    const x = [w[0] - 7 + 14 * p, w[1] - 12];
    const d = ((this.host.armAngle * (1 - 2 * p) + 90) % 360 + 360) % 360;
    const u = d + 180 * p - 90;
    const h = [x[0] + 6 * Math.cos(d * b) + 4 * Math.cos(u * b), x[1] + 6 * Math.sin(d * b) + 4 * Math.sin(u * b)];
    return { from: l, to: h, rgb: [180, 180, 180], width: 1 };
  }

  // ---- Cell selectors ----
  petCellNow(E, cells) {
    const w = E.trail[0];
    const [O, b] = E.d ?? [0, 0];
    const k = !w.ground ? (b < 0 ? cells.rise : cells.fall) : Math.abs(O) >= 0.1 ? cells.move : cells.stand;
    if (!k) return null;
    const e = k.cells.length;
    const l = Math.floor((E.t68 ?? 0) * 1000 % k.ms / k.ms * e);
    return k.cells[Math.min(e - 1, l)];
  }

  petCell8(E, itemId) {
    const w = E.trail[0];
    const O = E.t68 ?? 0;
    const [b, k] = E.d ?? [0, 0];
    let e;
    if (!w.ground) e = k < 0 ? 6 : 7;
    else if (Math.abs(b) >= 0.1) e = 3 + Math.floor(O / 0.15) % 3;
    else e = [0, 1, 2, 1][Math.floor(O / (itemId === 5480 ? 1.2 : itemId === 11712 ? 0.18 : 0.12)) & 3];
    return [e % 8, Math.floor(e / 8)];
  }

  phoenixFrame(E) {
    const g = E.t68 ?? 0;
    const [w, O] = E.d ?? [0, 0];
    const b = 5 + (Math.floor(g / 0.05) & 1);
    if (E.t74 > 0) return b;
    if (this.host.ground) return Math.abs(w) < 0.1 ? Math.floor(g / 0.1) % 3 : [0, 3, 0, 4][Math.floor(g / 0.05) & 3];
    return O === 0 ? 0 : b;
  }

  walkFrame(E) {
    const g = E.trail[0];
    if (!g.ground) return (g.vy ?? 0) < 0 ? 3 : 4;
    if (Math.abs(g.vx ?? 0) >= 0.1) return [0, 1, 0, 2][Math.floor((E.t68 ?? 0) / 0.1) & 3];
    return null;
  }

  perchFrame(E) {
    if (Number(this.host.petItem) === 12304) return null;
    const g = E.t68 ?? 0;
    return E.mode === 1 || E.mode === 2 ? 3 + Math.floor(g / 0.4) % 3 : [0, 1, 0, 2][Math.floor(g / 0.1) & 3];
  }
}

// ---- Integration: apply the engine state to the item's pet pieces ----
// Mirrors the SetPlannerGT pet draw: the pet transform (translate to the pet
// world anchor, flip, scale, rotate, unpin) composes over each pet piece's own
// authored matrix, with the cell override selecting the animation frame.
export function advancePet(item, timeMs, motion) {
  // Pet pieces are re-authored every step: drop the previous frame's generated
  // extras and leash-string lines before re-filtering, so item.pieces stays
  // bounded and no stale copies survive an equip change.
  for (let i = item.pieces.length - 1; i >= 0; i--)
    if (item.pieces[i].petExtra || item.pieces[i].petLine) item.pieces.splice(i, 1);
  const petPieces = item.pieces.filter(p => p.pet);
  if (petPieces.length === 0) return;
  const raw = item.raw ?? {};
  // worldX/worldY are the avatar's feet line in Demo world units; the pet engine
  // hosts at the 32x32 rig's top-left edge (its center [x+16, y+32] is then the
  // ground line under the feet, which is where the source anchors pets).
  const hostX = motion.worldX ?? motion.x ?? 0;
  const hostY = (motion.worldY ?? motion.y ?? 0) - 32;
  const host = {
    x: hostX, y: hostY, vx: motion.vx ?? 0, vy: motion.vy ?? 0,
    facing: motion.facing ?? 1, ground: motion.ground !== false,
    punchT: motion.punch ? motion.punch.ageMs / 1000 : -1,
    punchAim: motion.punch?.target ?? null,
    punchId: latestPunchId(motion),
    petItem: item.id, petCells: raw.petCells ?? null, petDrawn: raw.petDrawn ?? null,
    bareHead: !!motion.petBareHead, lift: motion.petLift ?? 0,
    armAngle: motion.armAngle ?? 0,
    solidAt: motion.petWorld?.solidAt ?? null,
    walkRunJump: PET_WALK_RUN_JUMP[item.id] ?? null,
    flyWalk: PET_FLY_WALK_ITEMS.has(item.id) ? PET_FLY_WALK : null,
  };
  const engine = item.petEngine ??= new PetEngine();
  engine.step(host, Math.min(0.05, (motion.dtMs ?? 1000 / 60) / 1000));
  const pet = engine.pet;
  // The source publishes the pet output on the motion controller (motion.pet);
  // the FX layer reads pet.velocity.*/distanceToPet from it and the scripted
  // renderer machines read the custom variables (CompareCustomVariable:
  // PunchDelay, PetFlyWalk.* — published flat, the source sets
  // vars.set("PetFlyWalk."+k, v), so dotted lookups hit the keys directly).
  motion.pet = pet;
  motion.petState = pet ? { landed: !!pet.landed, idle: pet.idle ?? 0, v: pet.v ?? [0, 0] } : null;
  motion.petVars = {
    PunchDelay: engine.punchDelay,
    ...(pet?.flyWalk ? Object.fromEntries(Object.entries(pet.flyWalk)
      .map(([k, val]) => ["PetFlyWalk." + k, val])) : {}),
  };
  if (!pet) {
    for (const p of petPieces) p.hidden = true;
    return;
  }
  const facing = motion.facing < 0;
  // Source SQ: the sprite flip is (petPunching ? hostFacingLeft : petFaceLeft)
  // XOR the whole-pet host mirror, so while the pet shows punch cells it faces
  // the player with no relative flip. petPunching needs the player's punch
  // state plus pet records whose cells fall outside the known petCells set.
  const punching = host.punchT >= 0 && !pet.own;
  const flip = petPunching(item, host, punching) ? false : (pet.face < 0) !== facing;
  const scale = pet.scale ?? 1;
  const rot = pet.rot ?? 0;
  const rotRad = rot * Math.PI / 180;
  const [cos, sin] = [Math.cos(rotRad), Math.sin(rotRad)];
  const main = petPieces.find(p => p.sw && !p.petExtra) ?? petPieces[0];
  // Machine extras (dragon wing) are authored-space copies of the main piece,
  // re-authored every step, that join the group before the transform so the
  // pet transform applies to them exactly as it does to the authored pieces.
  if (pet.extra) applyPetExtra(petPieces, pet, item);
  // Group anchor d: the average of the pet pieces' authored anchor points.
  // The source composes T(pet-host) * R * flip * S * T(-d) over each piece's
  // own matrix, so a piece's anchor lands at the pet position plus its offset
  // from d; for a single-piece pet the authored anchor cancels entirely.
  const pins = petPieces.filter(p => !p.petExtra).map(p => [p.x ?? 0, p.y ?? 0]);
  const d = pins.length ? [
    pins.reduce((a, v) => a + v[0], 0) / pins.length,
    pins.reduce((a, v) => a + v[1], 0) / pins.length,
  ] : [0, 0];
  for (const p of petPieces) {
    p.hidden = false;
    const offX = (p.x ?? 0) - d[0], offY = (p.y ?? 0) - d[1];
    const fx = (flip ? -1 : 1) * scale * offX, fy = scale * offY;
    const tX = cos * fx - sin * fy, tY = sin * fx + cos * fy;
    const localX = pet.x - hostX + tX, localY = pet.y - hostY + tY;
    p.x = facing ? 32 - localX : localX;
    p.y = localY;
    p.k = [(flip ? -1 : 1) * scale, scale];
    if (!p.petExtra) { p.r = rot; p.rp = [0, 0]; }
    p.pass = "RenderPet";
    p.attachment = "pet";
    p.unlifted = true;
    applyPetCell(p, pet, main, item);
  }
  if (pet.string) {
    const s = pet.string;
    const line = {
      from: worldToLocal(s.from, hostX, hostY, facing),
      to: worldToLocal(s.to, hostX, hostY, facing),
      width: s.width ?? 1, rgb: s.rgb ?? [180, 180, 180],
    };
    // The string is a piece-level line primitive; render.mjs draws it.
    // petLine flags it for the next step's cleanup so it cannot accumulate.
    item.pieces.push({
      line, pass: "RenderBehind", attachment: "pet", unlifted: true, pet: true,
      petLine: true, sw: 0, sh: 0, k: [1, 1], x: 0, y: 0, ax: 0, ay: 0,
    });
  }
}

function latestPunchId(motion) {
  const events = motion.events ?? [];
  for (let i = events.length - 1; i >= 0; i--)
    if (events[i].type === "punch") return events[i].id ?? events[i].at;
  return null;
}

// Source petPunching(): the player's move is a punch and the pet item's move
// record carries pet records whose cells sit outside the known petCells set —
// the pet's own punch pose. No current planner item ships such cells, so this
// gate only future-proofs the flip; it must not invent punch cells.
function petPunching(item, host, punching) {
  if (!punching) return false;
  const clip = item.clips?.punch;
  if (!clip) return false;
  const frames = Array.isArray(clip) ? clip : clip.frames;
  if (!Array.isArray(frames)) return false;
  const known = new Set(Object.values(item.raw?.petCells ?? {})
    .flatMap(o => (o.cells ?? []).map(b => b.join(","))));
  if (!known.size) return false;
  const petRecords = frames.flat().filter(r => r && r.pet && r.sw);
  return petRecords.some(r =>
    !known.has(`${Math.round(r.sx / r.sw)},${Math.round(r.sy / r.sh)}`));
}

function worldToLocal(pt, hostX, hostY, facing) {
  const x = pt[0] - hostX, y = pt[1] - hostY;
  return [facing ? 32 - x : x, y];
}

// Cell override, ported from the source pet draw (Ef): the main piece takes the
// absolute cell (machine pets included — their 64x64 pieces read cells straight
// off the shared sheet, col*sw / row*sh); kinds 25/26 (owlbeard) shift a second
// piece that sits exactly three cells to the right of the main one.
function applyPetCell(p, pet, main, item) {
  if (pet.cell && p.sw) {
    if (!main || p === main) {
      p.sx = pet.cell[0] * p.sw;
      p.sy = pet.cell[1] * p.sh;
      return;
    }
    const kind = petKindFor(item.id);
    if (p.a !== main.a || p.sy !== main.sy || ![25, 26].includes(kind) || p.sx - main.sx !== 3 * main.sw) return;
    p.sx = p.sx + (pet.cell[0] * main.sw - main.sx);
    p.sy = pet.cell[1] * p.sh;
    return;
  }
  if (pet.frame !== undefined && p.sw) p.sx = pet.frame * p.sw;
}

// Dragon wing-flap extra piece (machine state 6): an authored-space copy of the
// main piece reading the absolute cell below the machine row, spinning around
// the main piece's anchor point (the source rotates the extra around the main
// pin) and offset by (dx, dy). Authored before the group transform so the pet
// transform composes over it exactly as over the main pieces; the step cleanup
// removes it again next frame.
function applyPetExtra(petPieces, pet, item) {
  const main = petPieces.find(p => p.sw && !p.petExtra);
  if (!main) return;
  for (const e of pet.extra) {
    const piece = {
      ...main, petExtra: true, add: !!e.add,
      pass: "RenderPet", attachment: "pet", unlifted: true, pet: true,
      sx: e.cell[0] * main.sw, sy: e.cell[1] * main.sh,
      x: (main.x ?? 0) + e.dx, y: (main.y ?? 0) + e.dy,
      r: e.r, rp: [-e.dx, -e.dy],
    };
    petPieces.push(piece);
    item.pieces.push(piece);
  }
}
