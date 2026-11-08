#!/usr/bin/env python3
"""Decrypt setplanner d/ blobs into plain JSON files inside the demo.

Every protected payload is AES-256-GCM (IV(12) + ciphertext + tag(16)) whose
plaintext is gzip-compressed JSON. fx_keys.json maps logical name ->
[md5, base64key]; the blob lives at <site>/d/<md5>.bin.

Output layout (self-contained files, no runtime key server needed):
  world/<x>.json            <- f:world.<x>          (rules, item-sheets, ...)
  render/weather/<key>.json <- w:<key>              (81 weather presets)
  render/data/fx/<id>.json  <- i:<id>               (item fx / dj / pfx)
  render/data/renderers/<Name>.json <- r:<Name>     (ItemRenderer scripts)
  render/data/punch/<n>.json <- p:<n>               (31 punch styles)
  render/data/punch-meta.json <- meta:punch
  render/data/emotes.json   <- f:emotes
"""
import base64
import gzip
import json
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Item fx blobs are huge when decompressed (some 10-20 MB of JSON). They are
# stored gzip-compressed (no encryption) and inflated at load time with the
# browser's built-in DecompressionStream — still one self-contained file per
# item, no key server, instant load.
GZIPPED_PREFIXES = ("i:",)

SETPLANNER = Path(__file__).resolve().parents[2] / "setplanner" / "setplanner"
SITE = SETPLANNER / "site"
KEYS = json.loads((SETPLANNER / "fx_keys.json").read_text())
DEMO = Path(__file__).resolve().parents[1]

TARGETS = {
    "f:world.": DEMO / "world",
    "w:": DEMO / "render" / "weather",
    "i:": DEMO / "render" / "data" / "fx",
    "r:": DEMO / "render" / "data" / "renderers",
    "p:": DEMO / "render" / "data" / "punch",
    "meta:": DEMO / "render" / "data",
    "f:": DEMO / "render" / "data",  # f:emotes and other world fx
}


def safe_name(name: str) -> str:
    return name.replace(":", "_").replace("/", "_").replace(" ", "_")


def decrypt(name: str, md5: str, key_b64: str):
    raw = (SITE / "d" / f"{md5}.bin").read_bytes()
    key = base64.b64decode(key_b64)
    plain = AESGCM(key).decrypt(raw[:12], raw[12:], None)
    return gzip.decompress(plain)


def target_for(name: str):
    for prefix, directory in TARGETS.items():
        if name.startswith(prefix):
            if name == "meta:punch":
                return DEMO / "render" / "data" / "punch-meta.json", True
            if name.startswith("f:world."):
                return directory / f"{name[len('f:world.'):]}{'_data' if False else ''}.json".replace("..", "."), True
            if name.startswith("w:"):
                return directory / f"{name[2:]}.json", True
            if name.startswith("i:"):
                return directory / f"{name[2:]}.json", True
            if name.startswith("r:"):
                return directory / f"{name[2:]}.json", True
            if name.startswith("p:"):
                return directory / f"{name[2:]}.json", True
            if name.startswith("f:"):
                return directory / f"{safe_name(name[2:])}.json", True
    return None, False


def main(which):
    ok = fail = skip = 0
    for name, (md5, key) in KEYS.items():
        out, known = target_for(name)
        if not known:
            skip += 1
            continue
        if which != "all" and not any(name.startswith(p) for p in which.split(",")):
            continue
        try:
            data = decrypt(name, md5, key)
        except FileNotFoundError:
            print(f"  missing blob {name} ({md5})")
            fail += 1
            continue
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED {name}: {exc}")
            fail += 1
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        if name.startswith(GZIPPED_PREFIXES):
            out = out.with_suffix(".json.gz")
            out.write_bytes(gzip.compress(data, 6))
        else:
            out.write_text(json.dumps(json.loads(data), separators=(",", ":")))
        ok += 1
    print(f"decrypted {ok}, failed {fail}, skipped {skip}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "all")
