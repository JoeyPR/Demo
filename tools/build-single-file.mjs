// Mechanical packaging: documentation + editable source in one Claude-friendly Markdown.
import fs from "node:fs/promises";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname);
const output=process.argv[2]??path.resolve(root,"../Growtopia_Player_Rendering_Claude_Handoff.md");
const docs=["CLAUDE.md","PUNCH_RESTORATION.md","INPUT_ABILITIES_FX_REVISION.md","ARCHIVE_MOUNT_PET_REVISION.md","STATE_ROUTING_REVISION.md","ANIMATION_FX_FLOAT_REVISION.md","RIDING_AND_CATALOG_REVISION.md","RESEARCH.md","API.md","GAPS.md","VALIDATION.md"];
const code=["package.json","src/math.mjs","src/planner-profile.mjs","src/animation.mjs",
  "src/rig.mjs","src/motion.mjs","src/items.mjs","src/script-vm.mjs","src/effects.mjs",
  "src/render.mjs","src/canvas-assets.mjs","src/player.mjs","src/catalog-adapter.mjs","src/pose-resolver.mjs","src/lift.mjs","src/motion-policy.mjs",
  "src/mounted-gait.mjs","src/pet-motion.mjs","src/xml-renderer.mjs",
  "src/abilities.mjs","src/draw-bounds.mjs","src/item-fx.mjs",
  "demo/app.js","demo/index.html","demo/style.css",
  "demo/tools/compile-abilities.mjs","demo/tools/compile-native-properties.mjs",
  "tools/unpack-planner.mjs","tools/inspect-native-items.mjs","tools/audit-catalog.mjs",
  "examples/headless.mjs","test/core.test.mjs","test/motion-policy.test.mjs","test/archive-runtime.test.mjs"];
let text="# Growtopia Player Rendering: Claude Handoff\n\n"+
  "Research, implementation instructions, API contracts, fidelity gaps, validation, and editable reference code. "+
  "This is a source-assisted planner foundation, not a verified official Growtopia engine reconstruction.\n\n"+
  "The accompanying code package includes runnable tests, differential fixtures, provenance, and the 4,081-item dependency inventory. "+
  "No third-party game textures, full application source bundle, catalog, or sealed data are included.\n\n";
for(const file of docs) {
  const original=await fs.readFile(path.join(root,file),"utf8");
  const content=original.replace(/^(#{1,5}) /gm,"$1# ");
  text+="\n---\n\n"+content+"\n";
}
text+="\n---\n\n## Editable source code\n\n"+
  "Each subsection gives its intended file path. Preserve the files and imports rather than pasting all modules into one application scope.\n\n";
for(const file of code) {
  const content=await fs.readFile(path.join(root,file),"utf8");
  text+="### "+file+"\n\n```"+(file.endsWith(".json")?"json":"js")+"\n"+content+"\n```\n\n";
}
await fs.writeFile(output,text);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(text),documents:docs.length,codeFiles:code.length}));
