"""Locate each cut-in in native recordings and extract untouched video-frame posters."""
from pathlib import Path
import argparse
import json
import subprocess
import tempfile
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', default='assets/ui/cutins/locked-next-five/manifest.json')
    parser.add_argument('--output', default='docs/reviews/locked-next-five')
    args = parser.parse_args()
    output = ROOT / args.output
    rows = json.loads((ROOT / args.manifest).read_text())
    cases = json.loads((output / 'browser-report.json').read_text())['report']
    report = []
    for width in [1440, 844]:
        for row in rows:
            hero = row['id']
            case = next(c for c in cases if c['id'] == hero and c['w'] == width and not c['reduced'])
            height = case['h']
            stage_width = round(case['bounds']['width'] * 480 / width)
            stage_height = round(stage_width * row['h'] / row['w'])
            art = Image.open(ROOT / row['source']).convert('RGBA').resize((stage_width, stage_height), Image.Resampling.LANCZOS)
            expected = np.asarray(art).astype(float)
            mask = expected[:, :, 3] > 250
            video = output / f'{hero}-{width}.mp4'
            with tempfile.TemporaryDirectory(prefix='native-cutin-') as temp:
                subprocess.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(video), '-vf', 'fps=10,scale=480:-1', '-threads', '1', f'{temp}/%03d.png'], check=True)
                scores = []
                for frame in sorted(Path(temp).glob('*.png')):
                    pixels = np.asarray(Image.open(frame).convert('RGB')).astype(float)[:stage_height, :stage_width]
                    scores.append((float(np.abs(pixels - expected[:, :, :3])[mask].mean()), int(frame.stem) - 1))
                error, index = min(scores)
                matches = sum(e < 35 for e, _ in scores)
                # Detect a clear plate held for several samples, with entry/exit present.
                assert error < 20 and matches >= 3, (hero, width, error, matches)
                assert scores[0][0] > 35 and scores[-1][0] > 35, (hero, width, 'missing entry/exit')
                poster = output / f'{hero}-{width}-poster.png'
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(video), '-vf', f'fps=10,select=eq(n\\,{index})', '-frames:v', '1', '-threads', '1', str(poster)], check=True)
                report.append(dict(id=hero, width=width, height=height, video=video.name, poster=poster.name,
                    poster_sample_time_s=index / 10, best_opaque_plate_rgb_mae=round(error, 3),
                    frames_with_mae_below_35=matches, sampled_frames=len(scores), entry_and_exit_present=True,
                    note='Pixel comparison locates the visible plate; poster is an original native video frame, not a composed or retouched game image.'))
                print(f'{hero} {width}: native plate present, entry/exit captured', flush=True)
    (output / 'native-frame-report.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
