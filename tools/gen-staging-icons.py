# Regenerates public-staging/: the prod icons with a small "STAGING" pill, so an installed staging app
# is easy to tell apart from prod. The staging build copies these over dist/ (vite.config.ts `reidle-staging`).
# Run from the repo root: python3 tools/gen-staging-icons.py  (needs Pillow; output is committed)
from PIL import Image, ImageDraw, ImageFont
from glob import glob

FONT = (glob("/usr/share/fonts/**/InterDisplay-Bold.otf", recursive=True) + glob("/usr/share/fonts/**/DejaVuSans-Bold.ttf", recursive=True))[0]
TEAL, WHITE = (13, 148, 136, 255), (255, 255, 255, 255)

def badge(src, dst, bottom=0.94):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(FONT, int(h * 0.11))
    text = "STAGING"
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    pw, ph = (r - l) + h * 0.12, (b - t) + h * 0.07
    x0, y1 = (w - pw) / 2, h * bottom
    d.rounded_rectangle([x0, y1 - ph, x0 + pw, y1], radius=ph / 2, fill=TEAL, outline=WHITE, width=max(1, int(h * 0.012)))
    d.text((w / 2, y1 - ph / 2), text, font=font, fill=WHITE, anchor="mm")
    if dst.endswith(".ico"):
        im.save(dst, sizes=[(48, 48), (32, 32)])
    elif dst.endswith(".webp"):
        im.save(dst, lossless=True)
    else:
        im.convert("RGB").save(dst, optimize=True)

for f in ["android-chrome-192x192.png", "android-chrome-384x384.png", "android-chrome-512x512.png", "apple-touch-icon.png", "apple-touch-icon-precomposed.png", "android-chrome-96x96.webp"]:
    badge("public/" + f, "public-staging/" + f)
badge("public/mask.png", "public-staging/mask.png", bottom=0.86)  # maskable: stay inside the safe zone
# favicon: 32px is too small for text, so a plain teal dot in the corner
im = Image.open("public/android-chrome-192x192.png").convert("RGBA").resize((48, 48), Image.LANCZOS)
ImageDraw.Draw(im).ellipse([28, 28, 47, 47], fill=TEAL, outline=WHITE, width=2)
im.save("public-staging/favicon.ico", sizes=[(48, 48), (32, 32)])
