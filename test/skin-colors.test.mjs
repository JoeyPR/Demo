import test from 'node:test';
import assert from 'node:assert/strict';
import {SKINS,resolveStoredSkin} from '../js/skin-colors.mjs';

test('saved selections migrate to stable skin IDs and invalid saves retain the original default',()=>{
  assert.equal(SKINS[resolveStoredSkin(0)].id,'default-7');
  assert.equal(SKINS[resolveStoredSkin('buddy-legacy')].name,'Buddy Legacy');
  assert.equal(SKINS[resolveStoredSkin('invalid')].id,'default-7');
  assert.equal(new Set(SKINS.map(skin=>skin.id)).size,SKINS.length);
  assert.equal(SKINS.find(skin=>skin.id==='grey').hex,'#7F7F7F');
  assert.deepEqual(SKINS.find(skin=>skin.id==='mod').rgb,[154,163,168,255]);
  assert.equal(SKINS.find(skin=>skin.id==='subscriber-purple').rgb[3],184);
});
