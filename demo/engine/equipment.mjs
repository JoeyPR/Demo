// Equipment controls abilities and effects; appearance controls sprite ownership.
// A visual replacement must occupy the same planner slot. No fake item records.
export function resolveAppearance(equipped, settings = {}, lookup = () => null) {
  const hidden = new Set((settings.hiddenIds ?? []).filter(Number.isInteger));
  const visualItems = [], warnings = [];
  for (const item of equipped) {
    if (hidden.has(item.id)) continue;
    const id = settings.transmutes?.[item.id];
    if (!id || id === item.id) { visualItems.push(item); continue; }
    const target = lookup(Number(id));
    if (!target || target.slot !== item.slot) {
      visualItems.push(item); warnings.push(`Invalid appearance ${id} for equipped item ${item.id}`); continue;
    }
    visualItems.push({ ...target, equippedOwner: item.id, skipLegacyParticles: true });
  }
  return { equippedItems: equipped, visualItems, warnings };
}
