import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildTriggerTable} from "../src/xml-triggers.mjs";
const scripts = JSON.parse(fs.readFileSync(new URL("../evidence/renderer-data.json", import.meta.url), "utf8")).scripts;

test("DirtAura: three orbit systems, all started by AddClothingParticles rules", () => {
  const t = buildTriggerTable(scripts.DirtAura);
  assert.deepEqual(t.systems.map(s => s.name).sort(), ["dirtOrbit1", "dirtOrbit2", "dirtOrbit3"]);
  for (const s of t.systems) assert.ok(s.rule.some(r => r.hook === "AddClothingParticles" && r.kind === "Update"), s.name);
  assert.equal(t.unresolved.length, 0);
});

test("whole data set: 924 systems split into the documented trigger categories", () => {
  const counts = {}; const unresolved = [];
  for (const r of Object.values(scripts)) {
    if (!r.particles?.length) continue;
    const t = buildTriggerTable(r); unresolved.push(...t.unresolved);
    for (const s of t.systems) counts[s.category] = (counts[s.category] ?? 0) + 1;
  }
  assert.deepEqual(counts, {"hooked-only": 500, "hooked+staged": 81, "hooked+secondary": 16, "staged-only": 288, "staged+secondary": 10, "secondary-only": 2, "no-trigger": 27});
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 924);
  assert.deepEqual(unresolved.map(u => u.name).sort(), ["p_mist", "punch_particleTrail", "punch_particleTrail", "s_shirt"]);
});
