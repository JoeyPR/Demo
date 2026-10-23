/**
 * Timeline helpers for the converted XML IR used in renderer-modules/*.mjs.
 * This handles basic sprite-frame tracks and piecewise-linear curves only.
 * It does not implement every native XML animation operation.
 */
const children = (node, tag) => (node?.c ?? []).filter(child => !tag || child.tag === tag);
const num = value => String(value ?? "").split(",").map(part => Number(part.trim()));
const bool = value => value === true || value === "true";

export function sampleSpriteTrack(renderer, spriteName, timeMs, stateSince = 0, stateName = null) {
  const tracks = (renderer.animations ?? []).filter(track => track.tag === "SpriteAnimation" && track.a?.sprite === spriteName);
  const active = tracks.filter(track => {
    if (!track.a?.playOnState) return true;
    return track.a.playOnState.split("|").some(spec => {
      const [machine, state] = spec.split(".");
      return stateName?.[machine] === state;
    });
  }).sort((a, b) => Number(!!b.a?.playOnState) - Number(!!a.a?.playOnState));
  const track = active[0];
  if (!track) return null;
  const frames = children(track, "Frame").map(frame => num(frame.v));
  if (!frames.length) return null;
  const duration = Math.max(1, Number(track.a.animTime) || frames.length * 175);
  const elapsed = Math.max(0, timeMs - stateSince);
  const loop = bool(track.a.isLoop);
  const progress = loop ? (elapsed % duration) / duration : Math.min(0.999999999, elapsed / duration);
  const frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  return { sprite: spriteName, track: track.a.name, frameIndex, cell: frames[frameIndex], elapsedMs: elapsed, durationMs: duration, frameDurationMs: duration / frames.length, loop };
}

export function sampleCurve(curve, normalizedTime) {
  const frames = children(curve, "KeyFrame").map(frame => num(frame.v)).filter(frame => frame.length >= 2).sort((a,b) => a[0]-b[0]);
  if (!frames.length) return null;
  const t = Math.max(frames[0][0], Math.min(frames.at(-1)[0], normalizedTime));
  if (t <= frames[0][0]) return frames[0].slice(1);
  if (t >= frames.at(-1)[0]) return frames.at(-1).slice(1);
  let right = frames.findIndex(frame => frame[0] > t);
  const left = frames[right-1], next = frames[right], span = next[0] - left[0];
  const f = span === 0 ? 0 : (t-left[0])/span;
  return left.slice(1).map((value,i) => value + ((next[i+1] ?? value)-value)*f);
}

export function inspectRenderer(renderer) {
  return {
    name: renderer._meta?.name,
    family: renderer._meta?.family,
    sprites: Object.keys(renderer.sprites ?? {}),
    tracks: (renderer.animations ?? []).filter(track => track.tag?.includes("Animation")).map(track => ({
      name: track.a?.name,
      type: track.tag,
      sprite: track.a?.sprite,
      playOnState: track.a?.playOnState,
      durationMs: Number(track.a?.animTime) || null,
      loop: track.a?.isLoop ?? null,
      frames: children(track, "Frame").map(frame => frame.v)
    })),
    machines: (renderer.machines ?? []).map(machine => ({
      name: machine.a?.name,
      states: children(children(machine, "States")[0], "State").map(state => state.a?.name),
      transitions: children(children(machine, "Transitions")[0], "Transition").map(transition => ({
        from: transition.a?.from,
        to: transition.a?.to,
        condition: children(transition, "Condition")[0] ?? null
      }))
    })),
    particleSystems: (renderer.particles ?? []).map(system => ({
      name: system.a?.name,
      updateStage: system.a?.updateStage,
      renderStage: system.a?.renderStage
    }))
  };
}
