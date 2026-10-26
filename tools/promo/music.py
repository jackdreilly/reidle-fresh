# Original backing track synthesized from scratch (no samples): 120 bpm, C G Am F.
import numpy as np, wave, sys
SR = 44100; DUR = float(sys.argv[2]); START = 3.4; END_HIT = 19.4
n = int(SR * DUR); L = np.zeros(n); R = np.zeros(n)
beat = 0.5
def add(sig, t, pan=0.0, g=1.0):
    i = int(t * SR); j = min(n, i + len(sig))
    if i >= n: return
    s = sig[: j - i] * g
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))
def env(N, a=0.005, d=0.2):
    t = np.arange(N) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)
def kick():
    N = int(0.35 * SR); t = np.arange(N) / SR
    f = 50 + 120 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9)
def snare():
    N = int(0.25 * SR); t = np.arange(N) / SR
    nz = np.random.default_rng(1).standard_normal(N)
    nz = nz - np.concatenate([[0], nz[:-1]]) * 0.6
    return (nz * 0.5 * np.exp(-t * 18) + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.5)
def hat(open_=False):
    N = int((0.12 if open_ else 0.04) * SR); t = np.arange(N) / SR
    nz = np.random.default_rng(2).standard_normal(N); nz = np.diff(np.concatenate([[0], nz]))
    return nz * np.exp(-t * (20 if open_ else 80)) * 0.3
def lp(x, a):
    y = np.zeros_like(x); acc = 0.0
    for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
    return y
def saw(freq, N, cut=0.15, d=0.18):
    t = np.arange(N) / SR
    s = sum(np.sin(2 * np.pi * freq * h * t) / h for h in range(1, 8)) * 0.6
    s += sum(np.sin(2 * np.pi * freq * 1.006 * h * t) / h for h in range(1, 8)) * 0.4
    return lp(s, cut) * env(N, 0.004, d)
def pad(freqs, N):
    t = np.arange(N) / SR
    s = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.003 * t) for f in freqs)
    a = np.minimum(1, t / 0.4) * np.minimum(1, (N / SR - t) / 0.4)
    return s * a * 0.12
m = lambda midi: 440 * 2 ** ((midi - 69) / 12)
chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]  # C G Am F
bass = [36, 43, 45, 41]
bar = 4 * beat
K, S_, H, HO = kick(), snare(), hat(), hat(True)
t = 0.0; b = 0
while t < DUR:
    ci = int(t // bar) % 4
    if t < START:  # intro: pad + ticking hats (like the clock)
        if b % 4 == 0: add(pad([m(x) for x in chords[ci]], int(bar * SR)), t, 0, 1.0)
        add(H, t, 0.3, 0.6)
    elif t < END_HIT:
        add(K, t, 0, 0.9)
        if b % 2 == 1: add(S_, t, 0, 0.55)
        add(H, t + beat / 2, 0.3, 0.7); add(H, t, -0.3, 0.4)
        for e in range(2): add(saw(m(bass[ci]), int(0.24 * SR), 0.08, 0.15), t + e * beat / 2, 0, 0.55)
        for s16 in range(4):
            note = chords[ci][(b * 4 + s16) % 3] + 12
            add(saw(m(note), int(0.2 * SR), 0.2, 0.09), t + s16 * beat / 4, 0.4 if s16 % 2 else -0.4, 0.18)
    t += beat; b += 1
# end hit: kick + big held C chord fading out
add(K, END_HIT, 0, 1.0)
held = int((DUR - END_HIT) * SR)
add(pad([m(x) for x in [48, 60, 64, 67, 72]], held) * 2.2, END_HIT)
for k, nn in enumerate([72, 76, 79, 84]): add(saw(m(nn), int(0.5 * SR), 0.2, 0.4), END_HIT + 0.12 * k, 0.3 * (-1) ** k, 0.25)
mix = np.stack([L, R], 1)
mix /= np.max(np.abs(mix)) * 1.12
fade = int(1.2 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
