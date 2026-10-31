"""Integration checks: python tools/browser-world-chat.py [URL] [output-dir]."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:9000'
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/world-chat-smoke')
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
        assert page.evaluate('P.world.active&&P.world.blocks.length===1766')
        page.keyboard.down('d')
        page.get_by_role('button',name='World controls',exact=True).click()
        page.locator('#world-block-search').fill('Bricks')
        page.keyboard.up('d')
        assert page.evaluate('!P.input.right'), 'World controls must release held movement'
        page.locator('#world-block').select_option('116')
        assert page.locator('#world-tool').input_value()=='place'
        page.get_by_role('button',name='World controls',exact=True).click()
        page.evaluate('P.world.respawn()')
        page.wait_for_function('plannerApp.lastFrame.x===0&&plannerApp.lastFrame.ground')
        # Use the actual screen projection and pointer handler to place a wall.
        def click_tile(tx,ty):
            xy=page.evaluate('''([tx,ty])=>{
              const f=plannerApp.lastFrame,v=plannerApp.view,cv=document.querySelector('#pv'),r=cv.getBoundingClientRect();
              return {x:r.left+(v.cameraPivotX+((tx+.5)*20-1010-f.x)*v.s*v.cameraZoom)*r.width/cv.width,
                y:r.top+(v.cameraPivotY+(16*.78+((ty+.5)*20-480-f.y))*v.s*v.cameraZoom)*r.height/cv.height};
            }''',[tx,ty])
            page.mouse.click(xy['x'],xy['y'])
        click_tile(52,22)
        assert page.evaluate('P.world.data.fg[22][52]===116')
        page.evaluate('P.world.setTool("play");document.activeElement?.blur()')
        page.keyboard.down('d');page.wait_for_function('plannerApp.lastFrame.x>=21.9')
        page.wait_for_timeout(180)
        assert page.evaluate('Math.abs(plannerApp.lastFrame.x-22)<.01&&plannerApp.lastFrame.vx===0'), page.evaluate('({frame:plannerApp.lastFrame,wall:P.world.data.fg[22][52],mobile:P.preview.mobile})')
        page.keyboard.up('d')
        page.evaluate('P.world.setTool("erase")');click_tile(52,22)
        assert page.evaluate('P.world.data.fg[22][52]===0')
        page.evaluate('P.world.setTool("play");document.activeElement?.blur()')
        page.keyboard.down('d');page.wait_for_function('plannerApp.lastFrame.x>45');page.keyboard.up('d')
        page.wait_for_timeout(300)
        # Background selection remains non-colliding and physics remains live.
        page.evaluate('P.world.select(14);P.world.edit(55,22);P.world.select(116);P.world.respawn()')
        page.wait_for_function('plannerApp.lastFrame.x===0&&plannerApp.lastFrame.ground')
        # Real chat button directly focuses the native text field.
        page.get_by_role('button',name='Player Chat',exact=True).click()
        assert page.locator('#playerChat').evaluate('el=>document.activeElement===el')
        x=page.evaluate('plannerApp.lastFrame.x')
        page.locator('#playerChat').fill('');page.keyboard.type('wasd f')
        page.wait_for_timeout(100)
        assert page.evaluate('!P.input.left&&!P.input.right&&!P.input.jump&&!P.input.punch')
        assert abs(page.evaluate('plannerApp.lastFrame.x')-x)<.1
        page.locator('#playerChat').fill('Hello Growtopia!');page.locator('#playerChat').press('Enter')
        assert page.locator('#player-chat-text').text_content()=='Hello Growtopia!'
        small=page.locator('#player-chat-bubble').bounding_box()
        page.get_by_role('button',name='Player Chat',exact=True).click()
        page.locator('#playerChat').fill('Line one');page.locator('#playerChat').press('Shift+Enter');page.keyboard.type('Line two')
        assert page.locator('#playerChat').input_value()=='Line one\nLine two'
        page.locator('#playerChat').press('Enter')
        page.evaluate('P.playerChat.submit("LongPlayerMessage".repeat(7))')
        large=page.locator('#player-chat-bubble').bounding_box()
        assert large['height']>small['height'] and large['x']>=0
        assert large['x']+large['width']<=page.viewport_size['width']
        assert page.evaluate('getComputedStyle(document.querySelector("#player-chat-bubble")).backgroundColor')=='rgb(39, 125, 159)'
        assert 'Nameplate CG' in page.locator('#playerChat').evaluate('el=>getComputedStyle(el).fontFamily')
        assert page.locator('#player-chat-text').evaluate('el=>getComputedStyle(el).textShadow').endswith('1px 1px 0px')
        page.evaluate('P.playerChat.submit("<img src=x onerror=alert(1)>")')
        assert page.locator('#player-chat-text img').count()==0
        assert not page.evaluate('P.playerChat.submit("  ")')
        page.evaluate('P.playerChat.submit("a".repeat(200))');assert len(page.evaluate('P.playerChat.text'))==120
        page.evaluate('P.playerChat.submit("Hello Growtopia!")')
        page.get_by_role('button',name='Menu',exact=True).click(force=True)
        assert page.locator('#player-chat-composer').is_hidden()
        # Observe a full natural blink using the simulation's deterministic clock.
        page.wait_for_function('plannerApp.lastResult.pose.blink.closure>.8',timeout=9000)
        page.screenshot(path=str(out/('mobile-blink-chat.png' if mobile else 'desktop-blink-chat.png')))
        page.wait_for_function('plannerApp.lastResult.pose.blink.closure===0')
        page.screenshot(path=str(out/('mobile.png' if mobile else 'desktop.png')))
        page.get_by_role('button',name='World controls',exact=True).click()
        page.locator('#world-active').uncheck();assert not page.evaluate('P.world.active')
        page.locator('#world-active').check();assert page.evaluate('P.world.active')
        page.locator('#world-new').click();assert page.evaluate('plannerApp.lastFrame.x===0')
        assert not errors,errors
        assert not failed,failed
        results.append({'mobile':mobile,'blocks':1766,'placePointer':True,'wallCollision':True,'erasePointer':True,
          'respawn':True,'modeSwitch':True,'chatFocus':True,'typingIsolation':True,'chatFontAndPanel':True,
          'chatAutosize':True,'safeText':True,'naturalBlink':True,'menuInert':True,'consoleErrors':errors,'httpFailures':failed})
        context.close()
    browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
