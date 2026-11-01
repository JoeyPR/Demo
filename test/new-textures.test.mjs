import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerBlocks,tileVariant,uniformLandWorld} from '../js/land-system.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const manifest=JSON.parse(read('evidence/new-textures-import.json'));
const dimensions=png=>[png.readUInt32BE(16),png.readUInt32BE(20)];

test('native texture patch is installed with its decoded dimensions and synchronized page 17 copies',()=>{
  for(const texture of manifest.textures)for(const destination of texture.destinations) {
    const png=read(destination.path);
    assert.deepEqual(dimensions(png),texture.dimensions,destination.path);
    assert.equal(createHash('sha256').update(png).digest('hex'),texture.pngSha256,destination.path);
  }
  assert.deepEqual(dimensions(read('sheets/tiles/tiles_candyblock.png')),[512,256]);
  assert.deepEqual(read('sheets/tiles/tiles_page17.png'),read('demo/assets/tiles_page17.png'));
});

test('every candy block neighbour variant fits the native horizontal atlas geometry',()=>{
  const rows=JSON.parse(read('data/land-blocks.json'));
  registerBlocks(rows);
  const candy=rows.filter(row=>row[3]==='tiles_candyblock');
  assert.equal(candy.length,3);
  const [width,height]=dimensions(read('sheets/tiles/tiles_candyblock.png'));
  const neighbours=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
  for(const [id,, , ,originX,originY] of candy) {
    const world=uniformLandWorld(id,0,0);
    for(let mask=0;mask<256;mask++) {
      neighbours.forEach(([dx,dy],bit)=>world.fg[10+dy][10+dx]=(mask&(1<<bit))?id:0);
      const [x,y]=tileVariant(world,10,10);
      assert.ok((originX+x)*32>=0&&(originX+x+1)*32<=width,`${id}/${mask} outside atlas X`);
      assert.ok((originY+y)*32>=0&&(originY+y+1)*32<=height,`${id}/${mask} outside atlas Y`);
    }
  }
});
