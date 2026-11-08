import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerBlocks} from '../js/land-system.mjs';

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
