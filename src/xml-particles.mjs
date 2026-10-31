// XmlParticleLayer: runs the particle engine for every equipped item that has a compiled XML renderer
// and returns normalized draw calls (world-space, call.world=true) for buildDrawList().
import { Script, BEHIND, FRONT } from "./fx-engine.mjs";
import { compose, translate, rotate, scale } from "./math.mjs";
import { locomotionState } from "./motion-policy.mjs";

const STAGES = [...BEHIND, ...FRONT];
export class XmlParticleLayer {
  constructor(renderers = {}, { seed = 1, maxDtMs = 100 } = {}) {
    this.renderers = renderers; this.seed = seed; this.maxDtMs = maxDtMs;
    this.scripts = new Map(); this.hasAtlas = () => true; this.lastPunchId = null;
  }
  reset() { this.scripts.clear(); this.lastPunchId = null; }
  retain(items) {
    const ids=new Set(items.map(item=>item.id));
    for(const id of this.scripts.keys())if(!ids.has(id))this.scripts.delete(id);
  }
  scriptFor(item) {
    const name = item.raw?.script, data = name && this.renderers[name];
    if (!data?.particles?.length) return null;
    let s = this.scripts.get(item.id);
    if (!s || s.name !== name) { s = new Script(name, data, () => null, (this.seed + item.id) >>> 0); this.scripts.set(item.id, s); }
    return s;
  }
  hostFor(motion, pose, lift, events) {
    const loc = locomotionState(motion), vx = motion.vx ?? 0, vy = motion.vy ?? 0;
    const punching = !!motion.punch;
    const action = punching ? "PUNCH" : loc.airborne ? (vy < 0 ? "JUMP" : "FALL") : loc.moving ? "WALK" : "IDLE";
    const f = motion.facing < 0 ? -1 : 1;
    return {
      action, facing: f, x: (motion.worldX ?? motion.x ?? 0)+(lift?.x??0),
      y: (motion.worldY ?? motion.y ?? 0)+(lift?.y??0), vx, vy,
      onGround: !loc.airborne, punching, punches: motion.punchCount ?? 1,
      punchStart: events.some(e => e.type === "punch"), punchStop: false,
      justJumped: events.some(e => e.type === "jump" || e.type === "doubleJump"), jumpDouble: events.some(e => e.type === "doubleJump"),
      holdJump: !!motion.jumpHeld, target: motion.punch?.target ?? [16 + 60, 32],
      arm2: pose?.frontAngle ?? 0, hitTile: false, destroyTile: false,
      renderContext:motion.renderContext??{},petVars:motion.petVars,pet:motion.pet,
      solidAt:motion.particleWorld?.solidAt,
      events: events.filter(e=>e.type==="respawn").map(()=>"OnRespawned")
    };
  }
  // Returns draw calls; items = equipped items; motion = MotionFrame; pose = rig pose; lift = resolved lift.
  step(items, motion, pose, lift, dtMs) {
    const calls = [], live = new Set();
    const dt = Number.isFinite(dtMs)?Math.max(0, Math.min(dtMs, this.maxDtMs)) / 1000:0;
    const events = motion.events ?? [];
    // The host tracks absolute births, but draw calls use the caller's render
    // origin. The integrated preview renders the rig at (0,0) while travelling.
    const ox = (motion.x ?? 0) + 16 + (lift?.x ?? 0), oy = (motion.y ?? 0) + 32 + (lift?.y ?? 0);
    for (const item of items) {
      const sc = this.scriptFor(item); if (!sc) continue;
      live.add(item.id);
      // Motion events may be presented again during a render-only sample.
      // Each script owns its own bounded cursor, including late equipment.
      const seen=sc.seenEvents??=new Set();
      const fresh=events.filter(event=>!seen.has(event.id));
      const host = this.hostFor(motion, pose, lift, fresh);
      host.renderContext={...host.renderContext,itemTransformed:(host.renderContext.transmutedIds??[]).includes(item.id)};
      host.punchStop=!!sc.wasPunching&&!host.punching;
      if(dt>0) {
        for(const event of fresh)seen.add(event.id);
        while(seen.size>512)seen.delete(seen.values().next().value);
        sc.wasPunching=host.punching;
      }
      if (dt > 0) sc.step(dt, host); else sc.host = host;
      const drawn = new Set();
      for (const stage of STAGES) for (const sys of sc.stageSystems(stage)) { drawn.add(sys); this.emit(calls, sc, sys, stage, ox, oy, host, item); }
      for (const sys of sc.systems) if (!drawn.has(sys)) this.emit(calls, sc, sys,
        String(sys.ps.isBackgroundParticle)==="true"?"RenderBehind":"PARTICLES", ox, oy, host, item);
    }
    for (const id of [...this.scripts.keys()]) if (!live.has(id)) this.scripts.delete(id);
    return calls;
  }
  emit(calls, sc, sys, pass, ox, oy, host, item) {
    for (const r of sc.records(sys, host.facing)) {
      if (!this.hasAtlas(r.atlas)) continue;
      calls.push({
        atlas: r.atlas, sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh, alpha: r.alpha, tint: r.tint, add: r.add,blend:r.blend,
        pass, owner: item.id, xmlParticle: true, fxEngine: true, world: true, attachment: "world", pet: false, smooth: false,
        matrix: compose(translate(ox + r.X, oy + r.Y), rotate(r.ang), scale(r.kx, r.ky), translate(-r.ax, -r.ay))
      });
    }
  }
}
