import test from 'node:test';
import assert from 'node:assert/strict';
import {compileWorldRules} from '../src/world-rules.mjs';
import {buildWorldDrawList,uniformLandWorld,renderWorld,registerBlocks,removeBlock,
  placeBlock,tileVariant,invalidateWorld} from '../js/land-system.mjs';
test('world rules use compact numeric tables while retaining each atlas page',()=>{
  const rules=compileWorldRules({2:{atlas:[8,20],spread:2,collision:1,page:'terrain'},
    7:{atlas:[1,2],spread:3,page:'props',animFrames:4,animMs:100},8:{unsupported:true}});
  assert.ok(rules.spread instanceof Uint8Array);assert.equal(rules.atlasX[2],8);
  assert.equal(rules.pages[rules.page[7]],'props');assert.equal(rules.frames[7],4);assert.equal(rules.present[8],0);
});
test('world lists cull to the viewport and preserve background/foreground passes',()=>{
  const world=uniformLandWorld(2,24,14);
  const calls=buildWorldDrawList(world,0,24*32,64,32);
  assert.equal(calls.length,4);assert.deepEqual(calls.map(call=>call.layer),['bg','bg','fg','fg']);
  assert.deepEqual(calls.filter(call=>call.layer==='fg').map(call=>call.x),[0,32]);
});
test('repeating scenery fills arbitrary viewport widths at negative and distant camera coordinates',()=>{
  const world=uniformLandWorld(2,24,14);
  for(const camX of [-10001,-3200,-1,3199,100000]) {
    const calls=buildWorldDrawList(world,camX,768,10000,32,0,{repeatX:true,layers:['fg']});
    assert.ok(calls.length>=313);assert.ok(calls[0].x<=0);
    assert.ok(calls.at(-1).x+32>=10000);
    for(let i=1;i<calls.length;i++)assert.equal(calls[i].x-calls[i-1].x,32);
  }
});
test('editing invalidates neighbouring cached connections without rebuilding an entire world',()=>{
  registerBlocks([[60000,'fixture dirt',0,'test',0,0,2,1,'fg']]);
  const world=uniformLandWorld(60000,24,0);
  const before=buildWorldDrawList(world,32,768,32,32)[0];
  assert.equal(removeBlock(world,2,24),true);
  const after=buildWorldDrawList(world,32,768,32,32)[0];
  assert.notDeepEqual([before.sx,before.sy],[after.sx,after.sy]);
  const [x,y]=tileVariant(world,1,24);
  assert.deepEqual([after.sx,after.sy],[x*32,y*32]);
  assert.equal(placeBlock(world,2,24,60000),true);
  assert.deepEqual(buildWorldDrawList(world,32,768,32,32),[before]);
  world.fg[24][2]=0;invalidateWorld(world);
  assert.deepEqual(buildWorldDrawList(world,32,768,32,32),[after]);
});
test('world drawing resolves each page once and reports actual draw counts',()=>{
  const world=uniformLandWorld(2,24,14),pages=[],drawn=[];
  const result=renderWorld({drawImage(...args){drawn.push(args);}},world,page=>{pages.push(page);return {};},0,768,64,32,0);
  assert.equal(pages.length,1);assert.equal(drawn.length,4);
  assert.deepEqual(result,{visibleTiles:4,drawCalls:4,sheets:1});
  assert.deepEqual(buildWorldDrawList(world,NaN,0,32,32),[]);
});
