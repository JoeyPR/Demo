"""Check complete Equipped membership, favorite artwork, Run control and OK spacing."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:9002'
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/inventory-details-check')
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
        run=page.locator('#preview-mode-toggle img')
        assert run.get_attribute('src')=='img/live-preview-run.png'
        assert run.is_visible()
        page.get_by_role('button',name='Start Live Preview',exact=True).click()
        assert page.evaluate('P.previewMode.live') and run.is_hidden()
        page.get_by_role('button',name='Return to Preview',exact=True).click()
        assert not page.evaluate('P.previewMode.live') and run.is_visible()
        ids=page.evaluate('''()=>{
          const selected=Array.from({length:10},(_,slot)=>
            plannerApp.catalog.items.find(item=>item.slot===slot&&!item.script)||
            plannerApp.catalog.items.find(item=>item.slot===slot)).map(item=>item.id);
          for(const id of selected)P.emit('equip',id);
          return selected;
        }''')
        assert len(set(ids))==10
        page.locator('#filter-button').click()
        page.locator('.filter-option[data-filter="0"]').click()
        page.locator('#q').fill('no-item-can-match-this-search')
        assert page.locator('#grid-window .box').count()==0
        page.locator('.tab[data-t=equip]').click()
        page.wait_for_function('document.querySelectorAll("#grid-window .box[data-id]").length===10')
        actual=page.locator('#grid-window .box[data-id]').evaluate_all('nodes=>nodes.map(node=>Number(node.dataset.id))')
        assert set(actual)==set(ids), actual
        assert page.locator('#filter-button').is_disabled()
        assert page.locator('#q').is_disabled()
        # A dropped inventory copy still contributes worn equipment and must be listed.
        page.evaluate('id=>{P.inv.itemById(id).gone=true;P.inv.refresh()}',ids[0])
        assert page.locator('#grid-window .box[data-id="'+str(ids[0])+'"]').count()==1
        page.evaluate('id=>P.emit("equip",id)',ids[0])
        assert page.locator('#grid-window .box[data-id="'+str(ids[0])+'"]').count()==0
        page.evaluate('id=>{P.inv.itemById(id).gone=false;P.emit("equip",id)}',ids[0])
        page.wait_for_function('document.querySelectorAll("#grid-window .box[data-id]").length===10')
        # Favorite through the real sidebar action; the supplied badge is decorative.
        page.evaluate('id=>{P.inv.focus=P.inv.itemById(id)}',ids[0])
        page.locator('.sbtn[data-a=fav]').click()
        badge=page.locator('#grid-window .box[data-id="'+str(ids[0])+'"] .fv')
        assert badge.is_visible()
        assert badge.get_attribute('src')=='img/favorite-badge.png'
        assert badge.evaluate('el=>getComputedStyle(el).objectFit')=='contain'
        # Range geometry checks the actual text inset on both sides of each OK.
        gaps=[]
        for action,button in [('info','#item-info-close'),('drop','#drop-confirm')]:
            page.evaluate('id=>{P.inv.focus=P.inv.itemById(id)}',ids[0])
            page.locator('.sbtn[data-a='+action+']').click()
            gap=page.locator(button).evaluate('''el=>{
              const range=document.createRange();range.selectNodeContents(el);
              const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();
              return {left:text.left-box.left,right:box.right-text.right};
            }''')
            assert gap['left']>=7 and gap['right']>=7,gap
            assert abs(gap['left']-gap['right'])<1,gap
            gaps.append(gap)
            page.keyboard.press('Escape')
        page.screenshot(path=str(out/('mobile.png' if mobile else 'desktop.png')))
        assert not errors,errors
        assert not failed,failed
        results.append({'mobile':mobile,'equippedVisible':10,'ignoresPreviousSearchAndCategory':True,
                        'equippedMembershipRefresh':True,'droppedCopyDoesNotHideWornItem':True,
                        'favoriteArtwork':True,'runArtworkAndReturn':True,'okInsets':gaps,
                        'consoleErrors':errors,'httpFailures':failed})
        context.close()
    browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
