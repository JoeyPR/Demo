"""Verify passive/live mode input and native-scale shadow rendering."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:9000'
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/preview-mode-check')
out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for mobile in [False,True]:
        context=browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},
                                    is_mobile=mobile,has_touch=mobile)
        page=context.new_page();errors=[];failed=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('console',lambda message:errors.append(message.text) if message.type=='error' else None)
        page.on('response',lambda response:failed.append(response.url) if response.status>=400 else None)
        page.goto(url,wait_until='networkidle');page.wait_for_function('window.plannerApp?.ready')
        assert not page.evaluate('P.previewMode.live')
        assert page.locator('#pad-left').is_hidden()
        assert page.locator('#dd-world-btn,#dd-background-btn').count()==0
        assert page.locator('#dd-land-btn,#dd-weather-btn').count()==2
        page.keyboard.down('d');page.keyboard.down('f');page.keyboard.press('Space')
        page.wait_for_timeout(180);page.keyboard.up('d');page.keyboard.up('f')
        assert page.evaluate('plannerApp.lastFrame.x===0&&plannerApp.lastFrame.y===0&&!plannerApp.lastFrame.punch')
        rect=page.locator('#pv').bounding_box();page.mouse.click(100,max(0,rect['y'])+100);page.wait_for_timeout(80)
        assert not page.evaluate('plannerApp.lastFrame.punch')
        close_zoom=page.evaluate('plannerApp.view.cameraZoom')
        page.get_by_role('button',name='Start Live Preview',exact=True).click()
        assert page.evaluate('P.previewMode.live')
        assert page.locator('#pad-left').is_visible()
        page.wait_for_function('z=>plannerApp.view.cameraZoom<z',arg=close_zoom)
        page.keyboard.down('d');page.wait_for_function('plannerApp.lastFrame.x>30');page.keyboard.up('d')
        page.keyboard.down('Space');page.wait_for_function('plannerApp.lastFrame.y<-5');page.keyboard.up('Space')
        page.keyboard.down('f');page.wait_for_function('!!plannerApp.lastFrame.punch');page.keyboard.up('f')
        page.wait_for_function('plannerApp.lastFrame.ground&&!plannerApp.lastFrame.punch')
        page.evaluate("P.emit('equip',592)")
        page.wait_for_function("plannerApp.lastResult.look.displayed.some(item=>item.id===592)")
        page.keyboard.down('d');page.wait_for_function("plannerApp.lastResult.poseResolution.state==='ridingmove'")
        page.keyboard.down('Space');page.wait_for_function("plannerApp.lastResult.poseResolution.state==='ridingair'")
        page.keyboard.up('Space');page.keyboard.down('f')
        page.wait_for_function("plannerApp.lastResult.poseResolution.state==='ridingpunch'&&plannerApp.lastResult.pose.face[0]===4")
        page.keyboard.up('f');page.keyboard.up('d')
        page.get_by_role('button',name='Return to Preview',exact=True).click()
        assert not page.evaluate('P.previewMode.live')
        assert page.evaluate('!P.input.left&&!P.input.right&&!P.input.jump&&!P.input.punch')
        page.evaluate("P.emit('equip',592)")
        page.wait_for_function('plannerApp.lastFrame.x===0&&plannerApp.lastFrame.y===0')
        # Render the real Buddy body shadow using the shared texture adapter.
        assert page.evaluate('''async()=>{
          const {PlannerPlayer}=await import('/demo/engine/player.mjs');
          const {drawCanvas}=await import('/demo/engine/render.mjs');
          const {registerAtlas}=await import('/demo/engine/canvas-assets.mjs');
          const {getPlayerShadowCalls,blackenShadowMask,PLAYER_VISUAL_SCALE}=await import('/js/player-shadow.mjs');
          const {WORLD_TILE_SIZE}=await import('/js/world-motion.mjs');
          if(PLAYER_VISUAL_SCALE!==1||WORLD_TILE_SIZE!==32)return false;
          const skin=GrowSkinColors.SKINS.find(skin=>skin.id==='buddy-legacy');
          const player=new PlannerPlayer({});
          const frame={x:0,y:0,vx:0,vy:0,facing:1,ground:true,clockMs:0,moveMs:0,locomotion:'idle',events:[]};
          const calls=getPlayerShadowCalls(player.step(frame,16,{skin:skin.rgb,skinPalette:skin.palette}).calls);
          const atlases=new Map();
          await Promise.all([...new Set(calls.map(call=>call.atlas))].map(async name=>{
            const image=new Image();image.src='/demo/assets/'+name;await image.decode();atlases.set(name,registerAtlas(image));
          }));
          const canvas=document.createElement('canvas');canvas.width=canvas.height=80;
          const c=canvas.getContext('2d');drawCanvas(c,calls,atlases,{tilePixels:64,camera:[-4,-4]});
          let pixels=c.getImageData(0,0,80,80).data;
          if(!pixels.some((v,i)=>i%4===3&&v>0))return false;
          for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]&&(pixels[i]||pixels[i+1]||pixels[i+2]))return false;
          c.fillStyle='rgba(200,100,50,.3)';c.fillRect(2,2,2,2);
          const alpha=c.getImageData(2,2,1,1).data[3];blackenShadowMask(c,80,80);
          pixels=c.getImageData(2,2,1,1).data;
          return pixels[0]===0&&pixels[1]===0&&pixels[2]===0&&pixels[3]===alpha;
        }''')
        # A real floating terrain tile must cast a half-opacity black shadow.
        evidence=page.evaluate('''async()=>{
          const {WORLD_ORIGIN_X,WORLD_ORIGIN_Y}=await import('/js/world-motion.mjs');
          if(plannerApp.weatherRenderer)plannerApp.weatherRenderer.render=()=>{};
          const {view:v,lastFrame:f}=plannerApp;const tx=52,ty=22;
          const x=v.cameraPivotX+(tx*32-WORLD_ORIGIN_X-f.x)*v.s*v.cameraZoom;
          const y=v.cameraPivotY+(16+ty*32-WORLD_ORIGIN_Y-f.y)*v.s*v.cameraZoom;
          const left=Math.floor(x-32*v.cameraZoom),top=Math.floor(y-2*v.cameraZoom);
          const size=Math.ceil((32*v.s+64)*v.cameraZoom),c=document.querySelector('#pv').getContext('2d');
          return {left,top,size,before:[...c.getImageData(left,top,size,size).data]};
        }''')
        page.evaluate("async()=>{const {invalidateWorld}=await import('/js/land-system.mjs');P.previewMode.world.fg[22][52]=2;invalidateWorld(P.previewMode.world);}")
        page.wait_for_timeout(150)
        after=page.evaluate('({left,top,size})=>[...document.querySelector("#pv").getContext("2d").getImageData(left,top,size,size).data]',evidence)
        before=evidence['before'];darkened=0
        for i in range(0,len(before),4):
            if before[i+3]==255 and max(before[i:i+3])>80 and all(abs(after[i+c]-before[i+c]*.5)<3 for c in range(3)):
                darkened+=1
        assert darkened>10,{'matchingBlackShadowPixels':darkened,'mobile':mobile}
        page.screenshot(path=str(out/('mobile.png' if mobile else 'desktop.png')))
        assert not errors,errors
        assert not failed,failed
        results.append({'mobile':mobile,'passiveInputBlocked':True,'liveActions':True,'mountedActions':True,
                        'nativePlayerTileScale':True,'buddyShadowBlack':True,'worldShadowPixels':True,
                        'removedExploreAndBackgroundUI':True,'consoleErrors':errors,'httpFailures':failed})
        context.close()
    browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
