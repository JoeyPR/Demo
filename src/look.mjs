// Equipment owns abilities/effects; appearance owns sprite selection. A hidden
// or transmuted item remains equipped. Targets must be normalized catalog items.
export function resolveLook(items, { hiddenItemIds = [], transmutes = new Map() } = {}) {
  const hidden = new Set(hiddenItemIds);
  const slots = new Set();
  const displayed = [];
  const transmutedIds=[];
  for (const item of items) {
    if (slots.has(item.slot)) throw new Error(`Conflicting equipped slot ${item.slot}`);
    slots.add(item.slot);
    const target = transmutes instanceof Map ? transmutes.get(item.id) : transmutes?.[item.id];
    if (target && target.slot !== item.slot) throw new Error("Transmutes must use the same clothing slot");
    if(target&&target.id!==item.id)transmutedIds.push(item.id);
    if (!hidden.has(item.id)) displayed.push(target ?? item);
  }
  const hiddenSlots = new Set(displayed.flatMap(item =>
    (item.hideSlots ?? []).filter(slot => slot !== item.slot)));
  return {
    equipped: items,
    displayed: displayed.filter(item => !hiddenSlots.has(item.slot)),
    hiddenSlots,
    transmutedIds,
    // Include hidden equipment in the contribution pipeline, once per item.
    contributors: [...new Map(items.map(item => [item.id, item])).values()]
  };
}
