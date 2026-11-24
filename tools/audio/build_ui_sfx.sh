#!/usr/bin/env bash
# Builds the basic UI sounds (tap, open, close, level up, summon) with earshot 1.0
# and ffmpeg. Every layer is rendered from a fixed seed, so a re-run gives the
# same files.
#
#   tools/audio/build_ui_sfx.sh [work dir] [out dir]
#
# Needs: earshot (pip install "earshot @ git+https://github.com/Leonxlnx/earshot",
# default path ~/.venvs/earshot/bin/earshot or $EARSHOT) and ffmpeg on PATH.
# Output: <out>/<name>_{A,B}.wav (masters for listening) and, with --runtime,
# public/sfx/<name>.webm + .mp3 for the variants named in RUNTIME below.
set -euo pipefail

EARSHOT=${EARSHOT:-$HOME/.venvs/earshot/bin/earshot}
WORK=${1:-/tmp/eldervane-sfx}
OUT=${2:-$WORK/out}
mkdir -p "$WORK" "$OUT"
OUT=$(cd "$OUT" && pwd)
if [ "${RUNTIME_DIR:-}" ]; then mkdir -p "$RUNTIME_DIR"; RUNTIME_DIR=$(cd "$RUNTIME_DIR" && pwd); fi
cd "$WORK"

ff() { ffmpeg -y -hide_banner -loglevel error "$@"; }
norm() { echo "loudnorm=I=$1:TP=-1.5:LRA=11"; }
mk() { # name design [options...]
  local name=$1 design=$2; shift 2
  [ -f "$name.wav" ] || "$EARSHOT" make "$name" --sound "$design" -o "$name.wav" "$@" >/dev/null
}

# --- layers (earshot) -------------------------------------------------------
mk air        whoosh/airy        --space 0.4 --seed 3
mk tick       tick/glass         --space 0.3 --seed 4
mk tap_tone   tap/tone                       --seed 9
mk select     menu/select        --theme glass --space 0.3 --seed 7
mk lift       send/lift          --theme glass --space 0.5 --ring 0.3 --seed 7
mk rise_harp  success/rise       --voice harp --space 0.5 --seed 7
mk drop       receive/drop       --theme glass --space 0.4 --seed 7
mk back_harp  menu/back          --voice harp --space 0.4 --seed 7
mk fanfare    level_up/fanfare   --theme glass --space 0.6 --ring 0.4 --seed 7
mk chime_harp purchase/chime     --voice harp --space 0.6 --ring 0.4 --seed 7
mk swell      cymbal/reverse     --space 0.6 --seed 7
mk sparkle    gem/sparkle        --theme glass --space 0.7 --ring 0.5 --seed 7
mk reveal     secret/reveal      --theme glass --space 0.7 --ring 0.5 --seed 7
mk heal_harp  heal/chime         --voice harp --space 0.7 --seed 7

# --- mixes (ffmpeg) ---------------------------------------------------------
# tap: A = glass tick on a soft key, B = two quick glass notes
ff -i tick.wav -i tap_tone.wav -filter_complex \
  "[0]volume=0.8[a];[1]volume=0.6[b];[a][b]amix=2:normalize=0,$(norm -22)" -ar 48000 "$OUT/tap_A.wav"
ff -i select.wav -af "atrim=0:0.45,afade=t=out:st=0.25:d=0.2,$(norm -22)" -ar 48000 "$OUT/tap_B.wav"

# open: an airy whoosh with a rising chime on top
ff -i air.wav -i lift.wav -filter_complex \
  "[0]volume=0.5[a];[1]adelay=60|60[b];[a][b]amix=2:normalize=0,$(norm -19)" -ar 48000 "$OUT/open_A.wav"
ff -i air.wav -i rise_harp.wav -filter_complex \
  "[0]volume=0.4[a];[1]adelay=40|40,atrim=0:1.1,afade=t=out:st=0.6:d=0.5[b];[a][b]amix=2:normalize=0,$(norm -19)" -ar 48000 "$OUT/open_B.wav"

# close: the whoosh backwards into a falling note
ff -i air.wav -i drop.wav -filter_complex \
  "[0]areverse,atrim=0.15,asetpts=N/SR/TB,volume=0.4[a];[1]adelay=120|120[b];[a][b]amix=2:normalize=0,$(norm -20)" -ar 48000 "$OUT/close_A.wav"
ff -i back_harp.wav -af "atrim=0:0.7,afade=t=out:st=0.35:d=0.35,$(norm -20)" -ar 48000 "$OUT/close_B.wav"

# level up: fanfare with a sparkle on the held note
ff -i fanfare.wav -i sparkle.wav -filter_complex \
  "[1]adelay=700|700,volume=0.5[b];[0][b]amix=2:normalize=0,$(norm -17)" -ar 48000 "$OUT/levelup_A.wav"
ff -i chime_harp.wav -i sparkle.wav -filter_complex \
  "[0]atrim=0:2.4,afade=t=out:st=1.6:d=0.8[a];[1]adelay=550|550,volume=0.45[b];[a][b]amix=2:normalize=0,$(norm -17)" -ar 48000 "$OUT/levelup_B.wav"

# summon: a swell of energy that bursts into bells (A) or a harp bloom (B)
ff -i swell.wav -i reveal.wav -i sparkle.wav -filter_complex \
  "[0]volume=0.8[a];[1]adelay=1450|1450[b];[2]adelay=1600|1600,volume=0.6[c];[a][b][c]amix=3:normalize=0,afade=t=out:st=3.2:d=0.4,$(norm -17)" -ar 48000 "$OUT/summon_A.wav"
ff -i swell.wav -i heal_harp.wav -i sparkle.wav -filter_complex \
  "[0]volume=0.8[a];[1]adelay=1450|1450,atrim=0:4.2,afade=t=out:st=3.4:d=0.8[b];[2]adelay=1500|1500,volume=0.55[c];[a][b][c]amix=3:normalize=0,$(norm -17)" -ar 48000 "$OUT/summon_B.wav"

# --- runtime files ----------------------------------------------------------
# The variant the game ships for each sound. Change a letter and re-run.
RUNTIME=${RUNTIME:-"tap=A open=A close=A levelup=A summon=A"}
if [ "${RUNTIME_DIR:-}" ]; then
  mkdir -p "$RUNTIME_DIR"
  for pair in $RUNTIME; do
    name=${pair%%=*}; v=${pair#*=}
    ff -i "$OUT/${name}_$v.wav" -c:a libopus -b:a 96k "$RUNTIME_DIR/$name.webm"
    ff -i "$OUT/${name}_$v.wav" -c:a libmp3lame -q:a 4 "$RUNTIME_DIR/$name.mp3"
  done
fi
echo "masters: $OUT"
