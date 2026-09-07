"""Synthesize the seven unique spell SFX for Emberhall magery.

Each spell gets a distinct voice (all original, synthesized here — CC0):
  nightsight  — airy moonlit shimmer, rising fifth glissandi
  heal        — warm major-arpeggio bells
  magicarrow  — fast whoosh + force-dart ping
  fireball    — low fire roar with a sub thump
  teleport    — phasey upward zip
  mark        — crystalline rune-etch ding
  recall      — deep gate swirl

Writes MP3s into public/audio/sfx/spell-<id>.mp3 via ffmpeg.
"""

from __future__ import annotations

import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

SR = 44_100
OUT = Path(__file__).resolve().parent.parent / "public" / "audio" / "sfx"


def t(dur: float) -> np.ndarray:
    return np.arange(int(SR * dur)) / SR


def adsr(n: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(n)
    a = max(1, int(SR * attack))
    r = max(1, int(SR * release))
    env[:a] = np.linspace(0, 1, a) ** 1.5
    env[-r:] = np.linspace(1, 0, r) ** 1.5
    return env


def gliss(f0: float, f1: float, dur: float, curve: float = 1.0) -> np.ndarray:
    """Phase-continuous glide f0 -> f1."""
    x = t(dur) / dur
    freq = f0 + (f1 - f0) * x**curve
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase)


def bell(freq: float, dur: float, tau: float, onset: float, total: float) -> np.ndarray:
    out = np.zeros(int(SR * total))
    start = int(SR * onset)
    n = min(int(SR * dur), len(out) - start)
    tt = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * freq * tt) + 0.32 * np.sin(2 * np.pi * freq * 2 * tt)) * np.exp(-tt / tau)
    out[start : start + n] += tone
    return out


def noise(n: int, seed: int = 7) -> np.ndarray:
    return np.random.default_rng(seed).standard_normal(n)


def sweep_noise(dur: float, f0: float, f1: float, q: float = 1.0, seed: int = 7) -> np.ndarray:
    """Noise through a resonant band-pass whose center glides f0 -> f1 (sampled IIR)."""
    x = noise(int(SR * dur), seed)
    y = np.zeros_like(x)
    n = len(x)
    freq = f0 + (f1 - f0) * np.arange(n) / n
    rc = 1.0 / (2 * np.pi * freq / q)
    dt = 1.0 / SR
    alpha = dt / (rc + dt)
    # one-pole band-pass approximation: high-pass then low-pass differenced
    lp = np.zeros_like(x)
    for i in range(1, n):
        lp[i] = lp[i - 1] + alpha[i] * (x[i] - lp[i - 1])
    hp = x - lp
    y = hp
    return y


def finish(sig: np.ndarray, peak: float = 0.89) -> np.ndarray:
    sig = sig - np.mean(sig)
    m = np.max(np.abs(sig))
    if m > 0:
        sig = sig / m * peak
    # de-click edges
    k = int(SR * 0.005)
    sig[:k] *= np.linspace(0, 1, k)
    sig[-k:] *= np.linspace(1, 0, k)
    return sig


def save_mp3(name: str, sig: np.ndarray, tmp: Path) -> None:
    wav_path = tmp / f"{name}.wav"
    pcm = (np.clip(sig, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    mp3_path = OUT / f"{name}.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-af", "volume=-2dB", "-codec:a", "libmp3lame", "-q:a", "3", str(mp3_path)],
        check=True,
    )
    print(f"{mp3_path.name}: {mp3_path.stat().st_size // 1024} KB")


def sfx_nightsight() -> np.ndarray:
    dur = 0.85
    a = gliss(320, 720, dur, 0.8)
    b = gliss(480, 1080, dur, 0.8)
    trem = 1 + 0.35 * np.sin(2 * np.pi * 5 * t(dur))
    shimmer = sweep_noise(dur, 5200, 8600, 0.7, seed=11) * 0.08
    sig = (0.5 * a + 0.34 * b) * trem + shimmer
    return finish(sig * adsr(len(sig), 0.12, 0.3))


def sfx_heal() -> np.ndarray:
    total = 1.05
    sig = np.zeros(int(SR * total))
    for i, f in enumerate([659.3, 784.0, 987.8, 1318.5]):  # E5 G5 B5 E6
        sig += bell(f, 0.85, 0.3, i * 0.085, total)
    tick = sweep_noise(total, 6000, 6000, 2.0, seed=3) * 0.05 * np.exp(-t(total) / 0.05)
    return finish(sig * 0.8 + tick)


def sfx_magicarrow() -> np.ndarray:
    dur = 0.42
    whoosh = sweep_noise(0.2, 2800, 700, 1.4, seed=5) * adsr(int(SR * 0.2), 0.004, 0.08)
    sig = np.zeros(int(SR * dur))
    sig[: len(whoosh)] += whoosh * 1.6
    ping = gliss(1500, 1150, 0.22) * np.exp(-t(0.22) / 0.07)
    sig[int(SR * 0.1) : int(SR * 0.1) + len(ping)] += ping * 0.9
    return finish(sig)


def sfx_fireball() -> np.ndarray:
    dur = 0.85
    roar = sweep_noise(dur, 2400, 280, 0.5, seed=9)
    swell = np.sin(np.pi * np.clip(t(dur) / dur, 0, 1)) ** 0.7
    sub = gliss(95, 52, dur, 1.4) * np.exp(-t(dur) / 0.42)
    sig = 0.9 * roar * swell + 0.8 * sub
    sig = np.tanh(sig * 1.15)  # grit
    return finish(sig * adsr(len(sig), 0.02, 0.28), peak=0.72)


def sfx_teleport() -> np.ndarray:
    dur = 0.5
    zip_up = gliss(480, 1900, 0.24, 1.2)
    mod = 1 + 0.55 * np.sin(2 * np.pi * 26 * t(0.24))
    tail = gliss(950, 300, 0.26, 1.1) * np.exp(-t(0.26) / 0.09)
    sig = np.zeros(int(SR * dur))
    sig[: len(zip_up)] += zip_up * mod
    sig[int(SR * 0.22) : int(SR * 0.22) + len(tail)] += tail * 0.7
    return finish(sig * adsr(len(sig), 0.01, 0.12))


def sfx_mark() -> np.ndarray:
    total = 0.8
    etch = sweep_noise(0.09, 7000, 9000, 2.5, seed=13) * np.linspace(0.2, 1, int(SR * 0.09))
    sig = np.zeros(int(SR * total))
    sig[: len(etch)] += etch * 0.5
    for f, amp in [(2093.0, 1.0), (3136.0, 0.5), (4680.0, 0.24)]:
        sig += amp * bell(f, 0.6, 0.34, 0.07, total)
    return finish(sig * 0.7)


def sfx_recall() -> np.ndarray:
    dur = 1.05
    low = gliss(170, 520, dur, 0.9)
    partner = gliss(172, 525, dur, 0.9)
    swirl = 1 + 0.4 * np.sin(2 * np.pi * 3 * t(dur))
    shimmer = gliss(680, 2080, dur, 0.9) * 0.16
    sig = (0.55 * low + 0.4 * partner) * swirl + shimmer
    return finish(sig * adsr(len(sig), 0.15, 0.4))


SPELLS = {
    "spell-nightsight": sfx_nightsight,
    "spell-heal": sfx_heal,
    "spell-magicarrow": sfx_magicarrow,
    "spell-fireball": sfx_fireball,
    "spell-teleport": sfx_teleport,
    "spell-mark": sfx_mark,
    "spell-recall": sfx_recall,
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for name, fn in SPELLS.items():
            save_mp3(name, fn(), tmp)
    print("done")
