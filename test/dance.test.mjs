import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DanceSampler,sampleDance,sampleTalkingFace} from '../src/dance.mjs';
import {PlannerPlayer} from '../src/player.mjs';
import {compose,translate} from '../src/math.mjs';
import {heldMatrix} from '../src/rig.mjs';

const idle={x:0,y:0,facing:1,vx:0,vy:0,clockMs:100,moveMs:0,
  ground:true,locomotion:'idle',events:[]};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

test('captured dance targets move the actual two arms oppositely and bob both feet',()=>{
  const initial=sampleDance(0);
  assert.deepEqual(initial.face,[0,1]);
  const a=sampleDance(100);
  close(a.backAngle,45);close(a.frontAngle,315);
  close(a.backFoot,1);close(a.frontFoot,1);close(a.bodyY,-1);
  const b=sampleDance(400);
  close(b.backFoot,-2);close(b.frontFoot,-2);close(b.bodyY,2);
  for(let t=0;t<7270;t+=1000/30) {
    const pose=sampleDance(t);
    assert.ok(pose.backAngle>=0&&pose.backAngle<360);
    assert.ok(pose.frontAngle>=0&&pose.frontAngle<360);
    close(pose.backFoot,pose.frontFoot);
    close(pose.backFoot+pose.bodyY,0);
  }
});
test('one-second turn phases produce the reference two-second facing changes',()=>{
  assert.deepEqual([0,500,1500,2500,3500,4500].map(t=>sampleDance(t).facing),[1,1,-1,-1,1,1]);
  assert.deepEqual([0,500,1500,2500,3500].map(t=>sampleDance(t,{startFacing:-1}).facing),[-1,-1,1,1,-1]);
});
test('dance pose seeking does not depend on display frame rate or sample order',()=>{
  const sampler=new DanceSampler();
  for(const t of [0,17,39,128,1001,1999,3000,7270,100,1500,0])
    assert.deepEqual(sampler.sample(t),sampleDance(t));
  assert.deepEqual(sampler.sample(250,-1),sampleDance(250,{startFacing:-1}));
  assert.deepEqual(sampleDance(NaN),sampleDance(0));
});
test('dance composes through the real eyes, feet, arms and held-item pivot',()=>{
  const hand={id:1,slot:5,raw:{},pieces:[{a:'test-hand.png',sx:0,sy:0,sw:8,sh:8,x:0,y:0,w:8,h:8}],hide:[]};
  const player=new PlannerPlayer({},[hand]);
  const out=player.step(idle,16,{dance:{elapsedMs:500,startFacing:1}});
  assert.equal(out.pose.dance.active,true);
  const eyes=out.calls.find(call=>call.tag==='eyes');
  assert.deepEqual([eyes.atlas,eyes.sx,eyes.sy],['player_eyes.png',0,32]);
  assert.equal(out.calls.filter(call=>call.atlas==='player_arm.png').length,2);
  assert.equal(out.calls.filter(call=>call.atlas==='player_feet.png').length,2);
  close(out.lift.y,out.pose.dance.bodyY);
  const held=out.calls.find(call=>call.owner===1);
  const expected=compose(translate(0,out.lift.y),heldMatrix('front',out.pose.frontAngle));
  for(let i=0;i<6;i++)close(held.matrix[i],expected[i]);
  const left=player.step(idle,16,{dance:{elapsedMs:1500,startFacing:1}});
  assert.equal(left.pose.dance.facing,-1);
  assert.equal(left.calls.find(call=>call.tag==='body').matrix[0],-1);
});
test('moving, airborne and punching poses cannot be replaced by stale dance state',()=>{
  for(const motion of [{...idle,locomotion:'walk',vx:100},{...idle,ground:false,locomotion:'jump',vy:-100},
    {...idle,punch:{ageMs:60}}]) {
    const out=new PlannerPlayer({}).step(motion,16,{dance:{elapsedMs:1000,startFacing:1}});
    assert.equal(out.pose.dance,undefined);
    assert.notDeepEqual(out.pose.face,[0,1]);
  }
});
test('speech uses the two captured mouth cells until the shared speech state expires',()=>{
  assert.deepEqual([0,99,100,299,300,650].map(sampleTalkingFace),[[6,1],[6,1],[5,1],[5,1],[6,1],[6,1]]);
  const player=new PlannerPlayer({});
  const speaking=player.step(idle,16,{talking:{active:true,elapsedMs:650}});
  assert.deepEqual(speaking.pose.face,[6,1]);assert.equal(speaking.pose.talking.active,true);
  const eye=speaking.calls.find(call=>call.tag==='eyes');
  assert.deepEqual([eye.sx,eye.sy],[192,32]);
  const finished=player.step(idle,16,{talking:{active:false,elapsedMs:900}});
  assert.deepEqual(finished.pose.face,[0,0]);assert.equal(finished.pose.talking.active,false);
  const punch=player.step({...idle,punch:{ageMs:70}},16,{talking:{active:true,elapsedMs:0}});
  assert.deepEqual(punch.pose.face,[4,0]);assert.equal(punch.pose.talking.active,false);
});
test('browser and tested dance implementation stay identical',()=>{
  for(const name of ['dance.mjs','player.mjs'])assert.equal(
    readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),
    readFileSync(new URL('../demo/engine/'+name,import.meta.url),'utf8'));
});
