// Decode a PUBLIC planner catalog supplied locally by the user.
// Does not request a session, keys, private/sealed payloads, or any network URL.
import fs from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { requirePlannerCatalog } from "../src/items.mjs";
const [input,output]=process.argv.slice(2);
if(!input||!output) throw Error("Usage: node tools/unpack-planner.mjs public-items.<hash>.dat catalog.json");
let buffer=await fs.readFile(input),data;
if(buffer[0]===123) data=JSON.parse(buffer.toString("utf8"));
else {
  buffer=Buffer.from(buffer);
  let key=0x5a;
  for(let i=0;i<buffer.length;i++) {buffer[i]^=key;key=(key*31+i+7)&255;}
  const decoded=gunzipSync(buffer,{maxOutputLength:64*1024*1024});
  data=JSON.parse(decoded.toString("utf8"));
}
requirePlannerCatalog(data);
await fs.writeFile(output,JSON.stringify(data,null,2));
console.log(`Decoded ${data.items.length} public wearable references. Scripts/FX are not included.`);
