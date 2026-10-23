from pathlib import Path
import json, sys
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/growtopia-xml-renderer-library')
data=json.loads((OUT/'manifest/representative-renderers.json').read_text())
by_name={x['name']:x for x in data}
names=['EclipseWings','WingsOfInfinity','CrepeCape','RoseCape','14DEViLsFriendlyDoggyLeash','XenososNebulafinLeash','SpringLoadedShoes','DiamondSparklingSneakers','AnomalyAura','DirtAura','StarryAura','InfinityAura','PlayerBladeSlash']
def short(v, maxlen=250):
    s=json.dumps(v,ensure_ascii=False,separators=(',',':'))
    return s if len(s)<=maxlen else s[:maxlen-3]+'...'
lines=['# Frame-by-frame XML Renderer Timing Report','',
       'Source: the attached `player stuff.zip` archive. All cells and conditions below are extracted from those XML files. Timing boundaries are the converter/current Render Lab interpretation, not proof that the original client schedules them identically.','',
       '## Interpretation rules used for the timelines','',
       '- A `SpriteAnimation` with N explicit frames and numeric total `animTime=D` is displayed in this report as N equal intervals of D/N milliseconds.','- When `animTime` is absent, this report uses the planner fallback `175 ms × N` (the value from `items.json`); this is an implementation assumption.','- State-gated tracks use the time since the state was entered; the active track selection, exit behavior, and transition timing need exact host/state-machine semantics.','- A missing `isLoop` flag is recorded as unspecified; it is not silently promoted to a verified looping behavior.','- Curve keyframes use the source value vectors. Normalized time is converted to milliseconds using the track duration only where the data make that duration explicit.','',
       '## Archive scope','',
       '- 314 item renderer XML files and 33 world/effect renderer XML files are present (347 total).','- 1,426 top-level animation-track entries, 4,095 explicit `SpriteAnimation` frame entries, 3,520 `KeyFrame` nodes and 921 item particle-system definitions are recorded in the bundle-level manifest. (Definitions and node totals are source-derived; timeline behavior is interpreter-dependent.)','- No Pickaxe-named XML and no Slippers-named XML are present in this archive. The index mentions 14 weather renderers, but those XML files are absent from the ZIP.','']
