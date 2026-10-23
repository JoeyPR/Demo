import zipfile, xml.etree.ElementTree as ET, json, os, re, csv, shutil, math, collections, statistics, pathlib, textwrap
SRC=os.path.abspath(os.sys.argv[1]) if len(os.sys.argv)>1 else '/mnt/data/player stuff.zip'
OUT=pathlib.Path(os.sys.argv[2]) if len(os.sys.argv)>2 else pathlib.Path('/mnt/data/growtopia-xml-renderer-library')
if OUT.exists(): shutil.rmtree(OUT)
for d in ['renderer-modules/item','renderer-modules/world','source-xml/ItemRenderers','source-xml/WorldRenderers','manifest','templates','runtime','examples','tools']:
    (OUT/d).mkdir(parents=True,exist_ok=True)
z=zipfile.ZipFile(SRC)
xml_paths=[n for n in z.namelist() if n.lower().endswith('.xml') and n.split('/')[0] in ('ItemRenderers','WorldRenderers')]
items_data=json.loads(z.read('items.json'))
script_items=collections.defaultdict(list)
for it in items_data.get('items',[]):
    if it.get('script'):
        script_items[it['script']].append({k:it.get(k) for k in ['id','name','slot','slotName']})

def parse_root(raw):
    try:
        return ET.fromstring(raw)
    except ET.ParseError as first_error:
        # The archive explicitly documents four files with duplicate identical attributes;
        # collapse identical repeats only for analysis. Their original bytes are preserved.
        text = raw.decode('utf-8')
        repair_rows = set()
        try:
            repair_rows = {row.split(',')[0] for row in z.read('renderer_parse_repairs.csv').decode('utf-8').splitlines()[1:]}
        except Exception:
            pass
        # Apply only if source path is one of the known repair rows; caller sets _current_xml_path.
        if _current_xml_path not in repair_rows:
            raise first_error
        import re
        def fix_tag(match):
            tag = match.group(0)
            seen = {}
            def fix_attr(m):
                key, value = m.group(1), m.group(2)
                if key in seen and seen[key] == value:
                    return ''
                seen[key] = value
                return m.group(0)
            return re.sub(r'\s+([A-Za-z_][A-Za-z0-9_.:-]*)="([^"]*)"', fix_attr, tag)
        repaired = re.sub(r'<[^<>]+>', fix_tag, text)
        return ET.fromstring(repaired)

def stext(el): return (el.text or '').strip()
def to_ir(el):
    n={'tag':el.tag}
    if el.attrib: n['a']=dict(el.attrib)
    txt=stext(el)
    if txt: n['v']=txt
    kids=list(el)
    if kids: n['c']=[to_ir(k) for k in kids]
    return n

def descendants(el):
    for x in el.iter(): yield x

def get_child(el,tag):
    return next((c for c in list(el) if c.tag==tag),None)
def get_desc(el,tag): return [x for x in el.iter() if x is not el and x.tag==tag]
def to_numlist(s):
    try:return [float(v.strip()) for v in str(s or '').split(',')]
    except:return []
def intish(x): return int(x) if float(x).is_integer() else float(x)
def norm_atlas(path):
    base=str(path or '').split('/')[-1]
    if base.endswith('.rttex'): base=base[:-6]+'.png'
    return base

def family_for(name, xmlroot, cat):
    n=name.lower()
    if cat=='WorldRenderers': return 'world-effect-projectile-or-stamp'
    if 'aura' in n or n in {'swiftpiesauramantle','astralaurablackcat'}: return 'aura'
    if 'leash' in n: return 'leash-or-companion-control'
    if any(k in n for k in ['wing','wings']): return 'wings'
    if 'cape' in n or 'cloak' in n or 'mantle' in n: return 'cape-cloak-mantle'
    if any(k in n for k in ['shoe','slipper','sneaker','boot','sandal']): return 'footwear'
    if 'pet' in n or 'doggy' in n or 'littlepartner' in n: return 'pet-or-companion'
    if any(k in n for k in ['mount','riding','bike','bicycle','carriage','scooter','surfboard','cart','truck','vehicle','wheels','paraglider','cropduster','glider']): return 'mount-or-vehicle'
    if any(k in n for k in ['cannon','gun','zooka','blaster','minigun','bow','boomerang','whip','staff','wand','sword','spear','dagger','nunchuck','mace','lance','katana','axe','pickaxe','mallet','hammer','scythe','blade','knives','gauntlet','claw','fist','guitar','drumstick','flipper','stick']): return 'held-weapon-or-tool'
    if any(k in n for k in ['hat','crown','helmet','circlet','visor','goggle','hood','hair','mask','bandana']): return 'headwear-or-hair'
    tags={x.tag for x in xmlroot.iter()}
    if 'ParticleSystems' in tags and len([x for x in xmlroot.iter() if x.tag=='ParticleSystem'])>=2: return 'particle-heavy-special-effect'
    if any(k in n for k in ['shirt','armor','bod','chestplate','trousers','pants','dress','robe','suit','tattoo','glove','gloves','belt','tail']): return 'body-clothing'
    if any(k in n for k in ['backpack','scarf','charm','pendant','amulet','locket']): return 'back-or-accessory'
    return 'specialized-item'

def node_payload(el): return to_ir(el)
def parse_timeline(ani):
    tag=ani.tag; a=ani.attrib
    frames=[stext(f) for f in list(ani) if f.tag=='Frame']
    frame_data=[]
    raw_duration=a.get('animTime')
    numeric_duration=bool(raw_duration and re.match(r'^-?[\d.]+$', raw_duration))
    duration=float(raw_duration) if numeric_duration else (len(frames)*items_data.get('frameMs',175) if frames else 1000)
    isloop=a.get('isLoop','false').lower()=='true'
    count=len(frames)
    if count:
        dt=duration/count
        for i,frame in enumerate(frames):
            vals=to_numlist(frame)
            frame_data.append({'index':i,'cell':[intish(x) for x in vals], 'startMs':round(i*dt,4),'endMs':round((i+1)*dt,4),'durationMs':round(dt,4)})
    keyframes=[]
    for k in [x for x in ani.iter() if x.tag=='KeyFrame']:
        vals=to_numlist(stext(k))
        if vals: keyframes.append({'time':vals[0], 'value':[intish(v) for v in vals[1:]]})
    dur=a.get('animTime')
    return {'name':a.get('name'), 'tag':tag, 'sprite':a.get('sprite'), 'durationMs':float(dur) if dur and re.match(r'^-?[\d.]+$',dur) else (duration if count else None),
        'durationSource':('animTime' if numeric_duration else ('symbolicAnimTime' if dur else ('frameMsDefault' if count else 'unspecified'))) , 'loop':isloop if 'isLoop' in a else None,
        'playOnState':a.get('playOnState'),'playOnAction':a.get('playOnAction'),'onAction':a.get('onAction'), 'attributes':a,
        'frames':frame_data,'keyframes':keyframes,'descendantKeyFrameCount':len([x for x in ani.iter() if x.tag=='KeyFrame'])}

