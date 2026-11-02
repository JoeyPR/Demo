const safeKey = value => String(value ?? "option").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "option";
const optionList = field => (field.labels ?? field.values ?? []).map((label, index) => ({
  value: field.values?.[index] ?? index,
  label: String(label)
}));
const rgbDefault = value => Array.isArray(value) && value.length === 3
  ? value.map(Number) : [255, 255, 255];

export function buildItemWrenchDefinitionFromGameOptions(record, itemId) {
  const gameOptions = record?.gameOptions;
  if (!gameOptions || typeof gameOptions !== "object") return null;

  const definition = {
    itemId: Number(itemId),
    name: record.name ?? "Item",
    kind: "customization",
    source: { source: "native-gameOptions", itemId: Number(itemId) },
    sharedControls: [],
    sections: []
  };

  if (gameOptions.cycle) {
    const cycle = gameOptions.cycle;
    definition.sharedControls.push(
      {
        type: "number",
        key: "cyclePeriod",
        label: "`o" + String(cycle.name ?? "Cycle") + " Cycle Time:",
        default: Number(cycle.period ?? 0),
        min: 1,
        step: cycle.periodInt ? 1 : "any",
        binding: { settingKey: "cycP", settingKeys: ["cycP"], off: cycle.periodOff, type: cycle.periodInt ? "int" : "float" },
        bindingStatus: "source-backed"
      },
      {
        type: "checkbox",
        key: "cycleEnabled",
        label: "`o" + String(cycle.name ?? "Cycle") + " On / Off",
        default: Number(cycle.default ?? 0) !== 0,
        binding: { settingKey: "cyc", settingKeys: ["cyc"], off: cycle.off },
        bindingStatus: cycle.default == null ? "default-inferred" : "source-backed"
      }
    );
  }

  const baseControls = [];
  for (const [index, field] of (gameOptions.flags ?? []).entries()) {
    baseControls.push({
      type: "checkbox",
      key: "flag-" + safeKey(field.name) + "-" + index,
      label: "`o" + String(field.name ?? "Option"),
      default: Number(field.default ?? 1) !== 0,
      binding: {
        settingKey: field.off != null ? "f" + field.off : "f" + index + "x",
        settingKeys: [
          field.off != null ? "f" + field.off : "f" + index + "x",
          field.off2 != null ? "f" + field.off2 : field.off != null ? "f" + field.off : "f" + index + "x"
        ],
        off: field.off, off2: field.off2, bit: field.bit, bit2: field.bit2
      },
      bindingStatus: "source-backed"
    });
  }

  for (const [index, field] of (gameOptions.choices ?? []).entries()) {
    const options = optionList(field);
    const defaultValue = field.default ?? field.default2 ?? options[0]?.value ?? "";
    baseControls.push({
      type: "select",
      key: "choice-" + safeKey(field.name) + "-" + index,
      label: "`o" + String(field.name ?? "Choice"),
      options,
      default: defaultValue,
      binding: {
        settingKey: "s" + index,
        settingKeys: ["s" + index, "s" + index + "b"],
        off: field.off, off2: field.off2, size: field.size, obj: field.obj
      },
      bindingStatus: "source-backed"
    });
  }

  for (const [index, field] of (gameOptions.layers ?? []).entries()) {
    baseControls.push({
      type: "select",
      key: "layer-" + safeKey(field.key ?? field.name) + "-" + index,
      label: "`o" + String(field.name ?? field.key ?? "Layer"),
      options: optionList(field).length ? optionList(field) :
        (field.labels ?? []).map((label, value) => ({ value, label })),
      default: field.default ?? 0,
      binding: {
        settingKey: "l_" + (field.key ?? index),
        settingKeys: ["l_" + (field.key ?? index), "l2_" + (field.key ?? index)],
        bit: field.bit, bit2: field.bit2, key: field.key, pokes: field.pokes
      },
      bindingStatus: "source-backed"
    });
  }

  for (const [index, field] of (gameOptions.movingLayers ?? []).entries()) {
    const options = (field.labels ?? []).map((label, value) => ({ value, label }));
    baseControls.push({
      type: "select",
      key: "moving-layer-" + safeKey(field.key ?? field.name) + "-" + index,
      label: "`o" + String(field.name ?? field.key ?? "Moving Layer"),
      options,
      default: field.default ?? 0,
      binding: {
        settingKey: "l_" + (field.key ?? index),
        settingKeys: ["l_" + (field.key ?? index), "l2_" + (field.key ?? index)],
        key: field.key, pokes: field.pokes
      },
      bindingStatus: "source-backed"
    });
  }

  if (gameOptions.airJump) {
    const field = gameOptions.airJump;
    baseControls.push({
      type: "checkbox",
      key: "air-jump",
      label: "`o" + String(field.name ?? "Air jump effect"),
      default: Number(field.default ?? 0) !== 0,
      binding: { off: field.off, off2: field.off2 },
      bindingStatus: "source-backed"
    });
  }

  if (gameOptions.punch) {
    const field = gameOptions.punch;
    baseControls.push({
      type: "select",
      key: "punch-style",
      label: "`o" + String(field.name ?? "Punch"),
      options: optionList(field),
      default: field.default ?? field.values?.[0] ?? 0,
      binding: { off: field.off, size: field.size },
      bindingStatus: "source-backed"
    });
  }

  const colours = gameOptions.colours ?? [];
  const hasSecondStyle = colours.some(field => Array.isArray(field.default2));
  if (hasSecondStyle) {
    for (const [styleIndex, property] of ["default", "default2"].entries()) {
      const section = {
        key: "style-" + (styleIndex + 1),
        title: "`oStyle " + (styleIndex + 1),
        controls: colours.map((field, index) => ({
          type: "rgb",
          key: safeKey(field.name) + "-" + property,
          label: "`o" + String(field.name ?? "Color") + " - R,G,B:",
          default: rgbDefault(field[property]),
          binding: {
            settingKey: (field.slot ?? field.off) != null ? "c" + (field.slot ?? field.off) : "c" + index + "x",
            settingKeys: [
              (styleIndex === 1 ? field.slot2 ?? field.off2 ?? field.slot ?? field.off
                : field.slot ?? field.off) != null
                ? "c" + (styleIndex === 1 ? field.slot2 ?? field.off2 ?? field.slot ?? field.off
                  : field.slot ?? field.off)
                : "c" + index + "x"
            ],
            off: field.off, off2: field.off2, slot: field.slot, slot2: field.slot2, variant: property
          },
          bindingStatus: "source-backed"
        }))
      };
      definition.sections.push(section);
    }
  } else {
    for (const [index, field] of colours.entries()) {
      baseControls.push({
        type: "rgb",
        key: "colour-" + safeKey(field.name) + "-" + index,
        label: "`o" + String(field.name ?? "Color") + " - R,G,B:",
        default: rgbDefault(field.default),
        binding: {
          settingKey: (field.slot ?? field.off) != null ? "c" + (field.slot ?? field.off) : "c" + index + "x",
          settingKeys: [
            (field.slot ?? field.off) != null ? "c" + (field.slot ?? field.off) : "c" + index + "x"
          ],
          off: field.off, off2: field.off2, slot: field.slot, slot2: field.slot2
        },
        bindingStatus: "source-backed"
      });
    }
  }

  if (baseControls.length) {
    definition.sections.unshift({
      key: "options",
      title: "`o" + (gameOptions.choices?.length ? "Options" : "Customization"),
      controls: baseControls
    });
  }
  if (!definition.sharedControls.length && !definition.sections.length) return null;
  return definition;
}
