import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveItemInfo} from '../src/item-info.mjs';
const snapshot=JSON.parse(await readFile(new URL('../data/item-info.json',import.meta.url)));
const catalog=JSON.parse(await readFile(new URL('../demo/catalog.json',import.meta.url))).items;
const native=JSON.parse(await readFile(new URL('../demo/native-metadata.json',import.meta.url))).items;

test('Shades and Legendbot preserve opposite wiki-backed permissions',()=>{
  const shades=resolveItemInfo(snapshot,{id:34,name:'Shades'});
  assert.equal(shades.description,"The future's so bright, you need these.");
  assert.deepEqual(shades.properties,['This item CAN be transmuted.','This item never drops any seeds.']);
  const bot=resolveItemInfo(snapshot,{id:1780,name:'Legendbot-009'});
  assert.deepEqual(bot.properties,['This item CANNOT be transmuted.','This item cannot be dropped or traded.','This item never drops any seeds.']);
});
test('unknown or unverified metadata cannot become permissive item properties',()=>{
  const missing=resolveItemInfo(snapshot,{id:-1,name:'Unknown'});
  assert.equal(missing.verified,false);assert.deepEqual(missing.properties,[]);
  assert.equal(missing.source,null);
  const unverified=resolveItemInfo({items:{1:{description:'Native text',wikiVerified:false,properties:['This item can be dropped and traded.']}}},{id:1});
  assert.equal(unverified.description,'Native text');assert.deepEqual(unverified.properties,[]);
});
test('all catalog entries have a description and verified properties track complete infobox flags',()=>{
  assert.equal(Object.keys(snapshot.items).length,catalog.length);
  for(const item of catalog){
    const record=snapshot.items[item.id];assert.ok(record.description,`${item.id} description`);
    if(!record.wikiVerified){
      assert.deepEqual(record.properties,[]);
      assert.equal(record.description,native[item.id].sourceFields.str_version_22);
      continue;
    }
    const lines=record.wikiPropertyLines;
    assert.ok(record.properties.includes(lines.includes('This item can be transmuted.')?'This item CAN be transmuted.':'This item CANNOT be transmuted.'),`${item.id} transmute`);
    assert.ok(record.properties.includes(lines.includes('This item cannot be dropped or traded.')?'This item cannot be dropped or traded.':'This item can be dropped and traded.'),`${item.id} trade`);
    assert.equal(record.properties.includes('This item never drops any seeds.'),lines.includes('This item never drops any seeds.'),`${item.id} seeds`);
  }
});
test('resolver returns isolated properties and permits only the verified wiki source',()=>{
  const result=resolveItemInfo(snapshot,{id:34,name:'<b>literal</b>'});
  assert.equal(result.name,'<b>literal</b>');result.properties.push('changed');
  assert.equal(snapshot.items[34].properties.includes('changed'),false);
  assert.equal(resolveItemInfo({items:{1:{wikiVerified:true,source:'javascript:alert(1)',properties:[]}}},{id:1}).source,null);
});


test('Fist and Wrench expose readable built-in tool information',()=>{
  const fist=resolveItemInfo(snapshot,{id:-100001,name:'Fist',tool:true,toolType:'fist'});
  const wrench=resolveItemInfo(snapshot,{id:-100002,name:'Wrench',tool:true,toolType:'wrench'});
  assert.match(fist.description,/punch objects/i);
  assert.match(wrench.description,/customization settings/i);
  assert.deepEqual(fist.properties,[]);
  assert.deepEqual(wrench.properties,[]);
  assert.equal(fist.verified,false);
  assert.equal(wrench.verified,false);
});

test('positive drop-and-trade permission is omitted while restrictions remain visible',()=>{
  const tradable=resolveItemInfo(snapshot,{id:34,name:'Shades'});
  const restricted=resolveItemInfo(snapshot,{id:1780,name:'Legendbot-009'});
  assert.ok(!tradable.properties.includes('This item can be dropped and traded.'));
  assert.ok(restricted.properties.includes('This item cannot be dropped or traded.'));
});
