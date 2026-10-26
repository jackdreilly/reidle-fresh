set -e
# Composes the four app clips (raw/*.mp4) with their caption backgrounds into seg/*.mp4 (run from the work dir).
seg() { # name bg clip start end speed dur
ffmpeg -loglevel error -y -loop 1 -framerate 30 -i gfx/$2.png -i raw/$3.mp4 -loop 1 -framerate 30 -i gfx/mask.png -filter_complex \
"[1]trim=start=$4:end=$5,setpts=(PTS-STARTPTS)/$6,fps=30,scale=700:1515:flags=lanczos,format=rgba[v];[2]alphaextract[m];[v][m]alphamerge[vm];[0][vm]overlay=190:385:shortest=1,format=yuv420p" \
-t $7 -r 30 -c:v libx264 -crf 15 -preset slow seg/$1.mp4; }
zseg() { # name bg clip start end speed dur y0css y1css W X Y
ffmpeg -loglevel error -y -loop 1 -framerate 30 -i gfx/$2.png -i raw/$3.mp4 -loop 1 -framerate 30 -i gfx/mask_${10}.png -filter_complex \
"[1]trim=start=$4:end=$5,setpts=(PTS-STARTPTS)/$6,fps=30,crop=780:$(( ($9-$8)*2 )):0:$(( $8*2 )),scale=${10}:-2:flags=lanczos,format=rgba[v];[2]alphaextract[m0];[m0][v]scale2ref[m][v2];[v2][m]alphamerge[vm];[0][vm]overlay=${11}:${12}:shortest=1,format=yuv420p" \
-t $7 -r 30 -c:v libx264 -crf 15 -preset slow seg/$1.mp4; }
seg 2play cap_play play 0.3 10.56 1.35 7.6
zseg 3today cap_today today 0.3 3.1 1 2.6 68 600 960 60 430
zseg 4week cap_week week 1.2 5.62 1.4 3.2 68 712 854 113 420
seg 5chat cap_chat chat 0.4 4.3 1.5 2.6
