"""Focused speech timing/fade checks against a served checkout."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9000'
out = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/player-chat-check')
out.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    for mobile in [False, True]:
        context = browser.new_context(viewport={'width': 390 if mobile else 1280, 'height': 844 if mobile else 900},
                                      is_mobile=mobile, has_touch=mobile)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='networkidle')
        page.wait_for_function('P.playerChat && window.plannerApp?.ready')
        page.evaluate('document.fonts.ready')
        menu = page.locator('#preview-menu-button').bounding_box()
        chat = page.locator('#player-chat-button').bounding_box()
        assert chat['y'] >= menu['y'] + menu['height']
        assert abs(chat['x'] - menu['x']) < .1
        assert page.locator('#player-chat-button').evaluate('el=>getComputedStyle(el).backgroundColor') == 'rgba(0, 0, 0, 0)'
        assert page.locator('#preview-menu-button').evaluate('el=>getComputedStyle(el).boxShadow') == 'none'
        durations = page.evaluate("()=>['one','one two three','...'].map(text=>{P.playerChat.submit(text);return P.playerChat.speech.durationMs;})")
        assert durations == [5000, 5000, 5000], durations
        assert page.evaluate('P.playerChat.durationMs') == 5000
        assert page.evaluate('P.playerChat.durationFor === undefined')
        assert page.locator('#player-chat-button img').get_attribute('src')=='img/chat-button.png'
        # Keyboard viewport changes must not move Menu/Chat out of their preview corner.
        before_controls = page.locator('#preview-actions').bounding_box()
        page.evaluate("window.originalVisualViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{offsetLeft:40,offsetTop:80,width:200,height:200}});P.playerChat.reposition()")
        after_controls = page.locator('#preview-actions').bounding_box()
        assert before_controls == after_controls, [before_controls, after_controls]
        page.evaluate("Object.defineProperty(window,'visualViewport',{configurable:true,value:window.originalVisualViewport});P.playerChat.reposition();P.playerChat.clear()")
        page.get_by_role('button', name='Player Chat', exact=True).click()
        assert page.locator('#playerChat').evaluate('el=>el===document.activeElement')
        assert page.locator('#player-chat-button img').get_attribute('src')=='img/chat-button-typing.png'
        page.locator('#playerChat').fill('Hi')
        page.locator('#playerChat').press('Enter')
        assert not page.evaluate('P.playerChat.isOpen')
        assert page.locator('#player-chat-button img').get_attribute('src')=='img/chat-button.png'
        page.wait_for_function("getComputedStyle(document.querySelector('#player-chat-bubble')).opacity>.95")
        assert page.evaluate('''()=>{const cv=document.querySelector('#pv'),r=cv.getBoundingClientRect(),v=plannerApp.view;return document.querySelector('#player-chat-bubble').getBoundingClientRect().height<=32*v.s*v.cameraZoom*r.width/cv.width*.5;}''')
        phases = page.evaluate('''()=>{
          const t=P.playerChat.speech.startedAtMs;
          return [0,999,1000,3999,4000,4999,5000].map(ms=>P.playerChat.stateAt(t+ms));
        }''')
        assert [state['phase'] for state in phases] == ['entering','entering','visible','visible','leaving','leaving','hidden']
        assert [state['active'] for state in phases] == [True,True,True,True,True,True,False]
        page.wait_for_function("P.playerChat.speech.phase==='leaving'")
        assert not page.locator('#player-chat-bubble').evaluate('el=>el.hidden')
        page.wait_for_function("(()=>{const o=Number(getComputedStyle(document.querySelector('#player-chat-bubble')).opacity);return o>0&&o<.95})()")
        page.wait_for_function("document.querySelector('#player-chat-bubble').hidden")
        assert not page.evaluate('P.playerChat.speech.active')
        page.evaluate("window.chatCommands=[];P.on('player-command',event=>chatCommands.push(event));P.playerChat.submit('/dance')")
        assert page.evaluate("chatCommands.at(-1).command") == 'dance'
        assert page.locator('#player-chat-bubble').evaluate('el=>el.hidden')
        assert not page.evaluate('P.playerChat.speech.active')
        # Replacement speech starts a fresh five-second lifetime.
        page.evaluate("P.playerChat.submit('one')")
        page.wait_for_timeout(4200)
        page.evaluate("P.playerChat.submit('one two')")
        page.wait_for_timeout(1000)
        assert page.evaluate('P.playerChat.speech.active')
        assert page.locator('#player-chat-text').text_content() == 'one two'
        page.get_by_role('button', name='Player Chat', exact=True).click()
        before = page.evaluate('plannerApp.lastFrame.x')
        page.locator('#playerChat').fill('')
        page.keyboard.type('wasd f')
        page.wait_for_timeout(80)
        assert abs(page.evaluate('plannerApp.lastFrame.x') - before) < .1
        assert page.evaluate('!P.input.left&&!P.input.right&&!P.input.jump&&!P.input.punch')
        page.locator('#playerChat').press('Escape')
        page.wait_for_function("document.querySelector('#player-chat-composer').hidden")
        page.evaluate("window.confirmedDrops=[];P.on('drop-confirm',event=>confirmedDrops.push(event));P.emit('drop-request',P.catalog.items.find(item=>item.id===34))")
        page.locator('#drop-amount').fill('-1')
        page.locator('#drop-confirm').click()
        assert page.locator('#drop-overlay').is_hidden()
        assert page.evaluate('confirmedDrops.length') == 0
        assert page.locator('#player-chat-text').text_content() == 'Nice try.  You remind me of myself at that age.'
        assert page.evaluate('P.playerChat.speech.durationMs') == 5000
        page.evaluate("P.emit('drop-request',P.catalog.items.find(item=>item.id===34))")
        page.locator('#drop-amount').fill('0')
        page.locator('#drop-confirm').click()
        assert page.locator('#drop-error').is_visible()
        page.locator('#drop-cancel').click()
        page.evaluate("P.playerChat.submit('Chat lasts five seconds')")
        page.wait_for_function("getComputedStyle(document.querySelector('#player-chat-bubble')).opacity>.95")
        page.screenshot(path=str(out / ('mobile.png' if mobile else 'desktop.png')))
        assert not errors, errors
        results.append({'mobile': mobile, 'verticalControls': True, 'shortBubble': True,
                        'fixedFiveSeconds': True, 'fadeInOut': True, 'speechLifecycle': True,
                        'danceCommand': True, 'replacementTimer': True, 'typingIsolation': True,
                        'negativeDropSpeech': True, 'fixedControls': True, 'pageErrors': errors})
        context.close()
    context = browser.new_context(reduced_motion='reduce')
    page = context.new_page()
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('P.playerChat')
    assert page.locator('#player-chat-bubble').evaluate('el=>getComputedStyle(el).transitionDuration') == '0s'
    context.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
