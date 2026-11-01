"""Verify colored swatch borders and fill-only transparency on desktop and phone."""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:9000'
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/skin-panels')
out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for mobile in [False,True]:
        context=browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},
                                    is_mobile=mobile,has_touch=mobile)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url,wait_until='networkidle')
        page.wait_for_function('window.plannerApp?.ready')
        page.locator('.tab[data-t=player]').click()
        checks=page.evaluate('''()=>{
          const reference=document.createElement('div');reference.className='panel';
          document.body.append(reference);
          const panel=getComputedStyle(reference),inner=getComputedStyle(reference,'::after');
          const expected={borderWidth:panel.borderTopWidth,radius:panel.borderTopLeftRadius,
            shadow:panel.boxShadow,inner:inner.boxShadow};
          reference.remove();
          return [...document.querySelectorAll('.c-skin')].map(button=>{
            const skin=GrowSkinColors.SKINS.find(skin=>skin.id===button.dataset.skin);
            const style=getComputedStyle(button);
            const channels=style.backgroundColor.match(/[\\d.]+/g).map(Number);
            return {id:skin.id,expected:skin.rgb,fill:channels.slice(0,3),alpha:channels[3]??1,
              border:style.borderTopColor,borderWidth:style.borderTopWidth,radius:style.borderTopLeftRadius,
              opacity:style.opacity,shadow:style.boxShadow,panel:expected};
          });
        }''')
        assert len(checks)==25
        translucent=[]
        for check in checks:
            rgb=check['expected'][:3]
            assert check['fill']==rgb,check
            assert abs(check['alpha']-check['expected'][3]/255)<.002,check
            assert check['border']=='rgb('+', '.join(str(n) for n in rgb)+')',check
            assert check['opacity']=='1',check
            assert check['borderWidth']==check['panel']['borderWidth'],check
            assert check['radius']==check['panel']['radius'],check
            assert check['shadow']==check['panel']['shadow']+', '+check['panel']['inner'],check
            if check['alpha']<1:translucent.append(check['id'])
        assert set(translucent)=={'subscriber-purple','subscriber-turquoise','translucent-red'}
        page.locator('.c-skin[data-skin=subscriber-purple]').click()
        assert page.evaluate('P.store.get("skin")')=='subscriber-purple'
        assert page.locator('.c-skin[data-skin=subscriber-purple]').get_attribute('aria-pressed')=='true'
        page.screenshot(path=str(out/('mobile.png' if mobile else 'desktop.png')))
        assert not errors,errors
        results.append({'mobile':mobile,'swatches':25,'coloredOpaqueBorders':True,'fillOnlyAlpha':True,
                        'sharedPanelGeometryAndShadows':True,'translucentSkins':translucent,'selection':True,'pageErrors':errors})
        context.close()
    browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
