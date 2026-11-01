import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RIDING_REFERENCE_PIXELS_PER_UNIT,RIDING_REFERENCE_PERIOD_MS,RIDING_ARM_PERIOD_MS,
  RIDING_ARM_KEYS,sampleMountedGait,sampleMountedArms} from '../src/mounted-gait.mjs';
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
test('grounded riding arms follow the fitted twenty-frame sway rather than the faster body bob',()=>{
  const player=new PlannerPlayer(catalog,[normalizeCatalogItem(raw,catalog)]);
  const angles=[];
  for(let n=0;n<20;n++){
    const result=player.step(frame(n*RIDING_ARM_PERIOD_MS/20),16);
    angles.push(result.pose.frontAngle);
    assert.equal(result.pose.backAngle,result.pose.frontAngle);
  }
  assert.deepEqual(angles,[-34,-38,-38,-42,-44,-46,-48,-48,-52,-54,
    -55,-54,-50,-50,-50,-46,-44,-41,-40,-38]);
  assert.notEqual(RIDING_ARM_PERIOD_MS,RIDING_REFERENCE_PERIOD_MS);
  const loop=player.step(frame(RIDING_ARM_PERIOD_MS),16);
  assert.equal(loop.pose.frontAngle,angles[0]);
  const rest=player.step(frame(700,{locomotion:'idle',vx:0}),16);
  assert.equal(rest.pose.frontAngle,-35);
});
test('riding sway preserves equipment rest-angle differences and cannot mask air or punch',()=>{
  const item={vehicle:true,raw:{},staticArmPose:{frontAngle:-20,backAngle:-10}};
  const sample=sampleMountedArms(item,frame(330));
  assert.equal(sample.frontAngle,-40);assert.equal(sample.backAngle,-30);
  assert.equal(sampleMountedArms(item,frame(330,{punch:{ageMs:20}})),null);
  assert.equal(sampleMountedArms(item,frame(330,{ground:false,locomotion:'jump'})),null);
  assert.equal(sampleMountedArms(item,frame(330,{locomotion:'idle',vx:0})),null);
  assert.equal(RIDING_ARM_KEYS.length,20);
});
test('browser and tested riding animation are identical',()=>{
  assert.equal(readFileSync(new URL('../src/mounted-gait.mjs',import.meta.url),'utf8'),
    readFileSync(new URL('../demo/engine/mounted-gait.mjs',import.meta.url),'utf8'));
});
