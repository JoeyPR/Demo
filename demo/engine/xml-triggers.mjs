// Builds, per script, the table of "what starts / stops each ParticleSystem".
// Triggers come from FOUR places (hooks alone miss ~41% of systems):
//   rule     : <ParticleSystemUpdate|Render|Off name=..> nested under a <RenderRules> hook (AddClothingParticles, RenderBehind, ...)
//   stage    : attributes ON the <ParticleSystem> element: updateStage / updateState / renderStage
//   onFinish : another particle's <OnFinish><ParticleSystemName>..</ParticleSystemName></OnFinish>
//   secondary: attribute secondary="..." on the <ParticleSystem> (child system spawned by another system)
const kids = (n, tag) => (n?.c ?? []).filter(c => !tag || c.tag === tag);
const walk = n => n ? [n, ...kids(n).flatMap(walk)] : [];
const RULE_TAGS = ["ParticleSystemUpdate", "ParticleSystemRender", "ParticleSystemOff"];
export const CATEGORIES = ["hooked-only", "hooked+staged", "hooked+secondary", "staged-only", "staged+secondary", "secondary-only", "no-trigger"];

export function buildTriggerTable(renderer) {
  const systems = new Map();
  for (const ps of renderer.particles ?? []) {
    systems.set(ps.a.name, {
      name: ps.a.name, rule: [], onFinish: [],
      stage: Object.fromEntries(["updateStage", "updateState", "renderStage"].filter(k => ps.a[k]).map(k => [k, ps.a[k]])),
      secondary: ps.a.secondary ?? null
    });
  }
  const unresolved = [];
  for (const hook of kids(renderer.rules)) {
    for (const n of walk(hook)) {
      if (!RULE_TAGS.includes(n.tag)) continue;
      const row = { hook: hook.tag, kind: n.tag.replace("ParticleSystem", ""), onAction: n.a.onAction ?? null, onState: n.a.onState ?? null };
      const s = systems.get(n.a.name);
      if (s) s.rule.push(row); else unresolved.push({ name: n.a.name, ...row });
    }
  }
  for (const ps of renderer.particles ?? []) {
    for (const n of walk(ps)) {
      if (n.tag !== "ParticleSystemName") continue;
      const target = String(n.v).trim(), s = systems.get(target);
      if (s) s.onFinish.push(ps.a.name); else unresolved.push({ name: target, hook: "OnFinish", kind: "Name", from: ps.a.name });
    }
  }
  const out = [...systems.values()].map(s => {
    const hooked = s.rule.length > 0 || s.onFinish.length > 0, staged = Object.keys(s.stage).length > 0, sec = !!s.secondary;
    const category = hooked ? (staged ? "hooked+staged" : sec ? "hooked+secondary" : "hooked-only")
      : staged ? (sec ? "staged+secondary" : "staged-only") : sec ? "secondary-only" : "no-trigger";
    return { ...s, category };
  });
  return { systems: out, unresolved };
}
