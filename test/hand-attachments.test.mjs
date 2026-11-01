import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCatalogItem,advanceCatalogItem} from '../src/catalog-adapter.mjs';
import {buildDrawList} from '../src/render.mjs';
import {armPivot,limbMatrix} from '../src/rig.mjs';
import {point} from '../src/math.mjs';
const catalog=JSON.parse(readFileSync(new URL('../demo/catalog.json',import.meta.url)));
const renderers=JSON.parse(readFileSync(new URL('../demo/renderer-data.json',import.meta.url)));
catalog.renderers=renderers.scripts??renderers;
const motion={x:17,y:23,ground:true,facing:1,locomotion:'idle',clockMs:0,moveMs:0,events:[]};
const pose={backAngle:0,frontAngle:0,backFoot:0,frontFoot:0,face:[0,0]};
const close=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${a} != ${b}`));
const prop=(x,y,u)=>({a:'held.png',sx:0,sy:0,sw:1,sh:1,x,y,ax:0,ay:0,u});

test('held pieces use their own arm side and that side’s captured reference angle',()=>{
  const item=normalizeCatalogItem({id:1,name:'Two props',slot:5,pose:{arm1:40,arm2:-20},
    gameIcon:[prop(24,26,1),prop(9,26,11)]},catalog);
  assert.deepEqual(item.pieces.map(p=>[p.attachment,p.referenceAngle]),[['backHand',40],['frontHand',-20]]);
  const claws=normalizeCatalogItem(catalog.items.find(item=>item.id===12404),catalog);
  assert.deepEqual(claws.pieces.filter(p=>p.a==='player_cosmetics2.png').map(p=>p.attachment),['backHand','frontHand']);
});

test('both held grips stay coincident with the rendered arm grip through rotation, facing and lift',()=>{
  const item=normalizeCatalogItem({id:1,name:'Grip markers',slot:5,gameIcon:[prop(24,26,1),prop(9,26,11)]},catalog);
  for(const facing of [1,-1])for(const angle of [-180,-35,0,45,90,270]){
    const calls=buildDrawList({catalog,items:[item],motion:{...motion,facing},
      pose:{...pose,backAngle:angle,frontAngle:-angle},visual:{playerLift:{y:-3}}});
    for(const side of ['back','front']){
      const arm=calls.find(call=>call.tag===side+'Arm');
      const held=calls.find(call=>call.owner===1&&call.attachment===side+'Hand');
      close(point(arm.matrix,[3,8]),point(held.matrix,[0,0]));
    }
  }
  assert.deepEqual(armPivot('back'),[24,19]);assert.deepEqual(armPivot('front'),[9,19]);
});

test('captured rotated props receive the pose delta once instead of double rotation',()=>{
  for(const [side,reference,angle] of [['back',-35,82],['front',60,-40]]){
    const capture=point(limbMatrix(side,reference),[side==='back'?24:9,26]);
    const item=normalizeCatalogItem({id:1,name:'Already posed',slot:5,
      pose:{arm1:side==='back'?reference:0,arm2:side==='front'?reference:0},
      gameIcon:[prop(...capture,side==='back'?1:11)]},catalog);
    const calls=buildDrawList({catalog,items:[item],motion,pose:{...pose,[side+'Angle']:angle}});
    close(point(calls.find(call=>call.owner===1).matrix,[0,0]),
      point(calls.find(call=>call.tag===side+'Arm').matrix,[3,8]));
  }
});

test('a back-hand prop follows the stretched punch fist without stretching the prop',()=>{
  const item=normalizeCatalogItem({id:1,name:'Punch grips',slot:5,gameIcon:[prop(24,26,1),prop(9,26,11)]},catalog);
  for(const facing of [1,-1])for(const stretch of [.3,.8,1.3]){
    const calls=buildDrawList({catalog,items:[item],motion:{...motion,facing},
      pose:{...pose,frontAngle:40,backAngle:75,punch:{angle:75,width:1.4,stretch}}});
    const held=calls.find(call=>call.owner===1&&call.attachment==='backHand');
    close(point(held.matrix,[0,0]),point(calls.find(call=>call.tag==='backArm').matrix,[10,40]));
    assert.ok(Math.abs(Math.abs(held.matrix[0]*held.matrix[3]-held.matrix[1]*held.matrix[2])-1)<1e-7);
    close(point(calls.find(call=>call.owner===1&&call.attachment==='frontHand').matrix,[0,0]),
      point(calls.find(call=>call.tag==='frontArm').matrix,[3,8]));
  }
});

test('XML-bound glove sprites retain separate arm bindings while independent effects stay body/world-bound',()=>{
  const item=normalizeCatalogItem(catalog.items.find(item=>item.id===14278),catalog);
  advanceCatalogItem(item,0,motion);advanceCatalogItem(item,100,{...motion,clockMs:100});
  const gloves=item.pieces.filter(p=>p.xmlSprite==='Glove');
  assert.deepEqual(gloves.map(p=>p.attachment),['backHand','frontHand']);
  assert.equal(item.pieces.find(p=>p.xmlSprite==='Lightning').attachment,'body');
  const independent={...item,id:2,pieces:[{...prop(50,-8,10),pet:true,attachment:'pet'},
    {...prop(65,10,10),xmlParticle:true,world:true,attachment:'world'},
    {...prop(16,32,10),attachment:'body',r:67}]};
  const a=buildDrawList({catalog,items:[independent],motion,pose});
  const b=buildDrawList({catalog,items:[independent],motion,pose:{...pose,backAngle:95,frontAngle:-80}});
  for(const attachment of ['pet','world','body'])
    close(a.find(call=>call.attachment===attachment).matrix,b.find(call=>call.attachment===attachment).matrix);
  const effects=normalizeCatalogItem({id:3,name:'Held item with loose effects',slot:5,atlas:'held.png',gameIcon:[
    {...prop(9,18,11),a:'held.png'}, {...prop(40,0,12),a:'pixel.png'},
    {...prop(16,30,0),a:'ride.png',ride:true},
    {...prop(65,10,12),world:true,pass:'PARTICLES'}]},catalog);
  assert.deepEqual(effects.pieces.map(p=>p.attachment),['frontHand','body','body','world']);
  assert.equal(effects.pieces[3].pass,'PARTICLES');
});

test('rendered sleeves use the same physical shoulder pivot as the arm',()=>{
  const item=normalizeCatalogItem({id:1,name:'Sleeves',slot:1,gameIcon:[
    {...prop(24,18,1),a:'player_sleeve.png',sw:6,sh:10,ax:.5},
    {...prop(9,18,11),a:'player_sleeve.png',sw:6,sh:10,ax:.5}]},catalog);
  const calls=buildDrawList({catalog,items:[item],motion,pose:{...pose,backAngle:-75,frontAngle:40}});
  for(const side of ['back','front']){
    const sleeve=calls.find(call=>call.owner===1&&call.attachment===side+'Arm');
    const arm=calls.find(call=>call.tag===side+'Arm');close(sleeve.matrix,arm.matrix);
  }
});
