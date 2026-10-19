// Optional integration tool. Install grow-items yourself; no dependency is bundled.
// Audited source snapshot: ca7b99ad3fa07f364fc76be88ee3d02b4df86908.
import fs from "node:fs/promises";
const path=process.argv[2];
if(!path) throw Error("Usage: node tools/inspect-native-items.mjs /path/to/native/items.dat");
const bytes=await fs.readFile(path);
if(bytes.length<6) throw Error("Truncated native header");
const version=bytes.readUInt16LE(0),count=bytes.readUInt32LE(2);
// Fail closed on versions outside the inspected parser's intended range.
if(version<11||version>27||count>100000) throw Error(`Unsupported native header ${version}/${count}`);
const {ItemsDat}=await import("grow-items");
const parser=new ItemsDat(Array.from(bytes));
await parser.decode();
const items=parser.meta.items instanceof Map?[...parser.meta.items.values()]:Object.values(parser.meta.items);
if(items.length!==count) throw Error("Parsed count mismatch");
console.log(JSON.stringify({format:"native-items-dat",version,count,
  note:"Metadata only; slot names, hidden indices, and renderer syntax need separate validation",
  items:items.map(i=>({id:i.id,name:i.name,texture:i.texture,textureX:i.textureX,
    textureY:i.textureY,rawBodyPartType:i.bodyPartType,materialType:i.materialType,
    rawBodyPart:i.bodyPart?Array.from(i.bodyPart):null,
    punchOptions:i.punchOptions,itemRenderer:i.itemRenderer,
    itemRendererHash:i.itemRendererHash,extraOptions:i.extraOptions,extraOptions2:i.extraOptions2}))},null,2));
