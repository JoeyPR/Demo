"""Exercise the actual Info action, color codes, source-backed permissions, and modal input isolation."""
import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:9000'
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/item-info-check');out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for mobile in [False,True]:
        context=browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile)
        page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url,wait_until='networkidle');page.wait_for_function('P.itemInfo&&window.plannerApp?.ready');page.evaluate('P.itemInfo.ready')
        page.evaluate("P.inv.focus={id:34,name:'Shades'}")
        page.locator('.sbtn[data-a=info]').click()
        page.wait_for_function("document.querySelector('#item-info-dialog').getAttribute('aria-busy')==='false'")
        assert page.locator('#item-info-title').inner_text()=='Shades'
        assert page.locator('#item-info-description').inner_text()=="The future's so bright, you need these."
        assert page.locator('#item-info-description [data-rtfont-run]').evaluate('el=>getComputedStyle(el).color')=='rgb(252, 230, 186)'
        assert page.locator('#item-info-properties p').count()==3
        assert page.locator('#item-info-properties [data-rtfont-run]').first.evaluate('el=>getComputedStyle(el).color')=='rgb(191, 218, 255)'
        assert page.locator('#item-info-close').evaluate('el=>el===document.activeElement')
        before=page.evaluate('plannerApp.lastFrame.x')
        page.keyboard.type('adf');page.wait_for_timeout(100)
        assert abs(page.evaluate('plannerApp.lastFrame.x')-before)<.1
        assert page.evaluate('!P.input.left&&!P.input.right&&!P.input.jump&&!P.input.punch')
        page.keyboard.press('Tab');assert page.locator('#item-info-source').evaluate('el=>el===document.activeElement')
        page.keyboard.press('Shift+Tab');assert page.locator('#item-info-close').evaluate('el=>el===document.activeElement')
        page.screenshot(path=str(out/('mobile.png' if mobile else 'desktop.png')))
        page.keyboard.press('Escape');assert page.locator('#item-info-overlay').is_hidden()
        assert page.locator('.sbtn[data-a=info]').evaluate('el=>el===document.activeElement')
        page.evaluate("P.itemInfo.open({id:1780,name:'Legendbot-009'})")
        assert 'This item cannot be dropped or traded.' in page.locator('#item-info-properties').inner_text()
        page.evaluate("P.itemInfo.open({id:7592,name:'Treasure Map'})")
        assert 'moving faster' in page.locator('#item-info-description').inner_text()
        assert page.locator('.item-info-property-group').is_hidden()
        page.evaluate("P.itemInfo.open({id:-1,name:'<img src=x onerror=alert(1)>'})")
        assert page.locator('#item-info-title img').count()==0
        assert page.locator('#item-info-title').inner_text()=='<img src=x onerror=alert(1)>'
        page.locator('#item-info-close').click();assert page.locator('#item-info-overlay').is_hidden()
        assert not errors,errors
        results.append({'mobile':mobile,'realInfoAction':True,'verifiedProperties':True,'nativeFallback':True,'colorCodes':True,'modalFocusAndMovement':True,'safeText':True,'pageErrors':errors})
        context.close()
    browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