def set_values(parent):
    out={}
    if parent is None:return out
    for el in parent.iter():
        if el.tag=='Set' and el.attrib.get('name'):
            out.setdefault(el.attrib['name'],[]).append(stext(el))
    return {k:(v[0] if len(v)==1 else v) for k,v in out.items()}

def state_machines(data):
    out=[]
    wrap=get_child(data,'StateMachines') if data is not None else None
    if wrap is None:return out
    for m in get_desc(wrap,'StateMachine'):
        states_wrap=get_child(m,'States'); trans_wrap=get_child(m,'Transitions')
        states=[]
        if states_wrap is not None:
            for st in get_desc(states_wrap,'State'):
                states.append({'name':st.attrib.get('name'),'attributes':dict(st.attrib),'onEnter': [to_ir(x) for x in list(st)]})
        transitions=[]
        if trans_wrap is not None:
            for t in get_desc(trans_wrap,'Transition'):
                transitions.append({'from':t.attrib.get('from','').split('|') if t.attrib.get('from') else [],'to':t.attrib.get('to'), 'condition':to_ir(get_child(t,'Condition')) if get_child(t,'Condition') is not None else None,'attributes':dict(t.attrib)})
        out.append({'name':m.attrib.get('name'), 'attributes':dict(m.attrib),'states':states,'initialState':states[0]['name'] if states else None,'transitions':transitions})
    return out

def render_rules(root):
    rr=get_child(root,'RenderRules')
    hooks=[]
    if rr is None:return hooks
    for hook in list(rr):
        sprites=[]; particle_names=[]; rule_tags=collections.Counter()
        for el in hook.iter():
            rule_tags[el.tag]+=1
            if el.tag=='SpriteRender': sprites.append(dict(el.attrib))
            if el.tag.startswith('ParticleSystem'): particle_names.append(dict(el.attrib))
        hooks.append({'hook':hook.tag,'attributes':dict(hook.attrib),'spriteRenders':sprites,'particleOperations':particle_names,'tagCounts':dict(rule_tags),'tree':to_ir(hook)})
    return hooks

def particle_info(data):
    out=[]
    wrap=get_child(data,'ParticleSystems') if data is not None else None
    if wrap is None:return out
    for p in get_desc(wrap,'ParticleSystem'):
        em=get_child(p,'Emitter'); pt=get_child(p,'Particle')
        out.append({'name':p.attrib.get('name'),'attributes':dict(p.attrib),'emitterAttributes':dict(em.attrib) if em is not None else {},'emitterSets':set_values(em),'particleAttributes':dict(pt.attrib) if pt is not None else {},'particleSets':set_values(pt),'emitterCurves':[to_ir(x) for x in list(em or []) if x.tag=='Curve'] if em is not None else [], 'particleCurves':[to_ir(x) for x in list(pt or []) if x.tag=='Curve'] if pt is not None else []})
    return out

def duration_types(root):
    vals=collections.defaultdict(list)
    for el in root.iter():
        if 'Animation' in el.tag and 'animTime' in el.attrib:
            try: vals[el.tag].append(float(el.attrib['animTime']))
            except: pass
    out={}
    for k,v in vals.items():
        out[k]={'count':len(v),'minMs':min(v),'medianMs':statistics.median(v),'maxMs':max(v)}
    return out

