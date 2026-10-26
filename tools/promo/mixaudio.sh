# Mixes vo/joe-*.wav over music.wav into mix.wav (run from the work dir).
set -e
O=${VO_DIR:-vo}
ffmpeg -loglevel error -y -i $O/joe-1.wav -i $O/joe-2.wav -i $O/joe-3.wav -i $O/joe-4.wav -i $O/joe-5.wav -i $O/joe-6.wav -filter_complex "[0]adelay=800:all=1[a];[1]adelay=3600:all=1[b];[2]adelay=11000:all=1[c];[3]adelay=13700:all=1[d];[4]adelay=16900:all=1[e];[5]adelay=19600:all=1[f];[a][b][c][d][e][f]amix=inputs=6:normalize=0,aresample=44100,pan=stereo|c0=c0|c1=c0,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,volume=2.0,apad=whole_dur=22.6[vo]" -map "[vo]" -t 22.6 vo.wav
ffmpeg -loglevel error -y -i music.wav -i vo.wav -filter_complex "[0]volume=0.42[mu];[1]asplit[v1][v2];[mu][v1]sidechaincompress=threshold=0.06:ratio=2:knee=4:attack=120:release=700[duck];[duck][v2]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 mix.wav
