// ONE player-level punch counter. It is the single source for both consumers in the XML renderer:
//   - Select input="punchCount" (index = count modulo item count)
//   - <Emitter onPunchCount="odd|even"> (parity of the same count)
// The planner's MotionFrame has no counter of its own, so PlannerPlayer owns one instance and injects motion.punchCount.
// The first punch makes the count 1 (odd). Each distinct punch event id is counted once. Scrubbing back in time resets it.
export const PUNCH_COUNTER={firstPunchCount:1,countsDistinctEventIds:true,resetsOnRewind:true};
export class PunchCounter {
  constructor() {this.reset();}
  reset() {this.count=0;this.seen=new Set();this.lastMs=-Infinity;}
  observe(motion) {
    const t=motion.clockMs??0;
    if(t<this.lastMs)this.reset();
    this.lastMs=t;
    for(const e of motion.events??[])
      if(e.type==="punch"&&!this.seen.has(e.id)){this.seen.add(e.id);this.count++;}
    return this.count;
  }
}