summaries=[]
_current_xml_path = None
for path in xml_paths:
    raw=z.read(path); _current_xml_path = path; root=parse_root(raw)
    cat=path.split('/')[0]; name=path.rsplit('/',1)[-1][:-4]; data=get_child(root,'Data')
    data_sprites=[e for e in (data.iter() if data is not None else []) if e.tag=='Sprite']
    sprites={}
    sprite_defs=[]
    for s in data_sprites:
        a=dict(s.attrib); file=a.get('fileName',''); tex=a.get('textureSize','32,32')
        compiled={'atlas':norm_atlas(file),'sourceFileName':file,'textureSize':tex,'frame':a.get('frame','0,0')}
        if a.get('name'): sprites[a['name']]=compiled
        sprite_defs.append({'name':a.get('name'),'sourceTexture':file,'atlas':norm_atlas(file),'textureSize':tex,'frame':a.get('frame','0,0')})
    rules=get_child(root,'RenderRules')
    anim_wrap=get_child(data,'Animations') if data is not None else None
    animation_nodes=[e for e in (anim_wrap.iter() if anim_wrap is not None else []) if e is not anim_wrap and 'Animation' in e.tag]
    top_animation_nodes=[e for e in list(anim_wrap or []) if 'Animation' in e.tag] if anim_wrap is not None else []
    animations=[to_ir(e) for e in animation_nodes]
    timeline_nodes=[parse_timeline(e) for e in animation_nodes]
    timeline=[parse_timeline(e) for e in top_animation_nodes]
    particles=particle_info(data)
    machines=state_machines(data)
    variable_map=to_ir(get_child(data,'VariableMap')) if data is not None and get_child(data,'VariableMap') is not None else None
    hooks=render_rules(root)
    family=family_for(name,root,cat)
    matched=script_items.get(name,[])
    counter=collections.Counter(e.tag for e in root.iter())
    keyframes=sum(1 for e in root.iter() if e.tag=='KeyFrame')
    frames=sum(1 for e in root.iter() if e.tag=='Frame')
    tags_with_time=duration_types(root)
    src_tree=to_ir(root)
    # Shape used by the existing JS XML renderer interpreter, plus intact full tree.
    compiled={
        '_meta':{'name':name,'category':cat,'sourceXml':path,'family':family,'matchingItems':matched,'sourceSha256':__import__('hashlib').sha256(raw).hexdigest(),'runtimeNote':'Compiled from uploaded XML; this preserves source values but does not imply every XML operation is implemented by the current planner runtime.'},
        'sprites':sprites,
        'rules':to_ir(rules) if rules is not None else {'tag':'RenderRules','c':[]},
        'animations':animations,
        'particles':[to_ir(p) for p in (get_desc(get_child(data,'ParticleSystems'),'ParticleSystem') if data is not None and get_child(data,'ParticleSystems') is not None else [])],
        'machines':[to_ir(m) for m in (get_desc(get_child(data,'StateMachines'),'StateMachine') if data is not None and get_child(data,'StateMachines') is not None else [])],
        'variableMap':variable_map,
        'renderOptions':to_ir(get_child(data,'RenderOptions')) if data is not None and get_child(data,'RenderOptions') is not None else None,
        'renderData':to_ir(data) if data is not None else None,
        'sourceTree':src_tree
    }
    safe=re.sub(r'[^A-Za-z0-9_$.-]+','_',name)
    sub='item' if cat=='ItemRenderers' else 'world'
    modpath=OUT/f'renderer-modules/{sub}/{safe}.mjs'
    # readable output with full tree plus an ES module export; generated data is inert until runtime consumes it
    modpath.write_text('/** Generated from '+path+'. Original XML hash: '+compiled['_meta']['sourceSha256']+'. See README for interpreter limitations. */\nexport const renderer = '+json.dumps(compiled,ensure_ascii=False,indent=2)+';\nexport default renderer;\n',encoding='utf-8')
    # keep exact original XML copy for easy diff / traceability
    (OUT/'source-xml'/cat/(name+'.xml')).write_bytes(raw)
    item_sprite_renders=sum(len(h['spriteRenders']) for h in hooks)
    summary={'category':cat,'name':name,'sourcePath':path,'family':family,'matchingItems':matched,
      'counts':{'sprites':len(sprites),'spriteDefinitions':len(sprite_defs),'animationTracks':len(top_animation_nodes),'animationNodes':len(animation_nodes),'spriteFrames':sum(len(x['frames']) for x in timeline_nodes if x['tag']=='SpriteAnimation'),'allFrameNodes':frames,'keyframes':keyframes,'particleSystems':len(particles),'particleRenderNodes':sum(len(h['particleOperations']) for h in hooks),'stateMachines':len(machines),'states':sum(len(m['states']) for m in machines),'transitions':sum(len(m['transitions']) for m in machines)},
      'spriteDefinitions':sprite_defs,'animationTracks':timeline,'animationNodes':timeline_nodes,'stateMachines':machines,'particleSystems':particles,
      'renderPasses':[{'hook':h['hook'],'attributes':h['attributes'],'spriteRenders':h['spriteRenders'],'particleOperations':h['particleOperations'],'tagCounts':h['tagCounts']} for h in hooks],
      'tagCounts':dict(counter),'animationDurationStats':tags_with_time,'variableMap':variable_map}
    summaries.append(summary)

# Lookup inventory/index summary
summary_by_name={s['name']:s for s in summaries}
with (OUT/'manifest/renderer-index.csv').open('w',encoding='utf-8',newline='') as f:
    fields=['category','name','source_xml','family','matched_item_count','matched_items','slots','unique_sprite_names','sprite_definition_nodes','top_level_animation_tracks','all_animation_nodes','sprite_animation_frames','all_frame_nodes','keyframes','particle_systems','particle_render_nodes','state_machines','states','transitions','render_passes','anim_timing_ms']
    w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
    for s in summaries:
        c=s['counts']
        w.writerow({'category':s['category'],'name':s['name'],'source_xml':s['sourcePath'],'family':s['family'],'matched_item_count':len(s['matchingItems']),'matched_items':';'.join(f"{x['id']}:{x['name']}" for x in s['matchingItems']),'slots':';'.join(sorted({x.get('slotName') or '' for x in s['matchingItems']})),'unique_sprite_names':c['sprites'],'sprite_definition_nodes':c['spriteDefinitions'],'top_level_animation_tracks':c['animationTracks'],'all_animation_nodes':c['animationNodes'],'sprite_animation_frames':c['spriteFrames'],'all_frame_nodes':c['allFrameNodes'],'keyframes':c['keyframes'],'particle_systems':c['particleSystems'],'particle_render_nodes':c['particleRenderNodes'],'state_machines':c['stateMachines'],'states':c['states'],'transitions':c['transitions'],'render_passes':';'.join(h['hook'] for h in s['renderPasses']),'anim_timing_ms':json.dumps(s['animationDurationStats'],separators=(',',':'))})
(OUT/'manifest/renderers.json').write_text(json.dumps({'schemaVersion':1,'sourceArchive':'player stuff.zip','sourceDataVersion':items_data.get('version'),'baseFrameMs':items_data.get('frameMs'),'timingModel':'For each SpriteAnimation, if animTime exists it is treated by the current planner frame sampler as total duration divided evenly across explicit Frame children. If omitted, sampler fallback is frameMs × frame count (175 ms × count from items.json). This is a measured software interpretation, not proof of the original client timing behavior. Generic curves use KeyFrame first value as normalized time and remaining values as sampled value vector in the current interpreter.','renderers':summaries},ensure_ascii=False,indent=2),encoding='utf-8')

# Family matrix
family_groups=collections.defaultdict(list)
for s in summaries:
    family_groups[s['family']].append({'name':s['name'],'category':s['category'],'sourcePath':s['sourcePath'],'matchingItems':s['matchingItems'],'counts':s['counts']})
(OUT/'manifest/family-map.json').write_text(json.dumps({'families':family_groups,'importantAbsences':{'pickaxe':'No ItemRenderers XML whose filename matches pickaxe is present in the uploaded archive; do not claim a pickaxe template exists here.','slippers':'No renderer file name containing slipper exists in the archive. SpringLoadedShoes is the only shoes-named XML and DiamondSparklingSneakers is a separate sneaker-named renderer.','weather':'The uploaded ZIP has 347 XML files: 314 ItemRenderers and 33 WorldRenderers. inventory.json/index refers to 14 WeatherRenderers but there is no WeatherRenderers directory in the actual ZIP; those source files cannot be analyzed from this file.'}},ensure_ascii=False,indent=2),encoding='utf-8')

