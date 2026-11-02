const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function itemWrenchControls(definition) {
  if (!definition || typeof definition !== "object") return [];
  return [
    ...(definition.sharedControls ?? []),
    ...(definition.sections ?? []).flatMap(section => section.controls ?? [])
  ];
}

export function createItemWrenchDefaults(definition) {
  return Object.fromEntries(
    itemWrenchControls(definition)
      .filter(control => control.key && control.type !== "heading")
      .map(control => [control.key, clone(control.default)])
  );
}

export function validateItemWrenchValue(control, value) {
  switch (control.type) {
    case "checkbox":
      return typeof value === "boolean";
    case "rgb":
      return Array.isArray(value) && value.length === 3 &&
        value.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255);
    case "number":
      return Number.isFinite(value) &&
        (control.min == null || value >= control.min) &&
        (control.max == null || value <= control.max);
    case "choice-checkboxes":
      return (control.allowNone && value === "") ||
        (control.options ?? []).some(option => option.value === value);
    case "select":
      return (control.options ?? []).some(option => option.value === value);
    case "text":
      return typeof value === "string" &&
        (control.maxLength == null || value.length <= control.maxLength);
    default:
      return false;
  }
}

export function normalizeItemWrenchState(definition, candidate) {
  const defaults = createItemWrenchDefaults(definition);
  const normalized = { ...defaults };
  const errors = [];
  for (const control of itemWrenchControls(definition)) {
    if (!control.key || control.type === "heading" || !Object.hasOwn(defaults, control.key)) continue;
    if (candidate && Object.hasOwn(candidate, control.key)) {
      const value = candidate[control.key];
      if (validateItemWrenchValue(control, value)) normalized[control.key] = clone(value);
      else errors.push(control.key);
    }
  }
  return { values: normalized, errors };
}

export function validateItemWrenchState(definition, candidate) {
  const errors = [];
  for (const control of itemWrenchControls(definition)) {
    if (!control.key || control.type === "heading") continue;
    if (!validateItemWrenchValue(control, candidate?.[control.key])) errors.push(control.key);
  }
  return { valid: errors.length === 0, errors };
}

export function cloneItemWrenchState(state) {
  return clone(state ?? {});
}
