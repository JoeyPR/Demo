"""Compile supplied renderer XML as inert data. No uploaded code is executed."""
import json, pathlib, sys, hashlib, re, xml.etree.ElementTree as ET
source = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
def node(e):
    return {"tag": e.tag, "a": e.attrib, "v": (e.text or "").strip(),
            "c": [node(c) for c in e if isinstance(c.tag, str)]}
scripts, errors, repairs = {}, [], []
for path in sorted((source / "ItemRenderers").glob("*.xml")):
    try:
        text = path.read_text(encoding="utf-8-sig")
        def dedupe(match):
            tag = match.group(0)
            seen = {}
            def attribute(a):
                key, val = a.group(1), a.group(2)
                if key in seen and seen[key] == val:
                    repairs.append({"file": path.name, "attribute": key,
                                    "repair": "removed identical duplicate attribute"})
                    return ""
                seen[key] = val
                return a.group(0)
            return re.sub(r'\s+([\w:.-]+)="([^"]*)"', attribute, tag)
        text = re.sub(r"<[A-Za-z][^>]*>", dedupe, text)
        root = ET.fromstring(text)
        data = root.find("Data")
        if data is None:
            errors.append({"file": path.name, "error": "No Data element"})
            continue
        sprites = {}
        for s in data.findall("Sprite"):
            a = dict(s.attrib)
            a["atlas"] = pathlib.Path(a.get("fileName", "")).stem + ".png"
            sprites[a["name"]] = a
        scripts[path.stem] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "sprites": sprites,
            "animations": [node(e) for e in data.findall("Animations/*")],
            "machines": [node(e) for e in data.findall("StateMachines/*")],
            "options": {e.get("name"): (e.text or "").strip()
                        for e in data.findall("RenderOptions/Default/Set")},
            "particles": [node(e) for e in data.findall("ParticleSystems/*")],
            "rules": node(root.find("RenderRules")) if root.find("RenderRules") is not None else None,
        }
    except (ET.ParseError, KeyError, ValueError) as exc:
        errors.append({"file": path.name, "error": str(exc)})
result = {
    "provenance": "user-supplied XML; parser coverage is not full renderer support",
    "source": "https://www.mediafire.com/file/r8ik69x40n43hzv/player+stuff.zip/file",
    "scripts": scripts, "errors": errors, "repairs": repairs,
}
output.write_text(json.dumps(result, separators=(",", ":")))
print(json.dumps({"scripts": len(scripts), "errors": errors, "repairs": repairs, "bytes": output.stat().st_size}))
