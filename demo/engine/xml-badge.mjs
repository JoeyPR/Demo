// Honest per-item fidelity badge (work order step 4).
//   NATIVE      the item has XML particle systems, every field of every system is "full" in xml-support.mjs, and nothing is
//               skipped or unresolved. Expect ~0 for a long time; that is the honest answer. An item with no particle systems is
//               never NATIVE: its sprite/animation rules are still an approximate interpreter.
//   PARTIAL     it runs, but a used field is partial/evaluator, or an unimplemented field is ignored.
//   UNRESOLVED  any skipped system, unresolved event, hook with no planner event source, unnamed trigger, missing script, or
//               fx flag with no XML. The reasons are returned as text.
import {SUPPORT} from "./xml-support.mjs";
import {buildTriggerTable} from "./xml-triggers.mjs";
import {EVENT_HOOKS} from "./xml-renderer.mjs";

const kids=(n,t)=>(n?.c??[]).filter(c=>!t||c.tag===t);
const rank=s=>({none:0,evaluator:1,partial:2,full:3})[s??"none"];
export function fieldsUsed(ps) {
  const f=new Set();
  for(const side of ["Emitter","Particle"]) {
    const node=kids(ps,side)[0];if(!node)continue;
    for(const k of Object.keys(node.a??{}))f.add(`${side}@${k}`);
    for(const c of kids(node)) {
      if(c.tag==="OrbitOffset"){f.add(`${side}.OrbitOffset`);continue;}
      if(c.tag==="OnFinish"){f.add(`${side}.OnFinish`);continue;}
      if(c.a?.name){f.add(`${side}.${c.a.name}`);if(c.tag!=="Set")f.add(`op:${c.tag}`);}
    }
  }
  return f;
}
// Hooks whose event the planner can never raise (constant false predicate).
const deadHooks=()=>Object.keys(EVENT_HOOKS).filter(h=>!EVENT_HOOKS[h]({},{}) && !EVENT_HOOKS[h]({events:[{type:"punch",id:"x"}],punch:{}},{punchEnd:"x"}));

export function fidelityOf(item) {
  const raw=item.raw??{},reasons=[],notes=[];
  const renderer=item.renderer;
  if(!renderer) {
    if(raw.script)return {level:"UNRESOLVED",reasons:[`Renderer script "${raw.script}" is not in the data`]};
    if(raw.fx||raw.punchFx||raw.airJumpFx)return {level:"UNRESOLVED",reasons:["Item has an effect flag but no XML describes it"]};
    return {level:"REFERENCE",reasons:["Public sprite reference only; no native script involved"]};
  }
  const table=buildTriggerTable(renderer);
  let systems=0,notFull=0;const ignored=new Set(),partial=new Set();
  for(const s of table.systems) {
    systems++;
    if(s.category==="no-trigger")reasons.push(`${s.name}: nothing in the XML starts this system`);
    const used=fieldsUsed(renderer.particles.find(p=>p.a.name===s.name));
    for(const k of used){const r=rank(SUPPORT[k]);if(r===0)ignored.add(k);else if(r<3)partial.add(k);}
    if([...used].some(k=>rank(SUPPORT[k])<3))notFull++;
  }
  for(const u of table.unresolved)reasons.push(`${u.name}: hook/name reference does not resolve`);
  const dead=deadHooks(),present=kids(renderer.rules).map(h=>h.tag).filter(t=>dead.includes(t));
  for(const h of new Set(present))reasons.push(`Hook ${h} has no source in the planner, so its content never runs`);
  for(const [name,why] of Object.entries(item.xmlUnsupportedReasons??{}))reasons.push(`${name} skipped: ${why.join("; ")}`);
  for(const [name,why] of Object.entries(item.xmlUnresolvedEvents??{}))reasons.push(`${name}: ${why}`);
  if(ignored.size)notes.push(`Ignored fields: ${[...ignored].join(", ")}`);
  if(partial.size)notes.push(`Approximate fields: ${[...partial].join(", ")}`);
  let level;
  if(reasons.length)level="UNRESOLVED";
  else if(!systems||notFull||ignored.size||partial.size)level="PARTIAL";
  else level="NATIVE";
  if(!systems)notes.push("No particle systems; sprite/animation rules use the partial interpreter");
  return {level,reasons:[...reasons,...notes],systems};
}