# Timeline helper for animation frames, curves and state condition tree. Readable template can consume exported renderer data.
(OUT/'runtime/sequence.mjs').write_text(r'''/**
 * Timeline helpers for the converted XML IR used in renderer-modules/*.mjs.
 * This intentionally handles simple sprite tracks and piecewise-linear curves only;
 * it does not claim to implement every native XML animation operation.
 */
const children = (node, tag) => (node?.c ?? []).filter(child => !tag || child.tag === tag);
const num = value => String(value ?? "").split(",").map(part => Number(part.trim()));
const bool = value => value === true || value === "true";
export function sampleSpriteTrack(renderer, spriteName, timeMs, stateSince = 0, stateName = null) {
  const tracks = (renderer.animations ?? []).filter(track => track.tag === "SpriteAnimation" && track.a?.sprite === spriteName);
  const active = tracks.filter(track => {
    if (!track.a?.playOnState) return true;
    return track.a.playOnState.split("|").some(spec => {
      const [machine, state] = spec.split(".");
      return stateName?.[machine] === state;
    });
  }).sort((a, b) => Number(!!b.a?.playOnState) - Number(!!a.a?.playOnState));
  const track = active[0];
  if (!track) return null;
  const frames = children(track, "Frame").map(frame => num(frame.v));
  if (!frames.length) return null;
  const duration = Math.max(1, Number(track.a.animTime) || frames.length * 175);
  const elapsed = Math.max(0, timeMs - stateSince);
  const loop = bool(track.a.isLoop);
  const progress = loop ? (elapsed % duration) / duration : Math.min(0.999999999, elapsed / duration);
  const frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  return { sprite: spriteName, track: track.a.name, frameIndex, cell: frames[frameIndex], elapsedMs: elapsed, durationMs: duration, frameDurationMs: duration / frames.length, loop };
}
export function sampleCurve(curve, normalizedTime) {
  const frames = children(curve, "KeyFrame").map(frame => num(frame.v)).filter(frame => frame.length >= 2).sort((a,b) => a[0]-b[0]);
  if (!frames.length) return null;
  const t = Math.max(frames[0][0], Math.min(frames.at(-1)[0], normalizedTime));
  if (t <= frames[0][0]) return frames[0].slice(1);
  if (t >= frames.at(-1)[0]) return frames.at(-1).slice(1);
  let right = frames.findIndex(frame => frame[0] > t);
  const left = frames[right-1], next = frames[right], span = next[0] - left[0];
  const f = span === 0 ? 0 : (t-left[0])/span;
  return left.slice(1).map((value,i) => value + ((next[i+1] ?? value)-value)*f);
}
export function inspectRenderer(renderer) {
  return {
    name: renderer._meta?.name,
    family: renderer._meta?.family,
    sprites: Object.keys(renderer.sprites ?? {}),
    tracks: (renderer.animations ?? []).filter(track => track.tag?.includes("Animation")).map(track => ({ name:track.a?.name, type:track.tag, sprite:track.a?.sprite, playOnState:track.a?.playOnState, durationMs:Number(track.a?.animTime)||null, loop:track.a?.isLoop ?? null, frames:children(track,"Frame").map(f=>f.v) })),
    machines: (renderer.machines ?? []).map(machine => ({name:machine.a?.name, states:children(children(machine,"States")[0],"State").map(state=>state.a?.name), transitions:children(children(machine,"Transitions")[0],"Transition").map(t=>({from:t.a?.from,to:t.a?.to,condition:children(t,"Condition")[0]??null}))})),
    particleSystems: (renderer.particles ?? []).map(system => ({name:system.a?.name, updateStage:system.a?.updateStage, renderStage:system.a?.renderStage}))
  };
}
''',encoding='utf-8')

