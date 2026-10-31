// Archive adapters accept the two actual bundle shapes. Loading a direct map
// as `.scripts` silently disabled the main preview's dedicated FX library.
export function rendererScripts(data) {
  const scripts = data?.scripts ?? data;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return {};
  return Object.fromEntries(Object.entries(scripts).filter(([, value]) =>
    value && typeof value === "object" && !Array.isArray(value) && value.sprites));
}
