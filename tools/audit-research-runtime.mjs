import {readFile,writeFile,access} from 'node:fs/promises';
import {normalizeCatalogItem} from '../src/catalog-adapter.mjs';
import {PlannerPlayer} from '../src/player.mjs';
import {rendererScripts} from '../src/research-data.mjs';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const catalog=await read('demo/catalog.json');
catalog.renderers=rendererScripts(await read('demo/renderer-data.json'));
catalog.fxRenderers=rendererScripts(await read('demo/fx-data.json'));
catalog.punchData=await read('demo/punch-data.json');catalog.punchSfx=await read('demo/punch-sfx.json');
catalog.liftProfiles=Object.fromEntries((await read('demo/lift-profiles.json')).profiles.map(profile=>[profile.id,profile]));
const report={catalogItems:catalog.items.length,rendererScripts:Object.keys(catalog.renderers).length,
  fxScripts:Object.keys(catalog.fxRenderers).length,framesPerItem:18,invalid:[],missingAtlases:[],
  itemsWithSampledParticles:0,peakDrawCalls:0,peakParticleCalls:0,
  scope:'Structural playback audit: idle, walking, jumping, punch start/update/stop. No claim of pixel parity or complete conditional FX coverage.'};
const atlases=new Set();
for(const raw of catalog.items) {
  try {
    const item=normalizeCatalogItem(raw,catalog),player=new PlannerPlayer(catalog,[item]);
    let emitted=false;
    for(let step=0;step<18;step++) {
      const punching=step>=10&&step<15,airborne=step>=7&&step<10;
      const motion={clockMs:step*33,moveMs:step*33,ground:!airborne,locomotion:airborne?'jump':step>=3&&step<7?'walk':'idle',
        facing:step<9?1:-1,x:0,y:0,worldX:step*2,worldY:airborne?-16:0,vx:step>=3&&step<7?100:0,vy:airborne?-100:0,
        events:step===10?[{id:'punch',type:'punch',at:330}]:step===7?[{id:'jump',type:'jump',at:231}]:[],
        punch:punching?{ageMs:(step-10)*33,target:[76,16]}:null};
      const result=player.step(motion,33),particles=result.calls.filter(call=>call.fxEngine);
      emitted ||= particles.length>0;
      report.peakDrawCalls=Math.max(report.peakDrawCalls,result.calls.length);
      report.peakParticleCalls=Math.max(report.peakParticleCalls,particles.length);
      for(const call of result.calls) {
        if(!call.matrix?.every(Number.isFinite)||!Number.isFinite(call.alpha)||
            !call.line&&![call.sx,call.sy,call.sw,call.sh].every(Number.isFinite))throw Error('Non-finite draw call');
        if(call.atlas&&call.atlas!=='reference-fx.png')atlases.add(call.atlas);
      }
    }
    if(emitted)report.itemsWithSampledParticles++;
  } catch(error) {report.invalid.push({id:raw.id,name:raw.name,message:error.message});}
}
for(const atlas of atlases) {
  try {await access(new URL('../demo/assets/'+atlas,import.meta.url));}
  catch {report.missingAtlases.push(atlas);}
}
report.missingAtlases.sort();
const output=process.argv[2];
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.invalid.length||report.missingAtlases.length)process.exitCode=1;
