// Recovered cue data is inert: no scripts or remote resources execute here.
const ORIGINS = new Set(["player", "item", "feet", "at", "offset", "default", "i"]);
export function normalizePunchCues(rows = []) {
  return rows.flatMap((row, index) => {
    if (!Array.isArray(row) || !Number.isFinite(row[0]) || row[0] < 0 || row[0] > 30000 ||
        typeof row[1] !== "string" || !ORIGINS.has(row[2])) return [];
    return [{ atMs: row[0], sound: row[1], origin: row[2]==="default"?"player":row[2]==="i"?"item":row[2],sourceOrigin:row[2],
      offset: [Number.isFinite(row[3]) ? row[3] : 0, Number.isFinite(row[4]) ? row[4] : 0], index }];
  }).sort((a, b) => a.atMs - b.atMs || a.index - b.index);
}

export function resolvePunchCues(items, data = {}) {
  // Hand overrides win; do not infer a style from reconstructed RP-### classes.
  const ordered = [...items].sort((a, b) => Number(b.slot === 5) - Number(a.slot === 5));
  for (const item of ordered) {
    const override = data.items?.[item.id];
    if (Array.isArray(override)) return { owner: item.id, style: override[0], cues: normalizePunchCues(override[1]) };
  }
  const item = ordered.find(i => Number.isInteger(i.punchStyleId));
  const style = item?.punchStyleId ?? 1;
  return { owner: item?.id ?? null, style, cues: normalizePunchCues(data.numbers?.[style]) };
}

export class PunchTimeline {
  constructor(data = {}) { this.data = data; this.reset(); }
  reset() { this.attacks = []; this.seen = new Set(); this.clock = -Infinity; }
  step(items, motion) {
    const now = motion.clockMs ?? 0;
    if (now < this.clock) this.reset();
    this.clock = now;
    for (const event of motion.events ?? []) {
      if (event.type !== "punch" || this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value);
      const resolved = resolvePunchCues(items, this.data);
      this.attacks.push({ ...resolved, id: event.id, at: Number.isFinite(event.at) ? event.at : now,
        facing: event.facing ?? motion.facing ?? 1, next: 0,
        x: motion.worldX ?? motion.x ?? 0, y: motion.worldY ?? motion.y ?? 0 });
    }
    const due = [];
    for (const attack of this.attacks) {
      while (attack.next < attack.cues.length && attack.cues[attack.next].atMs <= now - attack.at) {
        const cue = attack.cues[attack.next++];
        due.push({ ...cue, attackId: attack.id, owner: attack.owner, style: attack.style,
          at: attack.at + cue.atMs, facing: attack.facing, x: attack.x, y: attack.y });
      }
    }
    this.attacks = this.attacks.filter(attack => attack.next < attack.cues.length).slice(-64);
    return due.sort((a,b)=>a.at-b.at);
  }
}
