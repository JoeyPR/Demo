import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildNameplate, layoutNameplate } from '../js/nameplate-renderer.mjs';
import { resolveAppearance } from '../src/equipment.mjs';
import { resolveAbilities } from '../src/abilities.mjs';
import { PunchTimeline } from '../src/punch-timeline.mjs';
import { WorldRenderer } from '../js/world-renderer.mjs';
import { uniformLandWorld } from '../js/land-system.mjs';
import { drawBounds } from '../src/draw-bounds.mjs';

const font = JSON.parse(fs.readFileSync(new URL('../img/nameplate/font.json', import.meta.url)));
const sounds = JSON.parse(fs.readFileSync(new URL('../data/research/sfx-punch.json', import.meta.url)));
const titleDefs = [
  { key: 'ss' }, { key: 'dr' }, { key: 'mod', staff: '#' }, { key: 'dev', staff: '6' },
  { key: 'legend', legendary: true, flag: 'legend', plateFlag: 'img/flags/lg.png' },
  { key: 'mentor', flag: 'mentor', plateFlag: 'img/titles/master_icon.png' },
  { key: 'g4g', flag: 'g4g' }, { key: 'cc', flag: 'ccBadge' },
  { key: 'gold', both: 'gold' }, { key: 'pblo', after: 'pblOrganizer' }
];
const model = (extra = {}) => buildNameplate({growId: 'JoeyPR', titles: [], flag: 'us', ...extra}, titleDefs, {leader: {text: '(GL)', colour: [25,185,255]}});
test('bitmap nameplate uses captured advance, offsets and alpha; no browser font metrics', () => {
  const plate = model(), layout = layoutNameplate(plate, font);
  const expected = [...plate.text].reduce((n, ch) => n + font.chars[ch.codePointAt(0)][6], 0) * layout.unit;
  assert.equal(layout.boxes[0][2], expected);
  assert.equal(layout.glyphs.length, plate.text.length * 2);
  assert.ok(layout.glyphs.every(g => Number.isFinite(g.x) && g.rgba.length === 4));
  assert.equal(layoutNameplate(null, font).width, 0);
});
test('new nameplate styles preserve staff text, supporter wrench, guild priority and title order', () => {
  assert.equal(model({growId: ' J_oe! `<4', titles: ['mod', 'dr']}).text, '@Dr.Joe4');
  const guild = model({guildFlag: 34, guildBg: 116, titles: ['legend']});
  assert.equal(guild.place.background, 116);
  assert.equal(model({guildFlag: 34, titles: ['cc']}).place.badge, 'cc');
  assert.equal(model({titles: ['mentor']}).place.src, 'img/titles/master_icon.png');
  assert.equal(model({titles: ['legend']}).place.src, 'img/flags/lg.png');
  assert.deepEqual(model({titles: ['pblo', 'gold']}).icons.map(i => i.paired), [true, false]);
  const support = layoutNameplate(model({titles: ['ss'], wrenchOn: true}), font, 750);
  assert.ok(support.pictures.find(p => p.wrench).green);
  assert.notEqual(support.pictures.find(p => p.wrench).angle, 0);
  assert.equal(model({guildRole: 'leader'}).text, 'JoeyPR');
  assert.equal(model({guildRole: 'leader'}).glyphs.at(-1).rgb[2], 255);
});
test('appearance replacement retains original equipment identity and rejects cross-slot replacements', () => {
  const wings = {id:156, slot:6}, replacement = {id:1206, slot:6}, shirt = {id:36, slot:1};
  const lookup = id => [replacement,shirt].find(i => i.id === id);
  const hidden = resolveAppearance([wings], {hiddenIds:[156]}, lookup);
  assert.equal(hidden.visualItems.length, 0);
  assert.equal(resolveAbilities(hidden.equippedItems, {items:{156:{doubleJump:true}}}).doubleJump, true);
  const swapped = resolveAppearance([wings], {transmutes:{156:1206}}, lookup);
  assert.equal(swapped.visualItems[0].id, 1206);
  assert.equal(swapped.equippedItems[0].id, 156);
  assert.equal(swapped.visualItems[0].skipLegacyParticles, true);
  const invalid = resolveAppearance([wings], {transmutes:{156:36}}, lookup);
  assert.equal(invalid.visualItems[0], wings);
  assert.equal(invalid.warnings.length, 1);
});
test('punch cues preserve delayed duplicates, survive retrigger, and do not treat punchFx flags as style IDs', () => {
  const timeline = new PunchTimeline(sounds), owner = {id:1780,slot:5};
  const frame = (t,id) => ({clockMs:t,facing:1,events:id?[{type:'punch',id}]:[]});
  assert.equal(timeline.step([owner],frame(0,'p1'))[0].sound,'mlaunch.wav');
  assert.equal(timeline.step([owner],frame(100,'p1')).length,0);
  timeline.step([owner],frame(200,'p2'));
  assert.equal(timeline.step([owner],frame(304)).filter(c=>c.sound==='boom.wav').length,2);
  assert.equal(timeline.step([owner],frame(504)).filter(c=>c.eventId==='p2'&&c.sound==='boom.wav').length,2);
  assert.deepEqual(new PunchTimeline(sounds).step([{id:138,slot:4,raw:{punchFx:1}}],frame(0,'p')),[]);
});

