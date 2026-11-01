// Particle integration is independent of emission and drawing. Units: seconds,
// logical pixels, degrees. Analytical acceleration avoids refresh-rate drift.
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const mix = (a, b, t) => a + (b - a) * t;
export function integrateParticle(p, elapsed) {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return;
  const dt = p.inf ? elapsed : Math.min(elapsed, Math.max(0, p.life - p.age));
  const before = p.age;
  p.age += dt;
  for (let axis = 0; axis < 2; axis++) {
    const gravity = finite(p.grav?.[axis]);
    if (p.vel1) {
      const a = Math.min(1, before / p.life), b = Math.min(1, p.age / p.life);
      const start = mix(finite(p.vel0?.[axis]), finite(p.vel1[axis]), a);
      const end = mix(finite(p.vel0?.[axis]), finite(p.vel1[axis]), b);
      p.pos[axis] += (start + end) * 0.5 * dt + gravity * (before * dt + 0.5 * dt * dt);
      p.vel[axis] = end + gravity * p.age;
    } else {
      p.pos[axis] += finite(p.vel[axis]) * dt + 0.5 * gravity * dt * dt;
      p.vel[axis] = finite(p.vel[axis]) + gravity * dt;
    }
  }
  if(p.spin1!==undefined) {
    const start=mix(p.spin0,p.spin1,Math.min(1,before/p.life));
    const end=mix(p.spin0,p.spin1,Math.min(1,p.age/p.life));
    p.angle=finite(p.angle)+(start+end)*0.5*dt;p.spin=end;
  } else p.angle = finite(p.angle) + finite(p.spin) * dt;
}