# Adapter templates show safe reuse through explicit aliases rather than falsifying compatibility.
(OUT/'templates/renderer-adapter.mjs').write_text(r'''/**
 * Clone an existing renderer definition for a related item.
 *
 * spriteAliases maps SOURCE sprite name -> TARGET sprite name.
 * atlasAliases maps normalized source atlas name -> target atlas name.
 * frameOverrides sets a target sprite's default cell; trackFrames maps an
 * animation track name to an explicit replacement cell list, preserving order.
 * Confirm target atlas cells and frame order before using any adaptation.
 */
export function createRendererAdapter(baseRenderer, {
  name,
  family = baseRenderer?._meta?.family,
  spriteAliases = {},
  atlasAliases = {},
  frameOverrides = {},
  trackFrames = {},
  timingScale = 1,
  offset = [0, 0],
  passOverrides = {},
  matchingItems = []
} = {}) {
  if (!baseRenderer) throw new TypeError("baseRenderer is required");
  if (!(timingScale > 0) || !Number.isFinite(timingScale)) {
    throw new RangeError("timingScale must be finite and > 0");
  }
  if (!Array.isArray(offset) || offset.length < 2 || !offset.slice(0, 2).every(Number.isFinite)) {
    throw new TypeError("offset must be [x, y] with finite numbers");
  }

  const renderer = structuredClone(baseRenderer);
  renderer._meta = {
    ...renderer._meta,
    name: name ?? ((baseRenderer._meta?.name ?? "Renderer") + "Adapter"),
    family,
    adaptedFrom: baseRenderer._meta?.name,
    matchingItems,
    adapter: { spriteAliases, atlasAliases, frameOverrides, trackFrames, timingScale, offset, passOverrides }
  };

  const aliases = {};
  for (const [sourceName, targetName] of Object.entries(spriteAliases)) {
    const def = renderer.sprites?.[sourceName];
    if (!def) throw new Error("Unknown source sprite: " + sourceName);
    aliases[targetName] = {
      ...structuredClone(def),
      atlas: atlasAliases[def.atlas] ?? def.atlas,
      frame: frameOverrides[targetName] ?? def.frame
    };
  }
  for (const def of Object.values(renderer.sprites ?? {})) {
    def.atlas = atlasAliases[def.atlas] ?? def.atlas;
  }
  renderer.sprites = { ...renderer.sprites, ...aliases };

  const remap = sourceName => spriteAliases[sourceName] ?? sourceName;
  for (const track of renderer.animations ?? []) {
    if (track.a?.sprite) track.a.sprite = remap(track.a.sprite);
    if (track.a?.animTime && Number.isFinite(Number(track.a.animTime))) {
      track.a.animTime = String(Number(track.a.animTime) * timingScale);
    }
    const requestedFrames = track.a?.name ? trackFrames[track.a.name] : null;
    if (requestedFrames) {
      const frameNodes = (track.c ?? []).filter(child => child.tag === "Frame");
      if (frameNodes.length !== requestedFrames.length) {
        throw new Error("Track " + track.a.name + " expects " + frameNodes.length +
          " Frame nodes but trackFrames supplied " + requestedFrames.length);
      }
      frameNodes.forEach((node, index) => {
        const cell = requestedFrames[index];
        if (!Array.isArray(cell) || cell.length < 2 || !cell.slice(0, 2).every(Number.isFinite)) {
          throw new TypeError("trackFrames cell must be [x, y] for track " + track.a.name);
        }
        node.v = String(cell[0]) + "," + String(cell[1]);
      });
    }
  }

  const rules = renderer.rules;
  for (const hook of rules?.c ?? []) {
    if (passOverrides[hook.tag]) hook.tag = passOverrides[hook.tag];
    walkVisualNodes(hook, remap, offset);
  }

  // Particle positions are authored on emitters, separately from SpriteRender offsets.
  if (offset[0] !== 0 || offset[1] !== 0) {
    for (const system of renderer.particles ?? []) {
      const emitter = (system.c ?? []).find(child => child.tag === "Emitter");
      if (!emitter) continue;
      let offsetSet = (emitter.c ?? []).find(child => child.tag === "Set" && child.a?.name === "offset");
      if (!offsetSet) {
        offsetSet = { tag: "Set", a: { name: "offset" }, v: "0,0" };
        emitter.c = [...(emitter.c ?? []), offsetSet];
      }
      const xy = String(offsetSet.v ?? "0,0").split(",").map(Number);
      if (xy.length >= 2 && xy.slice(0, 2).every(Number.isFinite)) {
        offsetSet.v = String(xy[0] + offset[0]) + "," + String(xy[1] + offset[1]);
      }
    }
  }
  return renderer;
}

function walkVisualNodes(node, remap, offset) {
  if (!node) return;
  if (node.tag === "SpriteRender" && node.a) {
    if (node.a.name) node.a.name = remap(node.a.name);
    if (offset[0] !== 0 || offset[1] !== 0) {
      const xy = String(node.a.offset ?? "0,0").split(",").map(Number);
      if (xy.length >= 2 && xy.slice(0, 2).every(Number.isFinite)) {
        node.a.offset = String(xy[0] + offset[0]) + "," + String(xy[1] + offset[1]);
      }
    }
  }
  for (const child of node.c ?? []) walkVisualNodes(child, remap, offset);
}
''',encoding='utf-8')

# Generate registry with all modules as dynamic imports.
items_mods={s['name']:f"./item/{re.sub(r'[^A-Za-z0-9_$.-]+','_',s['name'])}.mjs" for s in summaries if s['category']=='ItemRenderers'}
world_mods={s['name']:f"./world/{re.sub(r'[^A-Za-z0-9_$.-]+','_',s['name'])}.mjs" for s in summaries if s['category']=='WorldRenderers'}
registry='/** Generated registry for all renderer modules converted from player stuff.zip. */\n'
registry+='export const itemRendererLoaders = {\n'+''.join(f'  {json.dumps(k)}: () => import({json.dumps(v)}),\n' for k,v in items_mods.items())+'};\n'
registry+='export const worldRendererLoaders = {\n'+''.join(f'  {json.dumps(k)}: () => import({json.dumps(v)}),\n' for k,v in world_mods.items())+'};\n'
registry+='export async function loadRenderer(name, category="item") { const table = category === "world" ? worldRendererLoaders : itemRendererLoaders; const load = table[name]; if (!load) return null; const mod = await load(); return mod.renderer ?? mod.default ?? null; }\n'
(OUT/'renderer-modules/registry.mjs').write_text(registry,encoding='utf-8')

# Representative detailed timeline report and copy recipes.
def get_s(name):return summary_by_name.get(name)
examples=[]
for n in ['EclipseWings','WingsOfInfinity','CrepeCape','RoseCape','14DEViLsFriendlyDoggyLeash','XenososNebulafinLeash','SpringLoadedShoes','DiamondSparklingSneakers','AnomalyAura','DirtAura','StarryAura','InfinityAura','PlayerBladeSlash']:
    s=get_s(n)
    if s:
        examples.append({'name':n,'category':s['category'],'family':s['family'],'sourcePath':s['sourcePath'],'matchingItems':s['matchingItems'],'counts':s['counts'],'sprites':s['spriteDefinitions'],'timeline':s['animationTracks'],'allAnimationNodes':s['animationNodes'],'stateMachines':s['stateMachines'],'particleSystems':s['particleSystems'],'renderPasses':s['renderPasses'],'tagCounts':s['tagCounts']})
(OUT/'manifest/representative-renderers.json').write_text(json.dumps(examples,ensure_ascii=False,indent=2),encoding='utf-8')

# Top-level reference of XML ops/tags and what current interpreter knows from source code review.
all_tags=collections.Counter()
for p in xml_paths:
    _current_xml_path = p; root=parse_root(z.read(p))
    all_tags.update(e.tag for e in root.iter())
(OUT/'manifest/tag-inventory.json').write_text(json.dumps({'counts':dict(all_tags.most_common()),'totalTagInstances':sum(all_tags.values()),'distinctTags':len(all_tags)},ensure_ascii=False,indent=2),encoding='utf-8')

