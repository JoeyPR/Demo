"""Measure the supplied 140x128 dance capture without changing avatar assets.

Usage: python tools/measure-dance-reference.py CAPTURE.gif --output poses.json
Requires Pillow and numpy. The crop/threshold calibration is specific to the
supplied capture; reject a different frame size instead of reporting false data.
This measures head translation, facing and frame timing, not hidden arm angles.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


def measure(path):
    image = Image.open(path)
    if image.size != (140, 128):
        raise ValueError('Expected the supplied 140x128 capture calibration.')
    frames = []
    elapsed = 0
    for index in range(image.n_frames):
        image.seek(index)
        rgb = np.asarray(image.convert('RGB'), dtype=np.int16)
        skin = ((rgb[:, :, 0] - rgb[:, :, 1] > 12)
                & (rgb[:, :, 1] - rgb[:, :, 2] > 4)
                & (rgb[:, :, 0] < 235) & (rgb[:, :, 1] > 40))
        rows = np.where(skin[40:75, 60:85].any(axis=1))[0]
        if not len(rows):
            raise ValueError('Frame has no calibrated head region: ' + str(index))
        top = int(rows[0] + 40)
        eye_pixels = np.where(rgb[50:76, 45:99].min(axis=2) > 200)[1]
        if not len(eye_pixels):
            raise ValueError('Frame has no calibrated eye region: ' + str(index))
        facing = 1 if float(eye_pixels.mean()) + 45 > 72 else -1
        duration = image.info.get('duration', 30)
        frames.append({'index': index, 'atMs': elapsed, 'durationMs': duration,
                       'headTopPx': top, 'bodyYLogicalPx': (top - 49) / 2,
                       'facing': facing})
        elapsed += duration
    return {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'width': 140, 'height': 128, 'durationMs': elapsed,
            'frameCount': len(frames), 'frames': frames}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = json.dumps(measure(args.capture), indent=2) + '\n'
    if args.output:
        args.output.write_text(result)
    else:
        print(result, end='')
