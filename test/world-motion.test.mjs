import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldMotion,WORLD_ORIGIN_X,WORLD_ORIGIN_Y,WORLD_PLAYER_HEIGHT} from '../js/world-motion.mjs';
import {PreviewMotion} from '../src/motion.mjs';
const blocks={1:{collision:1},2:{collision:2},3:{collision:0}};
function world(){return {fg:Array.from({length:60},(_,y)=>new Array(100).fill(y>=24?1:0)),
  bg:Array.from({length:60},()=>new Array(100).fill(0))};}
function motion(grid=world(),options={}){return new WorldMotion({world:grid,blocks,...options});}

test('the optional spatial hook preserves flat-floor preview movement exactly',()=>{
  class HookedPreview extends PreviewMotion {advancePosition(dt){super.advancePosition(dt);}}
  const original=new PreviewMotion({doubleJump:true}),hooked=new HookedPreview({doubleJump:true});
  for(let i=0;i<100;i++) {
    const input={right:i<40,jump:i===4||i===15,punch:i>20&&i<60};
    assert.deepEqual(hooked.step(16,input),original.step(16,input));
  }
});
test('a world player stands on actual tiles and emits one landing event',()=>{
  const m=motion();m.y=-50;m.ground=false;
  let landings=0;
  for(let i=0;i<60;i++)landings+=m.step(16,{}).events.filter(event=>event.type==='land').length;
  assert.equal(m.y,0);assert.equal(m.vy,0);assert.equal(m.ground,true);assert.equal(landings,1);
  assert.equal(m.solidAt(0,1),true);assert.equal(m.solidAt(0,-1),false);
});
test('tile side collisions stop the box at the wall without tunnelling',()=>{
  const grid=world();grid.fg[22][52]=grid.fg[23][52]=1;
  const m=motion(grid);
  for(let i=0;i<25;i++)m.step(50,{right:true});
  assert.equal(m.x,22);assert.equal(m.vx,0);
  const left=world();left.fg[22][49]=left.fg[23][49]=1;
  const l=motion(left);for(let i=0;i<20;i++)l.step(50,{left:true});
  assert.equal(l.x,-2);assert.equal(l.vx,0);
});
test('walking off an edge falls onto a lower real tile surface',()=>{
  const grid=world();for(let y=24;y<=25;y++)for(let x=51;x<=65;x++)grid.fg[y][x]=0;
  const m=motion(grid);let leftGround=false,landed=false;
  for(let i=0;i<50;i++) {
    const frame=m.step(16,{right:i<30});
    leftGround ||= !frame.ground;
    landed ||= frame.events.some(event=>event.type==='land'&&event.y===40);
  }
  assert.equal(leftGround,true);assert.equal(landed,true);assert.equal(m.y,40);
});
test('platforms pass an ascending player and catch a descending one',()=>{
  const grid=world();for(let x=48;x<=52;x++)grid.fg[20][x]=2;
  const m=motion(grid);let above=false,landed=false;
  for(let i=0;i<120;i++) {
    const frame=m.step(16,{jump:i<35});above ||= frame.y<-80;
    landed ||= frame.events.some(event=>event.type==='land'&&event.y===-80);
  }
  assert.equal(above,true);assert.equal(landed,true);assert.equal(m.y,-80);
});
test('solid ceilings stop the rising player at the actual lower tile edge',()=>{
  const grid=world();for(let x=48;x<=52;x++)grid.fg[20][x]=1;
  const m=motion(grid);let highest=0,stopped=false;
  for(let i=0;i<20;i++) {
    const f=m.step(16,{jump:true});highest=Math.min(highest,f.y);
    stopped ||= f.vy===0&&!f.ground;
  }
  assert.ok(Math.abs(highest-((21*20+WORLD_PLAYER_HEIGHT)-WORLD_ORIGIN_Y))<1e-6);
  assert.equal(stopped,true);
});
test('world collision retains double jumps, punch repeat, and ability refill after landing',()=>{
  const m=motion(world(),{doubleJump:true});let punches=0,second=false;
  for(let i=0;i<150;i++) {
    const frame=m.step(16,{jump:i===1||i===8,punch:i<80});
    punches+=frame.events.filter(event=>event.type==='punch').length;
    second ||= frame.events.some(event=>event.type==='doubleJump');
  }
  assert.equal(second,true);assert.ok(punches>=5);assert.equal(m.airAvailable,true);
  assert.equal(m.punch,null);assert.equal(m.ground,true);
});
test('foreground wraps horizontally while decorative backgrounds never collide',()=>{
  const grid=world();grid.fg[24][0]=0;grid.bg[23][50]=1;
  const m=motion(grid);
  assert.equal(m.collisionAt(100,24),0);assert.equal(m.collisionAt(-100,24),0);
  assert.equal(m.collisionAt(50,23),0);
  assert.equal(m.solidAt(100*20-WORLD_ORIGIN_X+10,1),false);
});
test('falling below the world respawns through the event contract',()=>{
  const grid=world();for(const row of grid.fg)row.fill(0);
  const m=motion(grid);m.y=830;m.ground=false;m.vy=400;
  const f=m.step(16,{});
  assert.equal(f.x,0);assert.equal(f.y,0);assert.equal(f.vx,0);assert.equal(f.vy,0);
  assert.ok(f.events.some(event=>event.type==='respawn'));
});