# README
fam_count=collections.Counter(s['family'] for s in summaries if s['category']=='ItemRenderers')
item_s=[s for s in summaries if s['category']=='ItemRenderers']; world_s=[s for s in summaries if s['category']=='WorldRenderers']
track_sum=sum(s['counts']['animationTracks'] for s in item_s); frame_sum=sum(s['counts']['spriteFrames'] for s in item_s); key_sum=sum(s['counts']['keyframes'] for s in item_s); ps_sum=sum(s['counts']['particleSystems'] for s in item_s); spr_sum=sum(s['counts']['sprites'] for s in item_s); sprite_node_sum=sum(s['counts']['spriteDefinitions'] for s in item_s)
readme=f'''# Growtopia XML Renderer Library (source: `player stuff.zip`)

This bundle separates each XML renderer into a readable ES module and adds searchable frame/state/particle manifests. It is meant for reverse-engineering and for integration into the Render Lab, not a claim that every game-native operation has already been reproduced pixel-perfectly.

## Inventory

- **{len(item_s)} item renderer XMLs** and **{len(world_s)} world/effect renderer XMLs** present in the uploaded archive (347 total).
- Item renderer data has **{sprite_node_sum} `<Sprite>` definition nodes** across **{spr_sum} unique sprite-name keys**, **{track_sum} top-level animation-track elements** (across the XML animation types), **{frame_sum} explicit `SpriteAnimation` frame entries**, **{key_sum} total `KeyFrame` nodes**, and **{ps_sum} particle-system definitions**.
- The original XML files are copied, unmodified, into `source-xml/`.
- Each renderer module exports `renderer` and `default`. It contains the runtime-oriented fields (`sprites`, `rules`, `animations`, `particles`, `machines`) and an intact `sourceTree`/`renderData` representation for analysis. Attribute values remain strings because that's how XML encodes them; parse numeric fields at the point of use.
- Atlas names are normalized to `*.png` for the current browser demo's atlas loader. The original `fileName` is retained as `sourceFileName` and in `sourceTree` so this aliasing does not erase provenance.

## Files

- `renderer-modules/item/*.mjs`: one module per `ItemRenderers/*.xml`.
- `renderer-modules/world/*.mjs`: one module per `WorldRenderers/*.xml`.
- `renderer-modules/registry.mjs`: lazy import registry; call `loadRenderer(name, "item"|"world")`.
- `manifest/renderer-index.csv`: one row per renderer with family, matching catalog item IDs, sprite/frame/keyframe/particle counts, states, transitions and render-pass names.
- `manifest/renderers.json`: expanded data for every renderer, including per-track frame timelines, curve keyframes, state transitions, particle fields, sprite definitions, and hook summaries.
- `manifest/representative-renderers.json`: deeper inspectable extracts for Wings, Capes, Leashes, Shoes/Sneakers, Auras and a sample world effect.
- `templates/renderer-adapter.mjs`: safe cloning/reuse adapter with explicit alias, atlas, frame, offset, draw-pass and timing overrides.
- `runtime/sequence.mjs`: standalone helpers to sample sprite frame timelines and piecewise-linear curves.
- `source-xml/`: verbatim source XML copy.

## Runtime timing interpretation

For `SpriteAnimation`, the current Render Lab interpreter treats `animTime` as the total track duration and spreads the explicit `Frame` children evenly across that duration. If no `animTime` exists, the current code uses `175 ms × frame count` (the `frameMs` value in `items.json`). This yields an explicit frame-by-frame timeline in the manifest. For example, a four-frame loop with `animTime="200"` changes frames every **50 ms** under this interpretation; a 16-frame loop with `animTime="900"` changes every **56.25 ms**. This is what the existing interpreter computes, not independent proof of the official client's scheduling semantics.

Curves contain normalized keyframe times, e.g. `0`, `0.25`, `0.5`, `1`; the helper linearly interpolates the value vector between adjacent points, clamps before/after endpoints, and the current runtime uses the track's duration and loop flag to compute progress. Where XML curves use variables, named curves, nested sequences, or unsupported easing/actions, this archive preserves the definitions and marks them for implementation instead of silently flattening them to fake constants.

## Reuse templates — how to wire another item

### A. Exact same renderer behavior

The safest route is to map the new item to the same `script` name **only if** the item's sprites/atlas cells and its intended behavior are the same. The current Render Lab looks up `catalog.renderers[item.raw.script]`, binds a piece to a renderer sprite only when atlas, dimensions and a matching frame cell agree, runs the renderer state machines for the item's motion clock, then samples its animation and transforms. Merely changing `script` is not enough when the new item uses different texture cells.

### B. Same behavior, different sprite/atlas

Copy the nearest source module and create an adapter with an explicit `spriteAliases` map, `atlasAliases`, `frameOverrides`, per-track `trackFrames`, `offset`, optional `timingScale`, and `passOverrides`. This avoids mutating the source and makes every visual difference auditable. Use the shape in `templates/renderer-adapter.mjs` as a starting point; confirm that each target texture really contains the corresponding animation frames in the same order before relying on frame reuse.

### C. Same family, new rule set

Reuse only the behavior layer that actually matches:

- **Wings** — commonly use a back-pack render hook, separate left/right particle systems, animation states for idle/move/air, additive flares or trails. Keep sprite frame tracks separate from emitter tracks; one particle does not automatically mean one wing sprite.
- **Cape/cloak/mantle** — map body-anchored pieces to the backpack/back pass; often use `IDLE`, `WALK`, `JUMP`, and `FALL` state tracks, plus small movement trails. Preserve `animTime`, exact frame list, and the pass in front/behind player.
- **Leash/companion** — treat player-held leash art and pet sprite as separate layers/attachments; the state machines can have independent pet movement and punch states. Do not attach a pet to the hand or player root just because the renderer filename says “leash.”
- **Footwear** — shoes may modify feet/body offsets or use curves on lift and foot state, not simply cycle shoe cells. `SpringLoadedShoes` includes several `CurveAnimationFloat`/`CurveAnimationVec3` tracks keyed to `MotionY` and separate `No`, `Yes`, `Mannequin` states. A standard shoe renderer should not inherit pogo lift/foot motion by default.
- **Auras** — usually split behind-player and front-player layers and may render particle hooks on action/events. State may switch `ActiveType`, and sprite animation frame rows may encode different aura states. Avoid treating every aura as a single centered looping sprite.
- **Held weapon/tool** — preserve hand/arm attachment and punch-specific state/`UpdatePunch`/`Update` conditions. No `Pickaxe.xml` is present in this archive; you can use a structurally similar tool renderer only as a hypothesis, not as an observed pickaxe template.

## Known data gaps and cautions

- The archive's embedded `inventory.json` refers to 361 XML files including 14 WeatherRenderers, but the actual uploaded ZIP contains 347 XML files: 314 in `ItemRenderers/` and 33 in `WorldRenderers/`. There is no `WeatherRenderers/` folder in the uploaded ZIP, so the missing 14 source XMLs are not included or fabricated.
- No item renderer filename matching `Pickaxe` and no filename matching `Slippers` are present. `SpringLoadedShoes` and `DiamondSparklingSneakers` exist, but their implementation rules must not be generalized to missing source XMLs.
- Every module preserves every XML node. “Preserved” is not the same as “executed.” The Demo engine's interpreter is explicitly partial: it supports a selected subset of conditions, state transitions, sprite-frame tracks, `SpriteScaleAnimation`, `SpritePositionAnimation`, and a bounded set of particle emission behavior. XML nodes such as `SequenceAnimation`, interpolation/curve families, visibility/camera/context/outline hooks, render-object flags, native pet attachments, and other operations require specific implementation before they can be called functioning.
- Full native accuracy needs the matching original atlas assets, host variables/events, attachment matrices and exact pass semantics. The XML by itself often refers to `.rttex` source atlas names and assumes native engine state/context.

## Suggested implementation sequence

1. Use this manifest to select one renderer and inspect its `renderPasses`, `stateMachines`, `animationTracks`, and `particleSystems`.
2. Make the current runtime report which ops it executed and which it skipped for that renderer; do not hide unsupported operations.
3. Implement/test one node class with a fixture before enabling it for all renderers.
4. Compare captured idle/walk/jump/fall/punch timestamps against the source XML's computed sequence, then add event-sensitive cases.
5. Create adapter entries for similar items rather than altering the shared source renderer.

## Sanity checks

The generator parses each source XML successfully, copies it byte-for-byte, and creates one ES module per source file. It does not perform a live-game image comparison, and it does not assert that every track is supported by the existing browser runtime.
'''
(OUT/'README.md').write_text(readme,encoding='utf-8')

