"""Run against an HTTP-served checkout. Requires Python Playwright + Chromium.

python -m http.server 9000
python tools/browser-smoke.py http://127.0.0.1:9000 --output /tmp/planner-smoke
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("url", nargs="?", default="http://127.0.0.1:9000")
parser.add_argument("--output", default="/tmp/planner-smoke")
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
results = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    for mobile in [False, True]:
        context = browser.new_context(
            viewport={"width": 390 if mobile else 1280, "height": 844 if mobile else 900},
            is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1,
            accept_downloads=True,
        )
        page = context.new_page()
        errors, failures = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("response", lambda response: failures.append(f"{response.status} {response.url}") if response.status >= 400 else None)
        page.goto(args.url, wait_until="networkidle")
        page.wait_for_function("window.plannerApp?.ready")
        assert page.evaluate("Object.keys(plannerApp.catalog.fxRenderers).length") == 314
        assert page.evaluate("""async()=>{
          const {createReferenceFxAtlas}=await import('/src/reference-fx.mjs');
          const sheet=createReferenceFxAtlas(),g=sheet.getContext('2d');
          return Array.from({length:6},(_,i)=>g.getImageData(i*32,0,32,32).data.some((v,k)=>k%4===3&&v>0)).every(Boolean);
        }""")

        # Keep equipment entry deterministic, then use the actual new controls.
        item_id = page.evaluate("plannerApp.catalog.items.find(item=>item.script==='StudentHeroGloves').id")
        page.evaluate("id=>P.emit('equip',id)", item_id)
        page.locator(".tab[data-t=player]").click()
        page.locator("#player-grow-id").fill("JoeyPR")
        page.get_by_role("checkbox", name="Show Student Hero Gloves", exact=True).uncheck()
        page.wait_for_function("!plannerApp.lastResult.calls.some(call=>call.owner===14278&&!call.fxEngine)")
        page.get_by_role("checkbox", name="Show Student Hero Gloves", exact=True).check()
        target_id = page.evaluate("plannerApp.catalog.items.find(item=>item.slot===5&&item.id!==14278).id")
        page.locator(f"#look-{item_id}").select_option(str(target_id))
        page.wait_for_function("id=>plannerApp.lastResult.look.displayed.some(item=>item.id===id)", arg=target_id)
        assert page.evaluate("P.equippedIds.has(14278)")
        page.locator(f"#look-{item_id}").select_option(str(item_id))

        page.get_by_role("checkbox", name="Item particles and effects", exact=True).uncheck()
        page.wait_for_function("!plannerApp.lastResult.calls.some(call=>call.fxEngine||call.xmlParticle||call.referenceFx)")
        page.get_by_role("checkbox", name="Item particles and effects", exact=True).check()
        page.evaluate("P.plateConfig.set({titles:['legend','dr'],wrenchOn:true,wrenchStyle:14360,wrenchDecoration:14358})")
        page.locator("#player-grow-id").evaluate("element=>element.blur()")
        page.evaluate("document.activeElement?.blur();window.testPunchCues=[];P.on('punch-cue',cue=>testPunchCues.push(cue));true")
        page.keyboard.down("f")
        page.wait_for_function("plannerApp.lastResult.calls.some(call=>call.fxEngine)")
        page.keyboard.up("f")
        assert page.evaluate("testPunchCues.length") > 0
        page.keyboard.down("d")
        page.keyboard.down("f")
        page.wait_for_function("plannerApp.lastFrame.x>400&&plannerApp.lastResult.calls.some(call=>call.fxEngine)")
        assert page.evaluate("plannerApp.lastResult.calls.filter(call=>call.fxEngine).every(call=>Math.abs(call.matrix[4])<300)")
        page.keyboard.up("d")
        page.keyboard.up("f")
        page.screenshot(path=str(output / ("mobile.png" if mobile else "desktop.png")))

        # The preserved Drop dialog still validates and creates world pickups.
        page.evaluate("P.emit('drop-request',P.catalog.items.find(item=>item.id===14278))")
        page.locator("#drop-amount").fill("3")
        page.locator("#drop-confirm").click()
        page.wait_for_function("plannerApp.pickups.length>0")
        assert page.locator("#drop-overlay").is_hidden()

        # Preserved Fist/Wrench restriction still reaches the blackbox.
        page.evaluate("P.emit('drop-request',{tool:true,name:'Fist'})")
        page.wait_for_function("!document.querySelector('#blackbox').hidden")
        assert "can't drop" in page.locator("#blackbox").text_content()

        page.locator(".tab[data-t=cloth]").click()
        search_item = page.evaluate("id=>plannerApp.catalog.items.find(item=>item.id===id)", target_id)
        page.locator("#q").fill(search_item["name"])
        search_box = page.locator(f'#grid-window .box[data-id="{target_id}"]')
        search_box.wait_for(state="visible")
        search_box.click()
        assert search_box.evaluate("element=>element.classList.contains('focus')")
        page.locator("#q").evaluate("element=>element.blur()")
        before = page.evaluate("plannerApp.lastFrame.x")
        page.keyboard.down("d")
        page.wait_for_function("x=>plannerApp.lastFrame.x>x+10", arg=before)
        page.keyboard.up("d")
        page.keyboard.press("Space")
        page.wait_for_function("!plannerApp.lastFrame.ground")
        page.evaluate("P.camZoom.v=1/1.28")
        page.wait_for_timeout(100)
        assert "Render warning" not in page.locator("#hud").text_content()

        if mobile:
            # Exercise real touch input, including pointer capture on the pad.
            cdp = context.new_cdp_session(page)
            pad = page.locator('.pad[data-k="right"]').bounding_box()
            touch = {"id": 1, "x": pad["x"] + pad["width"] / 2,
                     "y": pad["y"] + pad["height"] / 2}
            before = page.evaluate("plannerApp.lastFrame.x")
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [touch]})
            page.wait_for_function("x=>P.input.right&&plannerApp.lastFrame.x>x+10", arg=before)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            page.wait_for_function("!P.input.right")
            initial_zoom = page.evaluate("P.camZoom.v")
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [
                {"id": 1, "x": 80, "y": 70}, {"id": 2, "x": 190, "y": 70}]})
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [
                {"id": 1, "x": 50, "y": 70}, {"id": 2, "x": 220, "y": 70}]})
            page.wait_for_function("zoom=>P.camZoom.v>zoom", arg=initial_zoom)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

        with page.expect_download() as download:
            page.locator('.sbtn[data-a="export"]').click()
        download.value.save_as(str(output / ("mobile-export.png" if mobile else "desktop-export.png")))
        assert not errors, errors
        assert not failures, failures
        results.append({"mobile": mobile, "ready": True, "fxScripts": 314,
                        "appearance": True, "punchCues": True, "drop": True,
                        "blackbox": True, "movement": True, "pngExport": True,
                        "touchMovementAndPinch": mobile,
                        "consoleErrors": errors, "httpFailures": failures})
        context.close()
    browser.close()

(output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps(results, indent=2))