const context = () => ({save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(){},translate(){},scale(){}});
test('terrain cache reuses static chunks and invalidates neighbors, flips, and late-loaded art', () => {
  const world = uniformLandWorld(2), image = {}, ctx = context();
  const renderer = new WorldRenderer({createCanvas:()=>({getContext:context}),maxChunks:2});
  renderer.draw(ctx,world,image,0,768,512,128,0);
  assert.equal(renderer.stats.rasterized,2);
  renderer.draw(ctx,world,image,0,768,512,128,100);
  assert.equal(renderer.stats.rasterized,2);
  assert.equal(renderer.stats.hits,2);
  world.fg[24][8]=0;
  renderer.draw(ctx,world,image,0,768,512,128,200);
  assert.equal(renderer.stats.rasterized,4, 'both chunks share the changed connection halo');
  world.flip['fg:0,24']=1;
  renderer.draw(ctx,world,image,0,768,512,128,300);
  assert.equal(renderer.stats.rasterized,5);
  renderer.draw(ctx,world,image,512,768,512,128,400);
  assert.ok(renderer.chunks.size<=2);
  const pending = new WorldRenderer({createCanvas:()=>({getContext:context})});
  pending.draw(ctx,world,()=>null,0,768,256,128,0);
  assert.equal(pending.chunks.size,0);
  pending.draw(ctx,world,()=>image,0,768,256,128,0);
  assert.equal(pending.chunks.size,1);
});
test('export bounds include transformed leash endpoints', () => {
  const bounds=drawBounds([{line:{from:[0,0],to:[300,-200],width:2},matrix:[1,0,0,1,20,10]}]);
  assert.ok(bounds.x+bounds.width>=325);
  assert.ok(bounds.y<=-195);
});

const node=(tag,a={},v='',c=[])=>({tag,a,v,c});
const set=(name,v)=>node('Set',{name},String(v));
const definition = ({relative=false, enabled=true, count=2,total=3,offset='0,0',attachment}={}) => ({
  sprites:{p:{atlas:'particles.png',textureSize:'32',frame:'0,0'}},
  particles:[node('ParticleSystem',{name:'ps',updateStage:'Update',renderStage:'RenderInFront'},'',[
    node('Emitter',attachment?{attachment}:{},'',[set('enable',enabled),set('infLifeTime',true),set('emissionInterval',.033),set('particlesToEmit',total),set('particlesPerEmission',count),set('offset',offset)]),
    node('Particle',{},'',[set('sprite','p'),set('relativeToEmitter',relative),set('lifeTime',2),set('initialVelocity','0,0')])
  ])]
});
for(const folder of ['src','demo/engine']) {
  const {Script}=await import(`../${folder}/fx-engine.mjs`);
  const {XmlParticleLayer}=await import(`../${folder}/xml-particles.mjs`);
  const host={x:100,y:20,facing:1,vx:0,vy:0,onGround:true,action:'IDLE',target:[64,16]};
  test(`${folder}: XML particle counts, disabled emitters and relative offsets`,()=>{
    const s=new Script('test',definition(),()=>null);
    s.step(.033,host);s.step(.033,host);s.step(.033,host);
    assert.equal(s.systems[0].live.length,3);
    const off=new Script('off',definition({enabled:false}),()=>null);off.step(.033,host);
    assert.equal(off.systems[0].live.length,0);
    const rel=new Script('rel',definition({relative:true,offset:'10,0',count:1,total:1}),()=>null);rel.step(.033,host);
    assert.equal(rel.records(rel.systems[0],1)[0].X,10);
    assert.equal(rel.cond(node('IsVariableBool',{name:'unrecovered'},'false')),false);
  });
  test(`${folder}: world particle birth stays fixed through player movement, lift and turn`,()=>{
    const layer=new XmlParticleLayer({test:definition({count:1,total:1})});
    const item={id:1,raw:{script:'test'}};
    const motion={clockMs:0,x:0,y:0,worldX:100,worldY:20,facing:1,ground:true,vx:0,vy:0};
    const first=layer.step([item],motion,{}, {x:0,y:0},33)[0];
    const second=layer.step([item],{...motion,clockMs:33,worldX:120,facing:-1},{},{x:0,y:-5},33)[0];
    assert.equal(first.matrix[4]-second.matrix[4],20);
    assert.equal(first.matrix[5],second.matrix[5], 'bob does not move a world-born particle');
    assert.equal(first.matrix[0],second.matrix[0], 'birth facing survives owner turn');
  });
  test(`${folder}: relative hand particles rotate about the same arm anchor`,()=>{
    const s=new Script('hand',definition({relative:true,attachment:'handspotRoot',offset:'10,0',count:1,total:1}),()=>null);
    s.step(.033,{...host,arm2:90});
    const r=s.records(s.systems[0],1)[0];
    assert.ok(Math.abs(r.X+7)<1e-8);
    assert.ok(Math.abs(r.Y+4)<1e-8);
  });
  test(`${folder}: long-lived effects obey per-system budgets`,()=>{
    const s=new Script('bounded',definition({count:512,total:0}),()=>null);
    for(let i=0;i<70;i++)s.step(.033,host);
    assert.ok(s.systems[0].live.length<=512);
    assert.ok(s.systems[0].live.length>0);
  });
}
