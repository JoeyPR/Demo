import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RIDING_REFERENCE_PIXELS_PER_UNIT,RIDING_REFERENCE_PERIOD_MS,sampleMountedGait} from '../src/mounted-gait.mjs';
import {normalizeCatalogItem} from '../src/catalog-adapter.mjs';
import {PlannerPlayer} from '../src/player.mjs';
const catalog=JSON.parse(readFileSync(new URL('../demo/catalog.json',import.meta.url)));
const raw=catalog.items.find(item=>item.id===592);
const frame=(clockMs,extra={})=>({x:0,y:0,facing:1,ground:true,vx:150,vy:0,locomotion:'walk',
  clockMs,moveMs:clockMs,events:[],...extra});

test('the supplied Tiny Horsie uses the measured travel bob and retains its own atlas clock',()=>{
  const item=normalizeCatalogItem(raw,catalog),player=new PlannerPlayer(catalog,[item]);
  const body=[];
  for(let n=0;n<10;n++){
    const out=player.step(frame(n*RIDING_REFERENCE_PERIOD_MS/10),16);
    body.push(Math.round(out.lift.gait.bodyY*RIDING_REFERENCE_PIXELS_PER_UNIT+32));
    assert.equal(out.lift.gait.profile.evidence,'set-1.mp4-measured-rider-components');
  }
  assert.deepEqual(body,[26,27,27,28,29,29,28,27,27,26]);
  const a=sampleMountedGait(item,frame(1000)),b=sampleMountedGait(item,frame(1000+RIDING_REFERENCE_PERIOD_MS));
  assert.equal(a.bodyY,b.bodyY);
  assert.ok(item.pieces.some(piece=>piece.attachment==='mount'&&piece.sequence));
  assert.equal(player.step(frame(2000,{locomotion:'idle',vx:0}),16).lift.gait,undefined);
});
test('riding arms and held attachments still respond to jumping and punching',()=>{
  const player=new PlannerPlayer(catalog,[normalizeCatalogItem(raw,catalog)]);
  const rest=player.step(frame(0,{locomotion:'idle',vx:0}),16);
  const jump=player.step(frame(16,{ground:false,locomotion:'jump',vy:-100}),16);
  assert.notEqual(jump.pose.frontAngle,rest.pose.frontAngle);
  assert.equal(jump.lift.gait,undefined);
  const punch=player.step(frame(32,{punch:{ageMs:70,target:[64,16]}}),16);
  assert.deepEqual(punch.pose.face,[4,0]);assert.ok(punch.pose.punch);
  assert.notEqual(punch.pose.backAngle,rest.pose.backAngle);
});
test('browser and tested riding animation are identical',()=>{
  assert.equal(readFileSync(new URL('../src/mounted-gait.mjs',import.meta.url),'utf8'),
    readFileSync(new URL('../demo/engine/mounted-gait.mjs',import.meta.url),'utf8'));
});
