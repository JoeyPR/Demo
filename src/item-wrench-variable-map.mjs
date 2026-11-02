const bool = value => String(value ?? "").trim().toLowerCase() === "true";
const isBool = value => ["true", "false"].includes(String(value ?? "").trim().toLowerCase());
const parseRgb = value => {
  const parts = String(value ?? "").trim().split(/\s*,\s*/).map(Number);
  return parts.length === 3 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
};
const sectionDescription = value => {
  const text = String(value ?? "").trim();
  return !!text && !text.endsWith(":");
};

function fieldControl(entry) {
  const value = String(entry.default ?? "");
  const rgb = parseRgb(value);
  if (rgb) return {
    type: "rgb", key: entry.name, label: "`o" + entry.uiName, default: rgb,
    maxLength: entry.maxLength, help: entry.uiDescription ? "`1" + entry.uiDescription : undefined,
    binding: entry.name, bindingStatus: "source-variable-map"
  };
  if (isBool(value)) return {
    type: "checkbox", key: entry.name, label: "`o" + entry.uiName, default: bool(value),
    help: entry.uiDescription ? "`1" + entry.uiDescription : undefined, binding: entry.name, bindingStatus: "source-variable-map"
  };
  if (value !== "" && Number.isFinite(Number(value))) return {
    type: "number", key: entry.name, label: "`o" + entry.uiName, default: Number(value),
    min: entry.minValue == null ? undefined : Number(entry.minValue),
    max: entry.maxValue == null ? undefined : Number(entry.maxValue),
    step: entry.forceFloats ? "any" : 1,
    maxLength: entry.maxLength, help: entry.uiDescription ? "`1" + entry.uiDescription : undefined,
    binding: entry.name, bindingStatus: "source-variable-map"
  };
  return {
    type: "text", key: entry.name, label: "`o" + entry.uiName, default: value,
    maxLength: entry.maxLength, help: entry.uiDescription,
    binding: entry.name, bindingStatus: "source-variable-map"
  };
}

export function buildItemWrenchDefinitionFromVariableMap(record, itemId) {
  if (!record || !Array.isArray(record.entries)) return null;
  const entries = [...record.entries]
    .filter(entry => entry && entry.name && entry.uiName)
    .sort((a, b) => (a.uiOrder ?? 0) - (b.uiOrder ?? 0));

  const sections = [];
  const sharedControls = [];
  let currentSection = null;
  const consumedRadioGroups = new Set();

  const pushControl = control => {
    if (currentSection) currentSection.controls.push(control);
    else sharedControls.push(control);
  };

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const description = String(entry.uiDescription ?? "").trim();

    if (description && sectionDescription(description)) {
      currentSection = { key: "section-" + (sections.length + 1), title: "`o" + description, controls: [] };
      sections.push(currentSection);
    }

    const radioGroup = Number(entry.radioGroup ?? -1);
    if (radioGroup > 0) {
      if (consumedRadioGroups.has(radioGroup)) continue;
      consumedRadioGroups.add(radioGroup);
      const members = entries.filter(candidate => Number(candidate.radioGroup ?? -1) === radioGroup);
      const selected = members.find(candidate => bool(candidate.default));
      pushControl({
        type: "choice-checkboxes",
        key: "radioGroup-" + radioGroup,
        label: "`o" + (description.endsWith(":") ? description : (entry.uiName ?? "")),
        allowNone: true,
        default: selected?.name ?? "",
        options: members.map(member => ({ value: member.name, label: "`o" + member.uiName })),
        binding: members.map(member => member.name),
        bindingStatus: "source-variable-map-radio-group"
      });
      continue;
    }

    const controlEntry = description && sectionDescription(description)
      ? { ...entry, uiDescription: undefined }
      : entry;
    pushControl(fieldControl(controlEntry));
  }

  return {
    itemId: Number(itemId),
    name: record.name ?? "Item",
    kind: "customization",
    source: {
      renderer: record.renderer ?? null,
      source: "renderer-xml-VariableMap",
      itemId: Number(itemId)
    },
    notes: record.itemUiDescription ? ["`1" + record.itemUiDescription] : [],
    sharedControls,
    sections: sections.filter(section => section.controls.length > 0)
  };
}
