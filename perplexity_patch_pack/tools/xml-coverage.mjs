#!/usr/bin/env node
// Usage: node tools/xml-coverage.mjs [evidence/renderer-data.json] [--json evidence/xml-coverage.json]
// Reports, per script and overall: trigger categories, unresolved hooks, and which XML fields each system needs vs what src/xml-support.mjs says is implemented.
// A system is "native-ready" ONLY if every field it uses is 'full' AND it has a trigger. Unknown fields count as 'none'.
import fs from "node:fs";
import {buildTriggerTable, CATEGORIES} from "../src/xml-triggers.mjs";
import {SUPPORT} from "../src/xml-support.mjs";
const args = process.argv.slice(2);
const file = args.find(a => a.endsWith(".json") && args[args.indexOf(a) - 1] !== "--json") ?? "evidence/renderer-data.json";
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const data = JSON.parse(fs.readFileSync(file, "utf8")).scripts;
const kids = (n, t) => (n?.c ?? []).filter(c => !t || c.tag === t);
const walk = n => n ? [n, ...kids(n).flatMap(walk)] : [];
export function fieldsUsed(ps) {
  const f = new Set();
  for (const side of ["Emitter", "Particle"]) {
    const node = kids(ps, side)[0]; if (!node) continue;
    for (const k of Object.keys(node.a)) f.add(`${side}@${k}`);
    for (const c of kids(node)) {
      if (c.tag === "OrbitOffset") { f.add(`${side}.OrbitOffset`); continue; }
      if (c.tag === "OnFinish") { f.add(`${side}.OnFinish`); continue; }
      if (c.a?.name) { f.add(`${side}.${c.a.name}`); if (c.tag !== "Set") f.add(`op:${c.tag}`); }
    }
  }
  return f;
}
const rank = s => ({ none: 0, evaluator: 1, partial: 2, full: 3 })[s ?? "none"];
const total = { scripts: 0, systems: 0, categories: Object.fromEntries(CATEGORIES.map(c => [c, 0])), unresolvedHooks: [], status: { "native-ready": 0, "partial-only": 0, blocked: 0 } };
const blockedBy = new Map(), perScript = {};
for (const [name, r] of Object.entries(data)) {
  if (!r.particles?.length) continue;
  total.scripts++;
  const t = buildTriggerTable(r);
  total.unresolvedHooks.push(...t.unresolved.map(u => ({ script: name, ...u })));
  perScript[name] = [];
  for (const s of t.systems) {
    total.systems++; total.categories[s.category]++;
    const ps = r.particles.find(p => p.a.name === s.name), used = fieldsUsed(ps);
    const missing = [...used].filter(k => rank(SUPPORT[k]) === 0), lacking = [...used].filter(k => rank(SUPPORT[k]) < 3);
    const status = s.category === "no-trigger" || missing.length ? "blocked" : lacking.length ? "partial-only" : "native-ready";
    const key = status === "native-ready" ? "native-ready" : status;
    total.status[key]++;
    for (const k of missing) blockedBy.set(k, (blockedBy.get(k) ?? 0) + 1);
    perScript[name].push({ system: s.name, category: s.category, status, missing, notFull: lacking.filter(k => !missing.includes(k)) });
  }
}
const top = [...blockedBy].sort((a, b) => b[1] - a[1]);
console.log(`scripts with particles: ${total.scripts}   systems: ${total.systems}`);
console.log("trigger categories:", total.categories);
console.log("systems:", total.status);
console.log(`unresolved hook/name references (${total.unresolvedHooks.length}):`, total.unresolvedHooks.map(u => `${u.script}:${u.name}`).join(", "));
console.log("\nTop UNSUPPORTED fields by number of systems blocked (implement in this order):");
for (const [k, n] of top.slice(0, 25)) console.log(String(n).padStart(5), k);
if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify({ total, blockedBy: top, perScript }, null, 1)); console.log("\nwrote", jsonOut); }
