import test from 'node:test';
import assert from 'node:assert/strict';
import {SKINS,resolveStoredSkin} from '../js/skin-colors.mjs';
import {tintPixelBuffer} from '../src/canvas-assets.mjs';
import {buildDrawList} from '../src/render.mjs';

test('saved selections migrate to stable skin IDs and invalid saves retain the original default',()=>{
  assert.equal(SKINS[resolveStoredSkin(0)].id,'default-7');
  assert.equal(SKINS[resolveStoredSkin('buddy-legacy')].name,'Buddy Legacy');
  assert.equal(SKINS[resolveStoredSkin('invalid')].id,'default-7');
  assert.equal(new Set(SKINS.map(skin=>skin.id)).size,SKINS.length);
  assert.equal(SKINS.find(skin=>skin.id==='grey').hex,'#7F7F7F');
  assert.deepEqual(SKINS.find(skin=>skin.id==='mod').rgb,[154,163,168,255]);
  assert.equal(SKINS.find(skin=>skin.id==='subscriber-purple').rgb[3],184);
});
test('Buddy Legacy replaces four source grayscale shades and preserves colored face pixels and alpha',()=>{
  const skin=SKINS.find(skin=>skin.id==='buddy-legacy');
  const pixels=new Uint8ClampedArray([172,172,172,255,190,190,190,128,209,209,209,255,
    220,220,220,255,255,120,100,255,140,140,140,0]);
  tintPixelBuffer(pixels,skin.rgb,skin.palette);
  assert.deepEqual([...pixels],[204,159,78,255,218,177,105,128,230,196,137,255,
    241,215,177,255,255,120,100,255,140,140,140,0]);
});
test('selected skin palette applies to body, eyelids, feet and skin-relative attachments; item skin overrides win',()=>{
  const skin=SKINS.find(skin=>skin.id==='buddy-legacy');
  const motion={x:0,y:0,facing:1,clockMs:0,moveMs:0,ground:true,locomotion:'idle'};
  const pose={backAngle:0,frontAngle:0,backFoot:0,frontFoot:0,face:[0,0]};
  const visual={skin:skin.rgb,skinPalette:skin.palette};
  const calls=buildDrawList({catalog:{},items:[],motion,pose,visual});
  for(const tag of ['body','head','backFoot','frontFoot','eyelids','frontArm'])
    assert.deepEqual(calls.find(call=>call.tag===tag).skinPalette,skin.palette);
  assert.equal(calls.find(call=>call.tag==='eyes').skinPalette,null);
  const transformed=buildDrawList({catalog:{},items:[{id:1,slot:0,raw:{},pieces:[],skin:[20,30,40,255]}],motion,pose,visual});
  assert.equal(transformed.find(call=>call.tag==='head').skinPalette,null);
  assert.deepEqual(transformed.find(call=>call.tag==='head').tint,[20,30,40]);
  const sameColorOverride=buildDrawList({catalog:{},items:[{id:2,slot:0,raw:{},pieces:[],skin:[...skin.rgb]}],motion,pose,visual});
  assert.equal(sameColorOverride.find(call=>call.tag==='head').skinPalette,null,
    'item-owned RGB skin stays an RGB tint even when its color equals Buddy Legacy');
});


test('Duct Taped overrides the selected swatch and item-owned skin colors with Grey',()=>{
  const selected=SKINS.find(skin=>skin.id==='buddy-legacy');
  const grey=SKINS.find(skin=>skin.id==='grey');
  const motion={x:0,y:0,facing:1,clockMs:0,moveMs:0,ground:true,locomotion:'idle'};
  const pose={backAngle:0,frontAngle:0,backFoot:0,frontFoot:0,face:[0,0]};
  const item={id:99,slot:0,raw:{},pieces:[],skin:[20,30,40,255]};
  const calls=buildDrawList({catalog:{},items:[item],motion,pose,
    visual:{skin:selected.rgb,skinPalette:selected.palette,skinOverride:grey.rgb}});
  for(const tag of ['body','head','backFoot','frontFoot','eyelids','frontArm']){
    const call=calls.find(entry=>entry.tag===tag);
    assert.deepEqual(call.tint,grey.rgb.slice(0,3),tag+' must use Grey');
    assert.equal(call.skinPalette,null,tag+' must not be recolored by an item palette');
  }
});
