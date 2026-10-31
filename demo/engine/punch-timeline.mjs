// Exact captured item cue sequences only. punchFx=true/1 is a dependency flag,
// not a verified sound-style selector; never index the numbers table with it.
export class PunchTimeline {
  constructor(data = {}) { this.data = data; this.pending = []; this.lastEvent = null; }
  reset() { this.pending.length = 0; this.lastEvent = null; }
  step(items, motion) {
    const now = motion.clockMs;
    if (!Number.isFinite(now)) return [];
    for (const event of motion.events ?? []) {
      if (event.type !== 'punch' || event.id === this.lastEvent) continue;
      this.lastEvent = event.id;
      const ordered = [...items].sort((a, b) => (a.slot === 5 ? -1 : b.slot === 5 ? 1 : a.slot - b.slot));
      const owner = ordered.find(i => this.data.items?.[i.id] || this.data.scripts?.[i.id]);
      const rows = owner && this.data.items?.[owner.id]?.[1];
      const cues = rows ?? (owner ? [[0, this.data.scripts[owner.id], 'player']] : []);
      cues.forEach(([atMs, sound, origin, x = 0, y = 0], index) => {
        if (!Number.isFinite(atMs) || atMs < 0 || typeof sound !== 'string') return;
        if (sound.startsWith('slot:')) {
          const slotItem = items.find(i => i.slot === Number(sound.slice(5)));
          sound = this.data.itemSounds?.[slotItem?.id];
          if (!sound) return;
        }
        this.pending.push({ dueAt: now + atMs, atMs, sound, origin, offset: [x, y],
          owner: owner.id, eventId: event.id, index, facing: motion.facing,
          birth: [motion.worldX ?? motion.x ?? 0, motion.worldY ?? motion.y ?? 0] });
      });
    }
    const due = this.pending.filter(c => c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt || a.index - b.index);
    this.pending = this.pending.filter(c => c.dueAt > now).slice(-1024);
    return due;
  }
}