for name in names:
    x=by_name.get(name)
    if not x: continue
    c=x['counts']
    lines += [f'## {name}', '', f'- Source: `{x["sourcePath"]}`; family classification: `{x["family"]}` (heuristic).',
              f'- Structure: {c["sprites"]} sprite names / {c["spriteDefinitions"]} definitions; {c["animationTracks"]} top-level animation tracks; {c["spriteFrames"]} direct sprite frames; {c["stateMachines"]} state machines / {c["states"]} states / {c["transitions"]} transitions; {c["particleSystems"]} particle systems.', '']
    if x.get('matchingItems'):
        rows=x['matchingItems'][:20]
        lines.append('- Catalog matches: '+ '; '.join(f"#{m.get('id')} {m.get('name')} (slot {m.get('slotName') or m.get('slot')})" for m in rows)+(' …' if len(x['matchingItems'])>20 else '')+'.')
        lines.append('')
    lines += ['### Sprite definitions','', '| Sprite | Atlas | Cell size | Default cell |','|---|---|---:|---|']
    for s in x.get('sprites',[]):
        lines.append(f"| `{s.get('name','')}` | `{s.get('sourceTexture') or s.get('atlas','')}` | {s.get('textureSize','')} | `{s.get('frame','')}` |")
    lines += ['', '### Animation tracks and frame sequence','']
    tracks=x.get('timeline',[])
    if not tracks:
        lines += ['No top-level tracks were extracted for this renderer.','']
    for t in tracks:
        attr=t.get('attributes',{})
        dur=t.get('durationMs')
        dur_note=f"{dur:g} ms total" if isinstance(dur,(int,float)) else 'duration not resolved'
        src=t.get('durationSource')
        if src=='frameMsDefault': dur_note += ' (175 ms/frame fallback)'
        details=[f"type `{t.get('tag')}`", f"sprite `{t.get('sprite')}`" if t.get('sprite') else None,
                 f"state `{t.get('playOnState')}`" if t.get('playOnState') else None,
                 f"action `{t.get('playOnAction')}`" if t.get('playOnAction') else None,
                 f"loop `{t.get('loop')}`" if t.get('loop') is not None else 'loop unspecified', dur_note]
        lines.append(f"**{t.get('name') or '(unnamed track)'}** — "+'; '.join(d for d in details if d)+'.')
        frames=t.get('frames',[])
        if frames:
            for f in frames:
                lines.append(f"  - Frame {f['index']}: cell `{f['cell']}` from {f['startMs']:g} to {f['endMs']:g} ms; interval {f['durationMs']:g} ms.")
        keys=t.get('keyframes',[])
        if keys:
            lines.append('  - Keyframes: '+ '; '.join(f"t={k.get('time')}: {k.get('values')}" for k in keys)+'.')
        if not frames and not keys:
            lines.append(f"  - No direct frame cells/keyframes on this node. Attributes: `{short(attr,180)}`.")
    lines += ['', '### State machines','']
    if not x.get('stateMachines'):
        lines.append('No state machines recorded.')
    for m in x.get('stateMachines',[]):
        st=', '.join(s.get('name','?') for s in m.get('states',[]))
        lines.append(f"**{m.get('name')}** (initial `{m.get('initialState')}`): {st or 'no states listed'}.")
        for tr in m.get('transitions',[]):
            cond=short(tr.get('condition'),220)
            lines.append(f"  - `{('|'.join(tr.get('from',[])))}` → `{tr.get('to')}`; condition: `{cond}`")
    lines += ['', '### Particle systems','']
    if not x.get('particleSystems'): lines.append('No particle systems recorded.')
    for p in x.get('particleSystems',[]):
        lines.append(f"**{p.get('name')}** — update stage `{p.get('attributes',{}).get('updateStage','(unspecified)')}`; emitter: `{short(p.get('emitterSets',{}),300)}`; particle: `{short(p.get('particleSets',{}),350)}`.")
        for field in ('emitterCurves','particleCurves'):
            if p.get(field): lines.append(f"  - {field}: `{short(p[field],450)}`")
    lines += ['', '### Render hooks and draw order','']
    if not x.get('renderPasses'): lines.append('No render hooks recorded.')
    for hook in x.get('renderPasses',[]):
        sprites=', '.join(f"{z.get('name')} @ {z.get('offset','(offset unspecified)')}" for z in hook.get('spriteRenders',[])) or 'no direct SpriteRender'
        particles=', '.join(f"{z.get('name') or z.get('type')}"+(f" when {z.get('onState')}" if z.get('onState') else '') for z in hook.get('particleOperations',[])) or 'no direct particle operation'
        lines.append(f"- `{hook.get('hook')}`: sprites — {sprites}; particles — {particles}.")
    lines += ['', '### Reuse rule','']
    if 'Wings' in name: msg='copy only after matching each split sprite, mirror rule, state track, pass, and separate per-side particle emitter; preserve the movement-state machine.'
    elif 'Cape' in name: msg='keep cape body, collar/front layer, and movement trail separate. Reuse the idle/walk/jump/fall tracks only where target frames and cells are verified.'
    elif 'Leash' in name: msg='pet motion states and leash/player layers are not one animation. Map the pet host variables and `RenderPet` / `UpdatePet` / `UpdatePunch` hooks explicitly.'
    elif 'Shoes' in name: msg='this renderer contains pose/lift curves; do not reuse its curves for ordinary footwear unless the target item has the same foot/lift behavior.'
    elif 'Aura' in name: msg='keep front and behind hooks independent, match state variant rows, and map hit/punch event emitters separately.'
    else: msg='preserve renderer-specific state, pass, animation, and attachment logic; name similarity alone is not evidence of compatibility.'
    lines += [msg, '']
lines += ['## Reuse implementation checklist','',
          '1. Pick a source module from `renderer-modules/item/` and load it via `renderer-modules/registry.mjs`.','2. Verify the destination atlas source, texture cell size, default cell, animation frame cells, mirroring and target item slot against source captures.','3. Create a clone with `templates/renderer-adapter.mjs`; set `spriteAliases` source→target, `atlasAliases`, `frameOverrides`, and `trackFrames` by animation track name only where the target sheet was checked.','4. Alter offset/pass/timing only from evidence. Different state graphs, input events, lift/pose behavior, or particle lifetimes call for a new rule module, not simple renaming.','5. Wire cloned renderer as `catalog.renderers[newScriptName]` and set the destination item record’s `script` to that exact key. `normalizeCatalogItem` then attempts strict sprite binding by atlas, dimensions and source frame-cell match.','6. Add a fixture for at least idle, walk, jump, fall, punch, and any unique special input. Compare frame by frame; log unsupported XML operations rather than silently discarding them.','',
          '## Accuracy boundary','',
          'The modules preserve authored XML but are not a replacement for all native renderer execution. Timing rows are explicit calculations under the stated planner assumptions. Operation nodes outside the supported interpreter subset remain data until that operation is implemented and tested. This report does not claim a verified live-game pixel match.','']
(OUT/'ANIMATION_TIMING_REPORT.md').write_text('\n'.join(lines),encoding='utf-8')
print('wrote',OUT/'ANIMATION_TIMING_REPORT.md','lines',len(lines))