# One concise implementation guide specifically on timing and copy-by-family.
family_guide='''# Renderer Rule Templates and Wiring Guide\n\n## Shared rendering pipeline\n\n1. `Data/Sprite` defines a named sprite: texture/atlas, cell size (`textureSize`) and default atlas cell (`frame`).\n2. `Data/StateMachines/StateMachine` defines named states and `Transition` edges. Conditions are evaluated each simulation tick using host variables and item/player events. State entry time is the animation clock for tracks guarded by `playOnState`.\n3. `Data/Animations` contains independent tracks. `SpriteAnimation` selects a cell from an explicit `Frame` list. `CurveAnimation*` and `SpriteCurveAnimation` describe curves; they are not equivalent to an image frame loop. `SequenceAnimation` may sequence multiple timed child operations.\n4. `RenderRules` contains ordered hooks (e.g. `RenderBackpack`, `RenderShoes`, `RenderInFront`, `RenderBehind`, `Update`, `UpdatePunch`, `RenderPet`). Nested `StopIf` conditions and `Group`/`Translate` nodes control whether/where a draw op runs. The hook name is part of the draw pass.\n5. `Data/ParticleSystems/ParticleSystem` defines emitter timing/count/lifetime and particle sprite/motion/lifetime curves. A particle system becomes visible only when an appropriate `ParticleSystemRender` hook renders it; `ParticleSystemUpdate` controls simulation/update ownership. Emitter lifetime and individual particle lifetime are separate clocks.\n6. Host integration maps game-native variables/events (state, velocity, facing, jump, punch, hit tile, selfie, equipment/context) to planner inputs. Any absent host feature leaves its conditions unverified.\n\n## Frame timeline formulas\n\nFor a `SpriteAnimation` with N frames and total `animTime = D`, the current interpreter's frame step is `D/N`. For a looping track, elapsed time is `elapsed mod D`; for a non-looping track it clamps to the last frame. If `animTime` is absent, the current interpreter uses `175 ms × N` as fallback. For a track guarded by `playOnState="Machine.State"`, elapsed is time since that machine entered the requested state. Multiple tracks may target one sprite; state-guarded tracks take precedence over autoplay tracks.\n\nA curve's `KeyFrame` time is normalized, and the remaining comma-separated values form the sample vector. Sample between two keyframes by linear interpolation unless the source declares a different curve operation. A curve with values `0,1`, `0.5,0.2`, `1,0` goes from 1 to 0.2 during the first half, then from 0.2 to 0 during the second half.\n\n## Family templates\n\n### Wings / large back items\n\nExpected *pattern*, not a universal rule: sprites for body of wing plus optional flare/trail sprites; `RenderBackpack` or related hook; possibly `AddClothingParticles` and `RenderInFront`; state-dependent idle/move/jump/fall frame lists; particles split by side and layer. Keep item transform attached to the correct body root and mirror only if the XML does so. If XML sets orientation/facing context explicitly, don't add a second automatic flip.\n\n### Capes / cloaks / mantles\n\nUse back-facing sprite pass behind body, preserve collar and cape as separate named sprites when present, use independent state tracks for idle/walk/jump/fall. Extra shimmer particles may have their own frame loop and emitter; do not fold them into the cape's frame timeline.\n\n### Leash / pet\n\nTreat pet body, tether/player-facing attachment and punch sparkle as separate pieces. A pet can have its own `StateMachine` (idle/follow/run/jump), and the leash can depend on `UpdatePet`/`UpdatePunch`. Attach to the native pet anchor/hand anchor from the host model, not an arbitrary player center.\n\n### Shoes / slippers\n\nCheck both `RenderShoes` and update hooks. A renderer may animate the feet themselves, add scale/offset curves, or change the player lift; these are different behaviors. Reusing `SpringLoadedShoes` for an ordinary slipper would incorrectly apply its pogo offsets unless those tracks are removed or adapted. The uploaded archive contains no Slippers-specific XML.\n\n### Auras\n\nInspect `RenderBehind` and `RenderInFront` independently. Some split the aura into two layers, use state variants (e.g. light/dark/both), and emit hit/punch particles. The sprite row/cell layout is often part of the state selection. Keep event-specific emitters separate from ambient loops.\n\n### Held tools / pickaxe-like items\n\nPreserve `RenderHandItem`/hand attachment rules, arm matrix, facing, offset, and punch transitions. A new tool can inherit a nearby tool template only if the frame geometry and input/action rules match. The source archive has no Pickaxe-named renderer, so any pickaxe adaptation must be explicitly labelled inferred until verified.\n\n## Adapter template\n\n`templates/renderer-adapter.mjs` clones a source renderer to avoid mutating it and requires explicit sprite/atlas aliases. In practice, use aliases for every sprite whose name/cell differs, set a frame override only when the target atlas is verified, and adjust offset/pass/timing only after comparison to source captures. If two items differ in state graph or events, use a new renderer definition rather than only changing sprite names.\n'''
(OUT/'templates/RULE-TEMPLATES.md').write_text(family_guide,encoding='utf-8')

