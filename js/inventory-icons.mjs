/* Adapter for Demo's inventory grid that reuses Planner's authoritative
   icon renderer and inventory-index metadata. Planner is a source repository,
   not a /Planner/ directory on the Demo site's Pages origin, so use jsDelivr
   to serve the real ES modules, catalog, and icon source assets with proper
   JavaScript MIME types and cross-origin access. */
const PLANNER_ROOT = new URL("https://cdn.jsdelivr.net/gh/JoeyPR/Planner@main/");
let runtimePromise = null;
let warningShown = false;

function paintFallback(canvas, glyph = "?") {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#d9edf5";
  context.font = "bold 18px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(glyph, 16, 16);
}

function loadIconRuntime() {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import(new URL("js/inventory/itemIcons.js", PLANNER_ROOT).href),
      fetch(new URL("data/inventory-index.json", PLANNER_ROOT), { cache: "force-cache" }),
    ]).then(async ([iconModule, response]) => {
      if (!response.ok) throw new Error("Planner inventory index returned HTTP " + response.status);
      const payload = await response.json();
      if (payload?.schemaVersion !== 3 || !Array.isArray(payload.items)) {
        throw new Error("Planner inventory icon index has an unexpected schema");
      }
      const itemsById = new Map();
      for (const item of payload.items) {
        if (item?.id != null) itemsById.set(String(item.id), item);
      }
      if (typeof iconModule.renderInventoryIcon !== "function") {
        throw new Error("Planner's inventory icon renderer was not exported");
      }
      return { renderInventoryIcon: iconModule.renderInventoryIcon, itemsById };
    }).catch(error => {
      if (!warningShown) {
        console.warn("Planner inventory icons could not be loaded.", error);
        warningShown = true;
      }
      throw error;
    });
  }
  return runtimePromise;
}

export async function renderPlannerInventoryIcon(canvas, demoItem) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const token = Symbol("planner-icon");
  canvas.__plannerIconToken = token;
  paintFallback(canvas, "…");
  try {
    const runtime = await loadIconRuntime();
    if (canvas.__plannerIconToken !== token) return;
    const item = runtime.itemsById.get(String(demoItem?.id ?? ""));
    if (!item) {
      paintFallback(canvas);
      return;
    }
    await runtime.renderInventoryIcon(canvas, item);
  } catch {
    if (canvas.__plannerIconToken === token) paintFallback(canvas);
  }
}
