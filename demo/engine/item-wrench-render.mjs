const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function allControls(definition) {
  return [
    ...(definition?.sharedControls ?? []),
    ...(definition?.sections ?? []).flatMap(section => section.controls ?? [])
  ];
}

export function itemWrenchDefaults(definition) {
  return Object.fromEntries(allControls(definition)
    .filter(control => control.key && control.type !== "heading")
    .map(control => [control.key, clone(control.default)]));
}

export function normalizeItemWrenchValues(definition, candidate) {
  return { ...itemWrenchDefaults(definition), ...(candidate ?? {}) };
}

/*
 * Convert dialog values into the compact setting names used by the recovered
 * Set Planner item renderer: cN colours, fN flags, l_<key> layers, cyc and cycP.
 * This is an in-memory compatibility representation, not a native packet writer.
 */
export function buildNativeWrenchSettings(definition, values) {
  const settings = {};
  for (const control of allControls(definition)) {
    if (!control.key || control.type === "heading") continue;
    const binding = control.binding;
    if (!binding?.settingKey) continue;

    let value = values?.[control.key];
    if (binding.enabledKey && values?.[binding.enabledKey] === false) {
      value = binding.emptyValue ?? 0;
    } else if (value === "" && binding.emptyValue !== undefined) {
      value = binding.emptyValue;
    }
    if (binding.transform === "inverse") value = !value;
    if (value === undefined) continue;

    const keys = binding.settingKeys?.length ? binding.settingKeys : [binding.settingKey];
    for (const key of keys) settings[key] = clone(value);
  }
  return settings;
}

/*
 * Matches the recovered design/cycle selection policy:
 * a design remains in its current state through the short flip interval,
 * then the following cycle selects the alternate design.
 */
export function gameOptionDesign(gameOptions, values, timeMs = 0, itemCycle = null) {
  const cycle = gameOptions?.cycle;
  if (!cycle) return 0;
  const enabled = values?.timeDilationEnabled ?? cycle.default ?? false;
  if (!enabled) return 0;

  // Mirrors Set Planner's designOf(): cycle period is in seconds, flip is ms.
  const configuredPeriod = Number(values?.timeDilationCycleTime ?? cycle.period) ||
    Number(cycle.period) || 1;
  const periodMs = Math.max(1, configuredPeriod) * 1000;
  const flip = Math.max(0, Number(itemCycle?.flip ?? cycle.flip) || 0);
  const duration = periodMs + (cycle.restart === "swap" ? flip : 0);
  const elapsedTime = Math.max(0, Number(timeMs) || 0);
  const cycleNumber = Math.floor(elapsedTime / duration);
  const elapsedInCycle = elapsedTime - cycleNumber * duration;
  const designNumber = cycleNumber === 0 ? 0 :
    elapsedInCycle >= flip ? cycleNumber : cycleNumber - 1;
  return ((designNumber % 2) + 2) % 2;
}

export function pickedGameOptionColour(gameOptions, nativeSettings, colourIndex, design = 0) {
  const colour = gameOptions?.colours?.[colourIndex];
  if (!colour) return null;
  const slot = design && colour.slot2 !== undefined ? colour.slot2 : colour.slot;
  const settingKey = slot === undefined ? null : "c" + slot;
  const picked = settingKey ? nativeSettings?.[settingKey] : null;
  if (Array.isArray(picked) && picked.length === 3 &&
      picked.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255)) {
    return picked.slice();
  }
  const fallback = design && colour.default2 !== undefined ? colour.default2 : colour.default;
  return Array.isArray(fallback) && fallback.length === 3 ? fallback.slice() : null;
}

/*
 * Apply native gameIcon tc colour selectors to the current frame's piece copies.
 * The original referencePieces remain untouched; every frame rebuilds from them.
 */
export function applyItemWrenchAppearance(item, timeMs = 0) {
  const gameOptions = item?.wrenchGameOptions;
  const definition = item?.wrenchDefinition;
  if (!item || !gameOptions || !definition || !Array.isArray(item.pieces)) return item?.pieces ?? [];

  const values = normalizeItemWrenchValues(definition, item.wrenchSettings);
  const nativeSettings = buildNativeWrenchSettings(definition, values);
  const design = gameOptionDesign(gameOptions, values, timeMs);
  item.nativeWrenchSettings = nativeSettings;
  item.wrenchDesign = design;

  if (!Array.isArray(gameOptions.colours) || !item.pieces.some(piece => Number.isInteger(piece.tc))) {
    return item.pieces;
  }

  item.pieces = item.pieces.map(piece => {
    if (!Number.isInteger(piece.tc)) return piece;
    const tint = pickedGameOptionColour(gameOptions, nativeSettings, piece.tc, design);
    return tint ? { ...piece, t: tint } : piece;
  });
  return item.pieces;
}
