// Particle engine for Growtopia ItemRenderer scripts (compiled XML IR: {tag,a,v,c}).
// Ported from the planner FX Lab. Pure ES module: no DOM. Emits plain records / draw calls.
// Coverage: ParticleSystem Emitter/Particle semantics, state machines, punch/walk/jump/tile events.
// NOT covered: item sprites, AvatarTransform arm/face effects, pets (see README_FX.md).
  const TICK = 0.033;
const nums = s => String(s ?? '').split(/[,\s]+/).filter(x => x !== '').map(Number).filter(x => !isNaN(x));
const bool = s => String(s).toLowerCase() === 'true';
const two = v => Array.isArray(v) ? v : [v ?? 0, v ?? 0];
const num = v => Array.isArray(v) ? (v[0] ?? 0) : typeof v === 'boolean' ? +v : (typeof v === 'number' ? v : parseFloat(v) || 0);
const lerp = (a, b, t) => a + (b - a) * t;
const unsupported = {};
const note = k => { unsupported[k] = (unsupported[k] || 0) + 1; };
function val(s) {            // "1" -> 1, "1,2" -> [1,2], "true" -> true, "abc" -> "abc"
  const t = String(s ?? '').trim();
  if (t === 'true' || t === 'false') return t === 'true';
  const n = nums(t);
  if (!n.length || /[A-Za-z_]/.test(t.replace(/e[+-]?\d/i, ''))) return t;
  return n.length === 1 ? n[0] : n;
}
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function curve(node, t) {    // KeyFrame "t, v1[, v2]" linear interpolate
  const k = node.c.filter(c => c.tag === 'KeyFrame').map(c => nums(c.v)).sort((a, b) => a[0] - b[0]);
  if (!k.length) return [1];
  if (t <= k[0][0]) return k[0].slice(1);
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
    const a = k[i - 1], b = k[i], f = (t - a[0]) / ((b[0] - a[0]) || 1);
    return b.slice(1).map((v, j) => lerp(a[j + 1] ?? v, v, f));
  }
  return k[k.length - 1].slice(1);
}
const ALIGN = { UPPER: 0, DOWN: 1 };
function align(a, w, h) {
  a = String(a || 'CENTER').replace(/^ALIGNMENT_/, '');
  const x = /LEFT/.test(a) ? 0 : /RIGHT/.test(a) ? w : w / 2;
  const y = /^UPPER/.test(a) ? 0 : /^DOWN/.test(a) ? h : h / 2;
  return a === 'UPPER_LEFT' ? [0, 0] : [x, y];
}
class Script {
  constructor(name, data, atlases, seed = 1) {
    this.name = name; this.data = data; this.atlases = atlases; this.rand = mulberry(seed);
    this.vars = new Map(); this.t = 0; this.tick = 0; this.states = {}; this.sinceJump = 1e9;
    this.sprites = new Map();
    for (const [k, s] of Object.entries(data.sprites || {})) {
      const ts = nums(s.textureSize); const f = nums(s.frame);
      this.sprites.set(k, { name: k, atlas: s.atlas, w: ts[0] || 32, h: ts[1] ?? ts[0] ?? 32, frame: [f[0] || 0, f[1] || 0] });
    }
    this.anims = (data.animations || []).filter(a => a.tag === 'SpriteAnimation' || a.tag === 'Animation').map(a => ({
      node: a, sprite: a.a.sprite, frames: a.c.filter(c => c.tag === 'Frame').map(c => nums(c.v).map(Math.round)),
      loop: a.a.isLoop === undefined ? !(a.a.playOnState || a.a.playOnAction) : bool(a.a.isLoop),
      len: (parseFloat(a.a.animTime) || a.c.filter(c => c.tag === 'Frame').length * 100) / 1000, a: a.a
    }));
    for (const [k, d] of Object.entries(data.vars || {})) this.vars.set(k, val(d.v));
    this.machines = (data.machines || []).map(m => ({
      name: m.a.name, node: m, since: 0,
      hold: Object.fromEntries((m.c.find(c => c.tag === 'States')?.c || []).filter(x => x.a.ExitTime).map(x => [x.a.name, parseFloat(x.a.ExitTime)])),
      states: m.c.find(c => c.tag === 'States')?.c.map(s => s.a.name) || [],
      trans: m.c.find(c => c.tag === 'Transitions')?.c || []
    }));
    for (const m of this.machines) this.states[m.name] = m.states[0];
    for (const a of this.anims) a.started = null;
    this.systems = (data.particles || []).map(n => this.makeSystem(n));
    this.byName = new Map(this.systems.map(s => [s.attr.name, s]));
    this.rules = data.rules;
    this.stages = {};
    for (const c of (this.rules?.c || [])) (this.stages[c.tag] ||= []).push(c);
    this.auto = this.systems;
  }
  makeSystem(n) {
    const em = n.c.find(c => c.tag === 'Emitter') || { a: {}, c: [] }, pa = n.c.find(c => c.tag === 'Particle') || { a: {}, c: [] };
    const sets = nd => { const o = {}; for (const c of nd.c) if (c.tag === 'Set' && c.a.name) o[c.a.name] = c.a.source ? { src: c.a.source } : c.v; return o; };
    const st = n.a.updateStage;
    return {
      node: n, attr: n.a, em, pa, es: sets(em), ps: sets(pa),
      on: st === 'AddClothingParticles' || st === 'Update' || st === 'ContextUpdate' || /^Render/.test(st || ''),
      age: 0, emitted: 0, next: 0, acc: 0, clock: 0, live: [], pulse: undefined, stepped: false, wasIn: undefined
    };
  }
  // ---- state / conditions -------------------------------------------------
  actionIs(list, h) {
    const a = this.host.action;
    return String(list).split('|').some(x => {
      x = x.trim().toUpperCase();
      if (x === 'JUMPSTART') return this.sinceJump < 150;
      if (x === 'JUMPDOUBLE') return this.host.jumpDouble && this.sinceJump < 150;
      return x === a || (a === 'IDLE' && x === 'NONE');
    });
  }
  inStates(list) {
    return String(list).split('|').some(x => { x = x.trim(); const d = x.lastIndexOf('.'); return this.states[x.slice(0, d)] === x.slice(d + 1); });
  }
  gated(h) {
    if (h.onState && !this.inStates(h.onState)) return false;
    if (h.onAction && !this.actionIs(h.onAction, h)) return false;
    if (h.useFacing && h.useFacing.toUpperCase() !== (this.host.facing < 0 ? 'LEFT' : 'RIGHT')) return false;
    return true;
  }
  getVar(n) {
    if (this.vars.has(n)) return this.vars.get(n);
    const h = this.host;
    // Custom variables published by the pet engine step (flat dotted keys —
    // PunchDelay, PetFlyWalk.*) reach FX conditions the same way the source's
    // vars map does.
    if (h.petVars && n in h.petVars) return h.petVars[n];
    const dot = n.lastIndexOf('.');
    if (dot > 0 && !['speed.x','speed.y','speed.length','pet.velocity.x','pet.velocity.y','pet.velocity.length'].includes(n)) { const base = this.getVar(n.slice(0, dot)), c = n.slice(dot + 1); if (Array.isArray(base)) return c === 'length' ? Math.hypot(...base) : base[{ x: 0, y: 1, z: 2 }[c] ?? 0] ?? 0; }
    if (n === 'speed.x') return h.vx; if (n === 'speed.y') return h.vy;
    if (n === 'speed.length') return Math.hypot(h.vx, h.vy);
    if (n === 'pet.velocity.x') return h.pet?.v?.[0] ?? 0;
    if (n === 'pet.velocity.y') return h.pet?.v?.[1] ?? 0;
    if (n === 'pet.velocity.length') return h.pet?.speed ?? Math.hypot(...(h.pet?.v ?? [0, 0]));
    if (n === 'pet.facingLeft') return (h.pet?.face ?? 1) < 0;
    if (n === 'distanceToPet') return h.pet?.dist ?? 0;
    if (n === 'onGround') return h.onGround;
    if (n === 'Player.GetFacing') return h.facing;
    if (n === 'punchCount') return h.punches || 0;
    if (n === 'isMoving') return Math.abs(h.vx) > 0.1;
    if (n === 'PunchDelay') return h.petVars?.PunchDelay ?? 0;
    return undefined;
  }
  cmp(a, b, op) {
    switch (op) { case 'Greater': return a > b; case 'GreaterOrEqual': return a >= b; case 'Less': return a < b; case 'LessOrEqual': return a <= b; case 'NotEqual': return a !== b; default: return a === b; }
  }
  cond(n) {
    const a = n.a, w = (n.v || '').trim(), O = a.operatorType || a.operator || 'Equal';
    const neg = /NotEqual/.test(O) && n.tag !== 'IsVariableFloat' && n.tag !== 'CompareCustomVariable';
    let k;
    switch (n.tag) {
      case 'Condition': case 'SubCondition': return (a.type || 'and').toLowerCase() === 'or' ? n.c.some(c => this.cond(c)) : n.c.every(c => this.cond(c));
      case 'IsAction': k = this.actionIs(w); break;
      case 'IsWearing': k = false; break;                       // planner supplies equipped set; none assumed here
      case 'IsInState': k = this.inStates(a.name) === bool(w); break;
      case 'IsVariableBool': k = !!this.getVar(a.name) === bool(w); break;
      case 'IsVariableFloat': { let x = num(this.getVar(a.name)); if (bool(a.abs)) x = Math.abs(x); return this.cmp(x, num(this.value(w)), O); }
      case 'CompareCustomVariable': { const l = num(this.getVar(a.VariableNameToCompare)), r = a.RightHSVariableNameToCompare ? num(this.getVar(a.RightHSVariableNameToCompare)) : num(this.value(w)); return this.cmp(l, r, O); }
      case 'IsFacingLeft': k = (this.host.facing < 0) === bool(w || 'true'); break;
      case 'IsAnimationFinished': k = this.finished(w); break;
      case 'CheckRandomRangeNumber': { const d = parseInt(a.StartNumber ?? '0') || 0, u = parseInt(a.EndNumber ?? '0') || 0, h = u > d ? d + Math.floor(this.rand() * (u - d)) : d; return this.cmp(h, num(this.value(w)), O); }
      case 'IsRenderMod': case 'IsRenderObjectFlag': k = false; break;
      case 'ItemHasTag': case 'IsItemTransformed': k = false === bool(w || 'true') ? true : false; k = false; break;
      case 'IsHoldingJumpKey': k = !!this.host.holdJump === bool(w || 'true'); break;
      default: k = !bool(w || 'true'); if (!/^Is(Zombified|Sitting|SleepingOnaBed|Dancing|Trnsformed|DarkTile)$/.test(n.tag)) note('cond:' + n.tag); return neg ? !k : k;
    }
    return neg ? !k : k;
  }
  value(e) {
    if (e === undefined || e === null) return 0; const g = String(e).trim();
    if (/^[-\d.]/.test(g)) return val(g); if (g === 'true' || g === 'false') return g === 'true'; return this.getVar(g);
  }
  stepMachines() {
    for (const m of this.machines) {
      for (let i = 0; i < 8; i++) {
        const cur = this.states[m.name];
        const hold = m.hold[cur];
        if (hold && this.t - m.since < hold) break;
        const tr = m.trans.find(t => {
          const from = (t.a.from || '').split('|').map(x => x.trim());
          if (t.a.from && !from.includes(cur) && !from.includes('Any') && !from.includes('*')) return false;
          const cs = t.c.filter(x => x.tag === 'Condition' || x.tag === 'SubCondition');
          return cs.every(c => this.cond(c)) && t.a.to !== cur;
        });
        if (!tr) break;
        this.states[m.name] = tr.a.to; m.since = this.t;
      }
    }
  }
  animGate(a) {
    const h = a.a; if (h.playOnState && !this.inStates(h.playOnState)) return false;
    if (h.playOnAction && !this.actionIs(h.playOnAction)) return false;
    if (h.useFacing && h.useFacing.toUpperCase() !== (this.host.facing < 0 ? 'LEFT' : 'RIGHT')) return false;
    if (h.autoPlay !== undefined && !bool(h.autoPlay) && !h.playOnState && !h.playOnAction) return false;
    return true;
  }
  stepAnims(dt) {
    for (const a of this.anims) { if (!this.animGate(a)) { a.started = null; continue; } if (a.started === null) a.started = this.t - dt; }
  }
  finished(name) {
    const a = this.anims.find(x => x.a.name === name);
    return !!a && a.started !== null && !a.loop && this.t - a.started >= a.len;
  }
  // ---- rules ---------------------------------------------------------------
  exec(node) {
    for (const u of node.c) {
      const h = u.a;
      switch (u.tag) {
        case 'StopIf': if (h.type === 'and' ? u.c.length && u.c.every(c => this.cond(c)) : u.c.some(c => this.cond(c))) return false; break;
        case 'Group': if (this.gated(h)) this.exec(u); break;
        case 'ParticleSystemUpdate': if (this.gated(h)) this.update(h); break;
        case 'ParticleSystemOff': if (this.gated(h)) { const s = this.byName.get(h.name); if (s) s.on = false; } break;
        case 'ArithmethicOperation': if (this.gated(h)) this.arith(h); break;
        case 'RandomValueOperation': if (this.gated(h)) { const lo = num(this.getVar(h.MinVariableName) ?? val(h.MinVariableName)), hi = num(this.getVar(h.MaxVariableName) ?? val(h.MaxVariableName)); this.vars.set(h.LeftHandVariableName, lo + this.rand() * (hi - lo)); } break;
        case 'ParticleSystemRender': case 'SpriteRender': case 'AvatarTransform': case 'Translate': case 'Scale': case 'Rotate':
        case 'PlayerSpriteRender': case 'LineRender': case 'ContextUpdate': case 'Alpha': case 'AvatarSilhouetteRender': case 'MusicSource': case 'ParticleSystemLegacy': break; // draw-time / not needed for particles
        default: note('rule:' + u.tag);
      }
    }
    return true;
  }
  arith(h) {
    const L = h.LeftHandVariableName, rv = this.getVar(h.RightHandVariableName); const r = rv !== undefined ? rv : val(h.RightHandVariableName);
    const cur = this.vars.get(L) ?? 0, op = (h.OperationType || 'Set').toLowerCase();
    const f = { set: (a, b) => b, add: (a, b) => a + b, substract: (a, b) => a - b, subtract: (a, b) => a - b, multiply: (a, b) => a * b, divide: (a, b) => b ? a / b : a }[op];
    if (op === 'randomize') return;
    if (!f) return;
    this.vars.set(L, Array.isArray(cur) || Array.isArray(r) ? two(cur).map((x, i) => f(x, two(r)[i] ?? two(r)[0])) : f(num(cur), num(r)));
  }
  update(h) {
    const s = this.byName.get(h.name); if (!s) return;
    s.on = true; s.stepped = true;
    if (this.punchStarting) { s.age = 0; s.emitted = 0; s.next = 0; return; }
    if (h.onState || (h.onAction && !/JUMPSTART|JUMPDOUBLE/i.test(h.onAction))) {
      if (s.pulse !== undefined && s.pulse < this.tick - 1) { s.age = 0; s.emitted = 0; s.next = 0; }
      s.pulse = this.tick;
    }
  }
  runStage(name) { for (const n of this.stages[name] || []) this.exec(n); }
  // ---- stepping ------------------------------------------------------------
  step(dt, host) {
    this.host = host; this.tick++; this.t += dt;
    this.sinceJump = host.justJumped ? 0 : this.sinceJump + dt * 1000;
    this.punchStarting = !!host.punchStart;
    this.stepMachines(); this.stepAnims(dt);
    this.runStage('AddClothingParticles'); this.runStage('Update'); this.runStage('ContextUpdate');
    for (const st of [...BEHIND, ...FRONT]) this.runStage(st);   // render stages also drive ParticleSystemUpdate/Off
    if (host.hitTile) this.runStage('OnDamagedTile'); if (host.destroyTile) this.runStage('OnDestroyedTile');
    if (host.punchStart) { this.runStage('OnPunchStart'); this.runStage('OnPunchBegin'); }
    if (host.punching) this.runStage('OnPunchUpdate');
    if (host.punchStop) this.runStage('OnPunchStop');
    for (const ev of host.events || []) { this.runStage(ev); for (const sy of this.systems) if (sy.attr.updateStage === ev) { sy.on = true; sy.age = 0; sy.emitted = 0; sy.next = 0; } }
    this.punchStarting = false;
    for (const s of this.systems) {
      s.acc += dt;
      let n = 0; while (s.acc >= TICK - 1e-9 && n++ < 16) { s.acc -= TICK; this.simulate(s, TICK); }
    }
  }
  off() { for (const s of this.systems) { s.on = false; s.pulse = undefined; } }
  // ---- value resolution ----------------------------------------------------
  resolve(s, scope, name, def, cache) {
    if (cache && name in cache) return cache[name];
    const node = scope === 'pa' ? s.pa : s.em, sets = scope === 'pa' ? s.ps : s.es;
    let v;
    const q = node.c.find(c => (c.tag === 'Random' || c.tag === 'RandomRadial' || c.tag === 'Select') && c.a.name === name);
    if (q) {
      if (q.tag === 'Random') { const lo = nums(q.a.min), hi = nums(q.a.max); const o = lo.map((x, i) => x + ((hi[i] ?? x) - x) * this.rand()); v = o.length === 1 ? o[0] : o; }
      else if (q.tag === 'RandomRadial') {
        const ar = nums(q.a.angleRange), rr = nums(q.a.radiusRange);
        const an = (ar[0] + ((ar[1] ?? ar[0]) - ar[0]) * this.rand()) * Math.PI / 180, r = rr[0] + ((rr[1] ?? rr[0]) - rr[0]) * this.rand();
        v = [Math.cos(an) * r, Math.sin(an) * r];
      } else {
        const items = q.c.filter(c => c.tag === 'Item'); if (!items.length) v = def;
        else {
          const idx = q.a.input ? Math.floor(num(this.ref(s, scope, q.a.input, 0, cache))) : Math.floor(this.rand() * items.length);
          const t = String(items[((idx % items.length) + items.length) % items.length].v ?? '').trim();
          v = /^".*"$/.test(t) ? t.slice(1, -1) : val(t);
        }
      }
    } else if (name in sets) {
      const raw = sets[name]; v = raw && raw.src ? (this.getVar(raw.src) ?? def) : val(raw);
    } else v = def;
    for (const inc of node.c.filter(c => c.tag === 'Increment' && c.a.name === name)) {
      const d = this.ref(s, scope, inc.a.source, 0, cache), m = nums(inc.a.multiplier ?? '1');
      if (!Array.isArray(v) && !Array.isArray(d) && m.length < 2) v = num(v) + num(d) * (m[0] ?? 1);
      else { const a = two(v), b = two(d); v = [0, 1].map(i => (a[i] ?? a[0] ?? 0) + (b[i] ?? b[0] ?? 0) * (m[i] ?? m[0] ?? 1)); }
    }
    if (cache) cache[name] = v;
    return v;
  }
  ref(s, scope, name, def, cache) {
    if (name === undefined) return def;
    if (!isNaN(parseFloat(name))) return val(name);
    const node = scope === 'pa' ? s.pa : s.em;
    if (node.c.some(c => c.a?.name === name && c.tag !== 'Curve')) return this.resolve(s, scope, name, def, cache);
    const g = this.getVar(name); return g === undefined ? def : g;
  }
  emitterPos(s) {
    const sv = s.em.c.find(c => c.tag === 'Set' && c.a.name === 'offset' && c.a.source);
    let b = two(sv ? this.getVar(sv.a.source) ?? [0, 0] : val(s.es.offset ?? '0,0'));
    b = [b[0] ?? 0, b[1] ?? 0];
    const f = bool(s.es.offsetFacing) ? this.host.facing : 1;
    b = [b[0] * f, b[1]];
    const o = s.em.c.find(c => c.tag === 'OrbitOffset');
    if (o) {
      const a = o.a, t = s.clock * 1000, ph = (p, off) => { const T = parseFloat(p); return T ? 2 * Math.PI * (t + parseFloat(off || 0)) / T : 0; };
      const hh = ph(a.hOrbitPeriod, a.hTimeOffset), vv = ph(a.vOrbitPeriod, a.vTimeOffset);
      const mn = parseFloat(a.minScale ?? a.maxScale ?? 1), mx = parseFloat(a.maxScale ?? 1);
      return [b[0] + parseFloat(a.hAmplitude || 0) * Math.sin(hh), b[1] + parseFloat(a.vAmplitude || 0) * Math.sin(vv), mn + (mx - mn) * (1 - Math.cos(hh)) / 2, mn < mx && Math.cos(hh) > 0];
    }
    return [b[0], b[1], 1, false];
  }
  // ---- simulation ----------------------------------------------------------
  simulate(s, dt) {
    s.clock += dt;
    this.emit(s, dt);
    for (const p of s.live) {
      p.age += dt;
      if (p.vel1) { const x = Math.min(1, p.age / p.life); p.vel = [lerp(p.vel0[0], p.vel1[0], x), lerp(p.vel0[1], p.vel1[1], x)]; }
      if (p.grav) { p.vel[0] += p.grav[0] * dt; p.vel[1] += p.grav[1] * dt; }
      p.pos[0] += p.vel[0] * dt; p.pos[1] += p.vel[1] * dt; p.angle += p.spin * dt;
    }
    s.live = s.live.filter(p => p.inf || p.age < p.life);
    const sec = s.attr.secondary && this.byName.get(s.attr.secondary);
    if (sec) for (const p of s.live) {
      const R = p.trail ||= { age: 0, emitted: 0, next: 0 };
      R.age += dt; R.next -= dt;
      const n = parseInt(sec.es.particlesToEmit) || 0, per = parseInt(sec.es.particlesPerEmission) || 1, iv = parseFloat(sec.es.emissionInterval) || 0, lt = parseFloat(sec.es.lifeTime) || 0;
      if (R.next <= 0 && (!n || R.emitted < n) && (!lt || R.age <= lt)) {
        for (let i = 0; i < per; i++) this.spawn(sec, R.emitted * per + i, p.pos);
        R.emitted++; R.next = iv <= 0 ? Infinity : iv;
      }
    }
  }
  emit(s, dt) {
    if (!s.on) return;
    if (s.pulse !== undefined && s.pulse < this.tick - 1) return;
    if (s.attr.updateState) {
      const inn = this.inStates(s.attr.updateState);
      if (inn && s.wasIn === false) { s.age = 0; s.emitted = 0; s.next = 0; }
      s.wasIn = inn; if (!inn) return;
    }
    const E = s.es, e = s.age; s.age += dt;
    const delay = parseFloat(E.delayTimer) || 0, life = parseFloat(E.lifeTime) || 0;
    if (!bool(E.infLifeTime) && life > 0 && e > life + delay) {
      const st = s.attr.updateStage;
      if (st !== 'AddClothingParticles' && st !== 'Update' && !/^Render/.test(st || '') && s.pulse === undefined && !s.stepped) return;
      s.age = dt; s.emitted = 0; s.next = 0;
      if (s.pulse !== undefined && life <= 0.034 && (parseFloat(s.ps.lifeTime ?? 1) || 1) <= 0.05) s.live.length = 0;
    }
    if (s.age < delay) return;
    const inf = bool(E.infParticles), chk = bool(E.checkParticleNumToEmit);
    s.next -= dt;
    if (s.next <= 0) {
      const ev = {};
      for (const q of s.em.c) if (q.tag === 'Random' && q.a.name) { const lo = nums(q.a.min), hi = nums(q.a.max); const o = lo.map((x, i) => x + ((hi[i] ?? x) - x) * this.rand()); ev[q.a.name] = o.length === 1 ? o[0] : o; }
      s.emitV = ev;
      const g = (k, d) => ev[k] !== undefined ? Math.floor(num(ev[k])) : (parseInt(E[k] ?? d) || 0);
      const tot = g('particlesToEmit', '0'), per = g('particlesPerEmission', '1') || 1;
      if (tot && !inf && s.emitted >= tot) return;
      const iv = ev.emissionInterval !== undefined ? num(ev.emissionInterval) : bool(E.randomizeInterval) ? lerp(parseFloat(E.intervalMin ?? 0.1), parseFloat(E.intervalMax ?? E.intervalMin ?? 0.1), this.rand()) : parseFloat(E.emissionInterval ?? 0);
      if (tot && chk && s.emitted >= tot) { s.next = iv || 0.05; return; }
      for (let i = 0; i < per; i++) this.spawn(s, s.emitted * per + i);
      s.emitted++; s.next = iv <= 0 ? Infinity : iv;
    }
  }
  handBase(s) {
    const att = s.em.a.attachment; const h = this.host;
    if (att === 'targetPos' || att === 'targetPos2') return [h.target[0] - 16, h.target[1] - 32];
    if (att === 'handspotRoot') {
      const o = [9, 18], a = (h.arm2 || 0) * Math.PI / 180;
      return [o[0] - 16, o[1] - 32, a];
    }
    return null;
  }
  spawn(s, idx, at = null) {
    const h = this.host, ps = s.ps, A = s.pa.a, cache = {}, rel = bool(ps.relativeToEmitter);
    let base;
    const hb = !at && this.handBase(s);
    const ep = !at ? this.emitterPos(s) : null;
    if (at) base = [at[0], at[1]];
    else if (rel) base = [0, 0];
    else if (hb) {
      const off = [ep[0], ep[1]], a = hb[2] || 0, c = Math.cos(a), si = Math.sin(a);
      base = [hb[0] + (hb[2] !== undefined ? c * off[0] - si * off[1] : off[0]), hb[1] + (hb[2] !== undefined ? si * off[0] + c * off[1] : off[1])];
    } else base = [ep[0], ep[1]];
    const ofs = two(this.resolve(s, 'pa', 'offset', [0, 0], cache)), pos = two(this.resolve(s, 'pa', 'posOffset', [0, 0], cache));
    const wp = this.resolve(s, 'pa', 'worldPos', null, cache);
    let P0 = wp ? [two(wp)[0] - 16 + (ofs[0] ?? 0), two(wp)[1] - 32 + (ofs[1] ?? 0)] : [base[0] + (ofs[0] ?? 0) + (pos[0] ?? 0), base[1] + (ofs[1] ?? 0) + (pos[1] ?? 0)];
    if (!at && !rel) P0 = [P0[0], P0[1]];
    let life = num(this.resolve(s, 'pa', 'lifeTime', 1, cache)) || 1;
    let v0 = two(this.resolve(s, 'pa', 'initialVelocity', [0, 0], cache));
    let v1 = bool(ps.interpolateVelocity) ? two(this.resolve(s, 'pa', 'finalVelocity', null, cache) ?? [NaN]) : null;
    const vecTo = nm => {
      const q = s.pa.c.find(c => c.tag === 'VectorTo' && c.a.name === nm); if (!q) return null;
      const tgt = q.a.source === 'targetPos' ? [h.target[0] - 16, h.target[1] - 32] : [0, 0];
      const off = q.a.offset ? two(this.ref(s, 'pa', q.a.offset, [0, 0], cache)) : [0, 0];
      const d = [tgt[0] + (off[0] ?? 0) - P0[0], tgt[1] + (off[1] ?? 0) - P0[1]];
      const dur = q.a.duration === 'lifeTime' ? life : (num(this.ref(s, 'pa', q.a.duration, life, cache)) || life);
      const k = num(this.ref(s, 'pa', q.a.x, 1, cache)), an = num(this.ref(s, 'pa', q.a.angle, 0, cache)) * Math.PI / 180;
      const dist = Math.hypot(d[0], d[1]), ang = Math.atan2(d[1], d[0]) + (d[0] < 0 ? 1 : -1) * an;
      return [k * dist * Math.cos(ang) / dur, k * dist * Math.sin(ang) / dur + (parseFloat(q.a.upSpeed) || 0)];
    };
    v0 = vecTo('initialVelocity') || v0;
    const rr = s.pa.c.find(c => c.tag === 'RandomRadial' && c.a.name === 'initialVelocity' && c.a.baseAnglePosition === 'targetPos');
    if (rr) {
      const bo = nums(rr.a.baseOffset || '0,0'); const d = [h.target[0] - 16 + (bo[0] ?? 0) - P0[0], h.target[1] - 16 + (bo[1] ?? 0) - P0[1]];
      const an = Math.atan2(v0[1], v0[0]) + Math.atan2(d[1], d[0]), m = Math.hypot(v0[0], v0[1]);
      v0 = [Math.cos(an) * m, Math.sin(an) * m];
      if (bool(A.autoLifeTimeToTarget) && m > 0) life = Math.max(0.02, Math.hypot(d[0], d[1]) / m);
    }
    if (v1) v1 = vecTo('finalVelocity') || (isNaN(v1[0]) ? null : v1);
    // sprite + frames
    let spr = s.pa.c.some(c => c.tag === 'Select' && c.a.name === 'sprite') ? this.resolve(s, 'pa', 'sprite', ps.sprite, cache) : ps.sprite;
    const anim = spr && this.anims.find(a => a.sprite === spr);
    const frames = anim ? anim.frames : [];
    let frame = null, an = null;
    const sp = this.sprites.get(spr);
    if (!sp) { note('sprite-missing:' + s.attr.name); return; }
    if (bool(A.alternateSpriteFrameWithPunch)) frame = [sp.frame[0] + (((h.punches || 1) + 1) % 2), sp.frame[1]];
    else if (frames.length && bool(A.randomSpriteFrame)) frame = frames[Math.floor(this.rand() * frames.length)];
    else if (frames.length && (bool(A.particleIndexSpriteFrame) || bool(ps.inSpecificOrder))) frame = frames[idx % frames.length];
    else if (frames.length) an = { frames, len: anim.a.animTime !== undefined ? anim.len : frames.length * TICK, loop: true };
    const grav = bool(ps.useGravity) ? two(val(ps.gravityVector ?? '0,0')) : null;
    const ang0 = num(this.resolve(s, 'pa', 'initialAngle', 0, cache));
    for (const sv of s.pa.c.filter(c => c.tag === 'SetVar')) if (sv.a.name) this.vars.set(sv.a.name, this.ref(s, 'pa', sv.a.source, 0, cache));
    const sc0 = two(this.resolve(s, 'pa', 'initialScale', [1, 1], cache)), sc1 = bool(ps.interpolateScale) ? two(val(ps.finalScale ?? '1')) : null;
    const rgb = ps.initalRGB !== undefined ? two3(val(ps.initalRGB)) : null;
    s.live.push({
      pos: P0, vel: [v0[0] ?? 0, v0[1] ?? 0], vel0: v1 ? [v0[0] ?? 0, v0[1] ?? 0] : null, vel1: v1 ? [v1[0] ?? 0, v1[1] ?? 0] : null,
      grav, age: 0, life, inf: bool(ps.infLifeTime), sprite: spr, frame, anim: an,
      scale0: [sc0[0] ?? 1, sc0[1] ?? sc0[0] ?? 1], scale1: sc1, rgb, angle: ang0, spin: num(this.resolve(s, 'pa', 'initialRotationRate', 0, cache)),
      world: !rel && !at ? [h.x, h.y, h.facing < 0 ? -1 : 1] : null, roff: rel ? ep : null, orbitStart: num(this.resolve(s, 'pa', 'orbitStart', 0, cache))
    });
  }
  // ---- drawing -------------------------------------------------------------
  stageOf(s) { return s.attr.renderStage || s.renderPass || null; }
  // Visible particles of one system as plain records (local space, screen-direct for world particles).
  records(s, facing) {
    const ps = s.ps, out = [], fc = facing < 0 ? -1 : 1, add = /ADDITIVE/.test(ps.blendingMode || '');
    for (const p of s.live) {
      const sp = this.sprites.get(p.sprite); if (!sp || !sp.atlas) continue;
      const t = p.inf ? 0 : Math.min(1, p.age / p.life);
      let al = num(val(ps.initialAlpha ?? '1'));
      const cA = s.pa.c.find(c => c.tag === 'Curve' && c.a.name === 'initialAlpha');
      if (cA) al = curve(cA, t)[0] ?? 1; else if (bool(ps.interpolateAlpha)) al += (num(val(ps.finalAlpha ?? '0')) - al) * t;
      if (al <= 0.01) continue;
      let [sx, sy] = p.scale0;
      const cS = s.pa.c.find(c => c.tag === 'Curve' && c.a.name === 'initialScale');
      if (cS) { const v = curve(cS, t); sx = v[0] ?? sx; sy = v[1] ?? v[0] ?? sy; }
      else if (p.scale1) { sx += ((p.scale1[0] ?? 1) - sx) * t; sy += ((p.scale1[1] ?? p.scale1[0] ?? 1) - sy) * t; }
      let rgb = p.rgb;
      if (rgb && bool(ps.interpolateRGB) && ps.finalRGB) { const f = two3(val(ps.finalRGB)); rgb = rgb.map((v, i) => Math.round(lerp(v, f[i] ?? 1, t) * 64) / 64); }
      let fr = p.frame || sp.frame;
      if (p.anim) { const k = p.anim.len > 0 ? p.age / p.anim.len : 0; fr = p.anim.frames[Math.floor((p.anim.loop ? k % 1 : Math.min(k, 0.999)) * p.anim.frames.length)]; }
      const [ax, ay] = align(ps.renderAlignment, sp.w, sp.h);
      let ang = bool(ps.rotateWithVelocity) && (p.vel[0] || p.vel[1]) ? Math.atan2(p.vel[1], p.vel[0]) * 180 / Math.PI : p.angle;
      let X = p.pos[0], Y = p.pos[1], screenDirect = false;
      if (bool(ps.applyOrbit)) {
        const cO = s.pa.c.find(c => c.tag === 'Curve' && c.a.name === 'orbit');
        const ob = cO ? curve(cO, t) : two(val(ps.orbit ?? '0,0')), per = num(val(ps.orbitPeriod ?? '0'));
        if (per) {
          const th = 2 * Math.PI * (p.age / per + p.orbitStart), sn = Math.sin(th), cs = Math.cos(th), sk = num(val(ps.orbitSkew ?? '0'));
          X += (ob[0] ?? 0) * cs; Y += (ob[1] ?? 0) * (sn + sk * cs);
          const sv = num(val(ps.orbitScaleVariation ?? '0')) * sn; sx += sv; sy += sv;
          if (sn < 0) continue;
        }
      }
      if (bool(ps.relativeToEmitter)) {
        const e = this.emitterPos(s); let ex = e[0], ey = e[1];
        if (p.roff) { ex += p.roff[0] ?? 0; ey += p.roff[1] ?? 0; }
        X += ex; Y += ey; sx *= e[2]; sy *= e[2]; X = fc * X;
      } else if (p.world) {
        X = p.world[2] * X + p.world[0] - this.host.x; Y += p.world[1] - this.host.y; screenDirect = true;
        if (fc !== p.world[2]) ang = 180 - ang;
      } else X = fc * X;
      if (bool(ps.isBeamParticle)) {
        const tx = this.host.target[0] - 16, ty = this.host.target[1] - 32;
        ang = Math.atan2(ty - Y, fc * tx - X) * 180 / Math.PI; sx = Math.hypot(fc * tx - X, ty - Y) / sp.w;
      }
      out.push({ atlas: sp.atlas, sx: fr[0] * sp.w, sy: fr[1] * sp.h, sw: sp.w, sh: sp.h, X, Y, ang: fc < 0 ? -ang : ang,
        kx: sx * (bool(ps.flipX) ? -1 : 1) * (fc < 0 ? -1 : 1), ky: sy * (bool(ps.flipY) ? -1 : 1), ax, ay,
        alpha: Math.min(1, al), add, tint: rgb ? rgb.map(v => Math.round(Math.min(1, v) * 255)) : null, screenDirect });
    }
    return out;
  }
  // draw all systems belonging to a render stage (or those with none, when stage==='*')
  stageSystems(stage) {
    const out = [];
    for (const s of this.systems) {
      const rs = s.attr.renderStage;
      if (rs) { if (rs === stage) out.push(s); continue; }
    }
    for (const st of this.stages[stage] || []) this.collectRender(st, out);
    return out;
  }
  collectRender(n, out) {
    for (const u of n.c) {
      if (u.tag === 'ParticleSystemRender' && this.gated(u.a)) { const s = this.byName.get(u.a.name); if (s && !out.includes(s)) out.push(s); }
      else if (u.tag === 'Group' && this.gated(u.a)) this.collectRender(u, out);
      else if (u.tag === 'StopIf' && (u.a.type === 'and' ? u.c.length && u.c.every(c => this.cond(c)) : u.c.some(c => this.cond(c)))) return;
    }
  }
}

function two3(v) { const a = Array.isArray(v) ? v : [v, v, v]; return [a[0] ?? 1, a[1] ?? a[0] ?? 1, a[2] ?? a[0] ?? 1]; }
export const BEHIND = ['RenderBehind', 'RenderBackHair', 'RenderBackHat', 'RenderBackpack', 'RenderBackHandItem', 'RenderBackArm', 'RenderChestBackItem'];
export const FRONT = ['RenderShoes', 'RenderPants', 'RenderShirt', 'RenderChestItem', 'RenderFrontpack', 'RenderFrontArm', 'RenderFaceItem', 'RenderHair', 'RenderHat', 'RenderHandItem', 'RenderPet', 'RenderInFront'];
export { Script, TICK, unsupported };
export const coverage = () => ({ ...unsupported });