# Add tiny examples with actual source-derived frame timeline calculations.
for name in ['EclipseWings','CrepeCape','SpringLoadedShoes','AnomalyAura','14DEViLsFriendlyDoggyLeash']:
    s=summary_by_name.get(name)
    if not s: continue
    sample={'renderer':name,'family':s['family'],'source':s['sourcePath'],'sprites':s['spriteDefinitions'],'timeline':s['animationTracks'],'states':s['stateMachines'],'particleSystems':s['particleSystems'],'renderPasses':s['renderPasses']}
    (OUT/'examples'/(name+'.json')).write_text(json.dumps(sample,ensure_ascii=False,indent=2),encoding='utf-8')

# Executable smoke tests and the exact converter are kept in the bundle.
(OUT/'tools/smoke-test.mjs').write_text(r'''import { itemRendererLoaders, worldRendererLoaders, loadRenderer } from "../renderer-modules/registry.mjs";
import { sampleSpriteTrack, sampleCurve } from "../runtime/sequence.mjs";
import { createRendererAdapter } from "../templates/renderer-adapter.mjs";
import assert from "node:assert/strict";

let loaded = 0;
for (const [name, load] of Object.entries({ ...itemRendererLoaders, ...worldRendererLoaders })) {
  const mod = await load();
  const r = mod.renderer ?? mod.default;
  assert.equal(r._meta.name, name, `metadata name mismatch for ${name}`);
  assert.ok(r.sourceTree?.tag, `missing sourceTree for ${name}`);
  assert.ok(r.rules && Array.isArray(r.animations) && Array.isArray(r.particles) && Array.isArray(r.machines), `missing compiled fields for ${name}`);
  loaded++;
}
assert.equal(loaded, 347, "expected all 347 XML modules");

const cape = await loadRenderer("CrepeCape");
const sampled0 = sampleSpriteTrack(cape, "s_Cape", 0, 0, { Action: "JumpStraight" });
const sampled100 = sampleSpriteTrack(cape, "s_Cape", 100, 0, { Action: "JumpStraight" });
assert.deepEqual(sampled0.cell, [0,12]);
assert.deepEqual(sampled100.cell, [1,12]);

const shoes = await loadRenderer("SpringLoadedShoes");
const offsetTrack = shoes.animations.find(x => x.tag === "CurveAnimationFloat" && x.a?.name === "a_Offset");
const curve = offsetTrack?.c?.find(x => x.tag === "Curve");
assert.ok(curve, "SpringLoadedShoes offset curve missing");
assert.deepEqual(sampleCurve(curve, 0.5), [-18]);

const wings = await loadRenderer("EclipseWings");
const originalFrameList = wings.animations.find(x => x.a?.name === "a_wings").c.filter(x => x.tag === "Frame").map(x => x.v);
const adapted = createRendererAdapter(wings, {
  name: "EclipseWingsTestAdapter",
  spriteAliases: { s_wings: "s_altWings" },
  atlasAliases: { "particles_large17.png": "test-atlas.png" },
  frameOverrides: { s_altWings: "0,0" },
  trackFrames: { a_wings: [[0,0], [1,0], [2,0], [3,0]] },
  offset: [1,2],
  passOverrides: { RenderBackpack: "RenderInFront" }
});
assert.equal(adapted.sprites.s_altWings.atlas, "test-atlas.png");
assert.equal(adapted.sprites.s_altWings.frame, "0,0");
const track = adapted.animations.find(x => x.a?.name === "a_wings");
assert.equal(track.a.sprite, "s_altWings");
assert.deepEqual(track.c.filter(x => x.tag === "Frame").map(x => x.v), ["0,0", "1,0", "2,0", "3,0"]);
assert.deepEqual(wings.animations.find(x => x.a?.name === "a_wings").c.filter(x => x.tag === "Frame").map(x => x.v), originalFrameList, "adapter must not mutate base renderer");
assert.ok(adapted.rules.c.some(x => x.tag === "RenderInFront"));
const leftEmitter = adapted.particles.find(x => x.a?.name === "ps_wingsLeft")?.c.find(x => x.tag === "Emitter");
const emitterOffset = leftEmitter?.c.find(x => x.tag === "Set" && x.a?.name === "offset")?.v;
assert.equal(emitterOffset, "1,-14", "offset should apply to particle emitters too");

console.log(`OK: ${loaded} renderer modules imported; cape frame timing, shoe curve, and adapter sprite/track/atlas/pass/offset fixtures passed.`);
''',encoding='utf-8')
shutil.copy2(pathlib.Path(__file__).resolve(), OUT/'tools/generate_renderer_library.py')

# output top-level verification summary
summary={'archive':'player stuff.zip','sourceBytes':os.path.getsize(SRC),'xmlFiles':len(xml_paths),'itemRendererFiles':len(item_s),'worldRendererFiles':len(world_s),'itemUniqueSpriteNames':spr_sum,'itemSpriteDefinitionNodes':sum(s['counts']['spriteDefinitions'] for s in item_s),'itemAnimationTracks':track_sum,'itemExplicitSpriteFrames':frame_sum,'itemKeyFrameNodes':key_sum,'itemParticleSystems':ps_sum,'moduleFiles':len(xml_paths),'families':dict(fam_count),'weatherRendererXmlFilesActuallyPresent':sum(p.startswith('WeatherRenderers/') for p in z.namelist()),'xmlParseIssues':0}
(OUT/'manifest/summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
# Count files and size; create downloadable zip.
zip_path=pathlib.Path(str(OUT)+'.zip')
if zip_path.exists(): zip_path.unlink()
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as outzip:
    for f in sorted(OUT.rglob('*')):
        if f.is_file(): outzip.write(f, f.relative_to(OUT.parent))
print(json.dumps({**summary,'outputDir':str(OUT),'zipPath':str(zip_path),'zipBytes':zip_path.stat().st_size,'unpackedBytes':sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file()),'fileCount':sum(p.is_file() for p in OUT.rglob('*')),'sizeByFamily':dict(fam_count)},indent=2))
