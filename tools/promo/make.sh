#!/usr/bin/env bash
# Rebuilds the promo video (public/static/promo.mp4) from the real app with demo data. See README.md.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
WORK="${WORK:-$ROOT/.promo-work}"; mkdir -p "$WORK"/{raw,seg,gfx,vo}
DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
cd "$ROOT"

# 1. Fresh local stack + demo data, app served at :3000
tools/sandbox-up.sh
npx supabase db reset >/dev/null
psql "$DB" -q -f "$HERE/demo.sql"
npx vite build --mode development --outDir "$WORK/dist" --emptyOutDir >/dev/null
npx vite preview --outDir "$WORK/dist" --port 3000 --host 127.0.0.1 >/dev/null 2>&1 & PREVIEW=$!
trap 'kill $PREVIEW 2>/dev/null' EXIT
sleep 3
node "$HERE/signin.cjs" sam maya theo
psql "$DB" -q -f "$HERE/linked.sql"

# 2. Record the scenes (sam plays today's word live, so record each take on a fresh reset)
OUT="$WORK/raw" node "$HERE/rec.cjs" play today week chat
for s in play today week chat; do
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$WORK/raw/$s/list.txt" -vf "fps=30,format=yuv420p" -c:v libx264 -crf 14 "$WORK/raw/$s.mp4"
done

# 3. Captions, cards, QR (qr.svg -> https://reidle.reillybrothers.net)
cp "$HERE/qr.svg" "$WORK/gfx/qr.svg"
node "$HERE/gfx.cjs" "$WORK/gfx"

# 4. Voiceover (Piper, CC0 "joe" voice) and the synthesized music
if [ ! -x "$WORK/venv/bin/piper" ]; then python3 -m venv "$WORK/venv"; "$WORK/venv/bin/pip" install -q piper-tts numpy; fi
VOICE="$WORK/en_US-joe-medium.onnx"
for e in onnx onnx.json; do [ -f "$VOICE${e#onnx}" ] || curl -sSL -o "$VOICE${e#onnx}" "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.$e"; done
i=0; while IFS= read -r line; do i=$((i+1)); echo "$line" | "$WORK/venv/bin/piper" -m "$VOICE" --length-scale 0.92 -f "$WORK/vo/joe-$i.wav" 2>/dev/null; done < "$HERE/vo.txt"
"$WORK/venv/bin/python" "$HERE/music.py" "$WORK/music.wav" 22.6

# 5. Assemble
cd "$WORK"
cp "$HERE/title.txt" "$HERE/all.txt" .
ffmpeg -loglevel error -y -f concat -safe 0 -i title.txt -vf "fps=30,format=yuv420p" -t 3.4 -c:v libx264 -crf 15 seg/1title.mp4
ffmpeg -loglevel error -y -loop 1 -framerate 30 -i gfx/end.png -vf "fade=in:st=0:d=0.25,format=yuv420p" -t 3.2 -c:v libx264 -crf 15 seg/6end.mp4
bash "$HERE/build.sh"
VO_DIR=vo bash "$HERE/mixaudio.sh"
ffmpeg -loglevel error -y -f concat -safe 0 -i all.txt -i mix.wav -map 0:v -map 1:a -c:v libx264 -crf 23 -preset veryslow -tune animation \
  -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest "${OUT_FILE:-$ROOT/public/static/promo.mp4}"
echo "wrote ${OUT_FILE:-public/static/promo.mp4}"
