import fs from "node:fs";
import crypto from "node:crypto";
const path=process.argv[2];
if(!path)throw Error("Usage: node tools/compile-native-properties.mjs /absolute/path/items.txt");
const bytes=fs.readFileSync(path),lines=bytes.toString("utf8").split(/\r?\n/);
const header=lines.find(l=>l.startsWith("//Format: add_item\\"));
if(!header)throw Error("Missing declared items.txt schema");
const fields=header.slice("//Format: ".length).split("\\");
const outputPath=new URL("../native-metadata.json",import.meta.url);
const output=JSON.parse(fs.readFileSync(outputPath));
const invalid=[],matched=new Set();
for(const line of lines) {
  if(!line.startsWith("add_item\\"))continue;
  const values=line.split("\\"),id=Number(values[1]);
  if(!output.items[id])continue;
  if(values.length!==fields.length){invalid.push({id,columns:values.length,expected:fields.length});continue;}
  output.items[id].sourceFields=Object.fromEntries(fields.slice(1).map((key,i)=>[key,values[i+1]]));
  matched.add(id);
}
output.nativeFieldPreservation={
  sha256:crypto.createHash("sha256").update(bytes).digest("hex"),
  fields:fields.slice(1),matched:matched.size,invalid,
  interpretation:"Original strings retained. Opaque version/position arrays are NOT decoded flags, emitters, or ability recipes.",
  semanticAbilityData:"ability-registry.json is sourced separately from wiki mod tables."
};
fs.writeFileSync(outputPath,JSON.stringify(output)+"\n");
console.log({matched:matched.size,invalid});
