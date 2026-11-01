import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getPlayerShadowCalls} from '../js/player-shadow.mjs';
import {registerBlocks,BLOCKS,buildWorldDrawList,uniformLandWorld,foregroundOccludesShadows} from '../js/land-system.mjs';

test('Buddy and colored sprite calls become black shadow calls without mutating their render palette',()=>{
  const palette=[[204,159,78],[218,177,105],[230,196,137],[241,215,177]];
  const body={atlas:'player_head.png',pass:'BODY',tint:[230,196,137],skinPalette:palette,alpha:.7};
  const [shadow]=getPlayerShadowCalls([body]);
  assert.deepEqual(shadow.tint,[0,0,0]);assert.equal(shadow.skinPalette,null);
  assert.equal(shadow.alpha,.7);assert.deepEqual(body.skinPalette,palette);
  assert.deepEqual(body.tint,[230,196,137]);
});
test('doors and solid blocks occupy disjoint shadow-composition passes',()=>{
  registerBlocks(JSON.parse(readFileSync(new URL('../data/world-blocks.json',import.meta.url))));
  const door=Object.entries(BLOCKS).find(([,def])=>/^(main )?door$/i.test(def.name));
  assert.ok(door);assert.equal(foregroundOccludesShadows(door[1]),false);
  assert.equal(foregroundOccludesShadows(BLOCKS[2]),true);
  const world=uniformLandWorld(0,24,0);world.fg[23][50]=Number(door[0]);world.fg[23][51]=2;
  const draw=pass=>buildWorldDrawList(world,50*32,23*32,64,32,0,{layers:['fg'],foregroundPass:pass}).map(call=>call.id);
  assert.deepEqual(draw('walkthrough'),[Number(door[0])]);assert.deepEqual(draw('solid'),[2]);
  assert.deepEqual(draw('all'),[Number(door[0]),2]);
});
