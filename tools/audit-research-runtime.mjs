// Exercise the active demo/engine imports, including nonzero world origins.
import fs from 'node:fs/promises';
import { PlannerPlayer } from '../demo/engine/player.mjs';
import { normalizeCatalogItem } from '../demo/engine/catalog-adapter.mjs';
const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));
const catalog = await read('demo/catalog.json');
catalog.renderers = (await read('demo/renderer-data.json')).scripts;
catalog.fxRenderers = (await read('demo/fx-data.json')).scripts;
catalog.punchData = await read('demo/punch-data.json');
catalog.punchSounds = await read('data/research/sfx-punch.json');
catalog.liftProfiles = Object.fromEntries((await read('demo/lift-profiles.json')).profiles.map(p => [p.id, p]));
const report = {items:catalog.items.length,cases:0,calls:0,xmlParticleCalls:0,cues:0,invalid:[],missingAtlases:[],limitations:'Structural and numeric verification; no official-client or browser pixel parity.'};
const missing = new Set();
const files = new Set(await fs.readdir(new URL('demo/assets/', root)));
files.add('reference-fx.png');
const states = [
  {locomotion:'idle',ground:true,vx:0,vy:0},
  {locomotion:'walk',ground:true,vx:110,vy:0},
  {locomotion:'jump',ground:false,vx:110,vy:-140},
  {locomotion:'fall',ground:false,vx:110,vy:160},
  {locomotion:'idle',ground:true,vx:0,vy:0,punch:{ageMs:33,target:[64,16]},events:[{id:'p1',type:'punch'}]},
  {locomotion:'idle',ground:true,vx:0,vy:0,punch:{ageMs:66,target:[64,16]}},
  {locomotion:'walk',ground:true,vx:-110,vy:0,facing:-1},
  {locomotion:'idle',ground:true,vx:0,vy:0}
];
for (const raw of catalog.items) {
  const item = normalizeCatalogItem(raw, catalog), player = new PlannerPlayer(catalog,[item]);
  for (let i=0;i<states.length;i++) {
    const motion={clockMs:5000+i*33,moveMs:i*33,x:0,y:0,worldX:400+i*4,worldY:-20,facing:1,events:[],...states[i]};
    try {
      const result=player.step(motion,33); report.cases++; report.cues+=result.cues.length;
      for (const call of result.calls) {
        report.calls++; if(call.xmlParticle)report.xmlParticleCalls++;
        if(!call.matrix?.every(Number.isFinite) || !Number.isFinite(call.alpha) ||
          !call.line && ![call.sx,call.sy,call.sw,call.sh].every(Number.isFinite))
          report.invalid.push({item:raw.id,state:i,pass:call.pass});
        if(!call.line&&!files.has(call.atlas))missing.add(call.atlas);
      }
    } catch(error) {report.invalid.push({item:raw.id,state:i,error:error.message});}
  }
}
report.missingAtlases=[...missing].sort();
const output=process.argv[2];
if(output)await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.invalid.length)process.exitCode=1;
