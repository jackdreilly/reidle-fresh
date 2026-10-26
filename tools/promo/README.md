# Promo video

`public/static/promo.mp4`, served at `/static/promo.mp4`: a 22.6s vertical (1080x1920) promo for social posts.
The footage is the real app on the local stack with made-up players (`demo.sql` renames the seed players and
the league to "Word Nerds"), so no real player data is in it.

Rebuild: `tools/promo/make.sh` (needs Docker for the local stack, ffmpeg, Python 3 and Playwright's Chromium;
writes scratch files to `.promo-work/`, which is git-ignored).

| Time | Scene | Voiceover (`vo.txt`) |
| --- | --- | --- |
| 0.0-3.4 | REIDLE tiles, "Wordle, but it's a race.", big QR | It's Wordle, but it's a race. |
| 3.4-11.0 | sam plays today's daily live (`rec.cjs play`), sped up 1.35x | One word a day. The clock is running. |
| 11.0-13.6 | Today's leaderboard, sam #1 | The fastest time takes the day. |
| 13.6-16.8 | Last week's race chart replaying | Every day counts toward the week. |
| 16.8-19.4 | League chat, sam posts the time | Then talk trash in your league chat. |
| 19.4-22.6 | "Start a league. Race your friends." + QR + URL | Start a league. Race your friends. |

Every frame has the QR code (`qr.svg`, to https://reidle.reillybrothers.net): big on the first and last cards,
in the top-right corner otherwise, so a paused frame can always be scanned.

- `rec.cjs` records scenes as JPEG frames with `Page.captureScreenshot` (clip scale 2 = 780x1688). CDP's
  screencast only returns CSS-pixel frames (390 wide) even at deviceScaleFactor 3, which looked soft.
- `gfx.cjs` renders the caption backgrounds, title/end cards and corner masks with Playwright; `build.sh` cuts
  and speeds each clip (trim/speed/duration are its arguments) and composites it with ffmpeg.
- Audio: voiceover by Piper TTS with the `en_US-joe-medium` voice (CC0 dataset). The music is synthesized
  from scratch by `music.py` (no samples, so no license). `mixaudio.sh` ducks the music gently under the voice.
- Changing timings: keep `title.txt`, the segment durations in `build.sh`/`make.sh`, the `adelay`s in
  `mixaudio.sh` and the length passed to `music.py` (and `START`/`END_HIT` in it) in step.
