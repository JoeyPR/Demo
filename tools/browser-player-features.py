"""Check the actual chat-to-rig and skin-selector flows on desktop and phone."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:9000'
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/player-features')
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
        page.wait_for_function('plannerApp.lastFrame.ground')
        page.evaluate("P.playerChat.submit('Hello everyone today')")
        page.wait_for_function('plannerApp.lastResult.pose.talking?.active')
        assert page.evaluate('P.playerChat.speech.durationMs')==5000
        assert page.evaluate('plannerApp.lastResult.pose.face[1]===1')
        page.wait_for_function('plannerApp.lastResult.pose.face[0]===6')
        page.wait_for_function('plannerApp.lastResult.pose.face[0]===5')
        page.wait_for_function("P.playerChat.speech.phase==='leaving'")
        assert page.evaluate('!!plannerApp.lastResult.pose.talking?.active')
        page.wait_for_function('!P.playerChat.speech.active&&!plannerApp.lastResult.pose.talking?.active')
        assert page.evaluate('plannerApp.lastResult.pose.face[0]===0&&plannerApp.lastResult.pose.face[1]===0')
        # Submit the real command through the field and capture real components.
        page.get_by_role('button',name='Player Chat',exact=True).click()
        page.locator('#playerChat').fill('/dance');page.locator('#playerChat').press('Enter')
        page.wait_for_function('!!plannerApp.lastResult.pose.dance')
        assert page.locator('#player-chat-bubble').is_hidden()
        assert page.evaluate('plannerApp.lastResult.pose.face[0]===0&&plannerApp.lastResult.pose.face[1]===1')
        assert page.evaluate("['head','body','backArm','frontArm','backFoot','frontFoot'].every(tag=>plannerApp.lastResult.calls.some(call=>call.tag===tag))")
        start=page.evaluate('({x:plannerApp.lastFrame.x,facing:plannerApp.lastFrame.facing,angle:plannerApp.lastResult.pose.backAngle})')
        page.wait_for_function('angle=>Math.abs(plannerApp.lastResult.pose.backAngle-angle)>15',arg=start['angle'])
        page.wait_for_function('facing=>plannerApp.lastFrame.facing!==facing',arg=start['facing'])
        assert abs(page.evaluate('plannerApp.lastFrame.x')-start['x'])<.01
        page.screenshot(path=str(out/('mobile-dance.png' if mobile else 'desktop-dance.png')))
        # Movement and subsequent speech return control to the ordinary rig.
        page.get_by_role('button',name='Start Live Preview',exact=True).click()
        page.evaluate("P.playerChat.submit('/dance')");page.wait_for_function('!!plannerApp.lastResult.pose.dance')
        page.evaluate('document.activeElement?.blur()');page.keyboard.down('d')
        page.wait_for_function('!plannerApp.dance&&!plannerApp.lastResult.pose.dance');page.keyboard.up('d')
        page.wait_for_function('plannerApp.lastFrame.ground&&Math.abs(plannerApp.lastFrame.vx)<.01')
        page.evaluate("P.playerChat.submit('/dance')");page.wait_for_function('!!plannerApp.lastResult.pose.dance')
        page.evaluate("P.playerChat.submit('Speaking stops dancing')")
        page.wait_for_function('!plannerApp.lastResult.pose.dance&&!!plannerApp.lastResult.pose.talking?.active')
        page.evaluate('P.playerChat.clear()')
        # Check swatches via their visible Player customization controls.
        page.locator('.tab[data-t=player]').click()
        assert page.locator('.c-skin').count()==25
        for skin_id in ['black','grey','mod','buddy-legacy','subscriber-purple']:
            swatch=page.locator('.c-skin[data-skin='+skin_id+']')
            swatch.click()
            page.wait_for_function('id=>P.store.get("skin")===id',arg=skin_id)
            expected=page.evaluate('id=>GrowSkinColors.SKINS.find(skin=>skin.id===id)',skin_id)
            assert page.evaluate('plannerApp.skin')==expected['rgb']
            assert page.locator('.c-skin[data-skin='+skin_id+']').get_attribute('aria-pressed')=='true'
            if skin_id=='buddy-legacy':
                page.wait_for_function('!!plannerApp.lastResult.calls.find(call=>call.tag==="head")?.skinPalette')
                assert page.evaluate('plannerApp.lastResult.calls.find(call=>call.tag==="head").skinPalette')==expected['palette']
            if skin_id=='subscriber-purple':
                page.wait_for_function('Math.abs(plannerApp.lastResult.calls.find(call=>call.tag==="head").alpha-184/255)<.0001')
        page.locator('.c-skin[data-skin=buddy-legacy]').click()
        page.screenshot(path=str(out/('mobile-skins.png' if mobile else 'desktop-skins.png')))
        page.reload(wait_until='networkidle');page.wait_for_function('window.plannerApp?.ready')
        assert page.evaluate('P.store.get("skin")')=='buddy-legacy'
        assert page.evaluate('plannerApp.skinPalette')==[[204,159,78],[218,177,105],[230,196,137],[241,215,177]]
        assert not errors,errors
        assert not failed,failed
        results.append({'mobile':mobile,'talkingFaces':True,'speechDurationAndFadeSync':True,'danceComponentsAndTurns':True,
                        'danceCancellation':True,'skinSwatches':25,'buddyPalette':True,'skinAlphaAndPersistence':True,
                        'consoleErrors':errors,'httpFailures':failed})
        context.close()
    browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
