"""Decode the user-supplied RTTEX atlas patch into the planner's local PNGs.

Usage: python tools/import-missing-textures.py /path/to/missing_tiles.zip
Requires Pillow. RTTEX rows use the OpenGL bottom-left texture origin.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import zipfile
import zlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DESTINATIONS = {
    "tiles_candyblock.rttex": ["sheets/tiles/tiles_candyblock.png"],
    "tiles_page17.rttex": ["sheets/tiles/tiles_page17.png", "demo/assets/tiles_page17.png"],
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def decode(data):
    if data[:6] != b"RTPACK":
        raise ValueError("Expected RTPACK texture")
    raw = zlib.decompress(data[32:])
    if raw[:4] != b"RTTX":
        raise ValueError("Expected RTTX pixel payload")
    width, height = struct.unpack_from("<II", raw, 8)
    size = struct.unpack_from("<I", raw, 108)[0]
    if not (0 < width <= 4096 and 0 < height <= 4096) or size != width * height * 4:
        raise ValueError("Unsupported RTTEX dimensions/pixel layout")
    pixels = raw[124:124 + size]
    if len(pixels) != size:
        raise ValueError("Truncated RTTEX pixels")
    return Image.frombytes("RGBA", (width, height), pixels).transpose(Image.Transpose.FLIP_TOP_BOTTOM)


def main(source):
    source = Path(source)
    report = {
        "source": source.name,
        "sourceSha256": sha(source.read_bytes()),
        "format": "RTPACK/zlib, RTTX RGBA8 pixels, vertically flipped into PNG top-left origin",
        "textures": [],
        "metadataIncluded": False,
        "newWearableRendererSupport": False,
        "notes": [
            "The supplied archive contains two texture files and no item, renderer or FX definitions.",
            "Candy atlas dimensions are 512x256 in the native header, matching Planner-LANDsystem metadata. The prior runtime sheet was 256x512.",
            "Page 17 is synchronized in both the world tile directory and the player/UI atlas directory.",
        ],
    }
    with zipfile.ZipFile(source) as archive:
        for name, paths in DESTINATIONS.items():
            raw = archive.read(name)
            image = decode(raw)
            output = io.BytesIO()
            image.save(output, format="PNG")
            png = output.getvalue()
            entry = {"source": name, "sourceSha256": sha(raw), "dimensions": list(image.size),
                     "rgbaSha256": sha(image.tobytes()), "pngSha256": sha(png), "destinations": []}
            for relative in paths:
                target = ROOT / relative
                previous = Image.open(target).convert("RGBA") if target.exists() else None
                entry["destinations"].append({"path": relative,
                    "previousDimensions": list(previous.size) if previous else None,
                    "previousRgbaSha256": sha(previous.tobytes()) if previous else None,
                    "pixelContentChanged": previous is None or previous.size != image.size or previous.tobytes() != image.tobytes()})
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(png)
            report["textures"].append(entry)
    destination = ROOT / "evidence/new-textures-import.json"
    destination.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
