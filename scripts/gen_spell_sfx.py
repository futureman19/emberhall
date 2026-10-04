"""Synthesize the unique spell SFX for Emberhall magery.

Each spell gets a distinct voice (all original, synthesized here — CC0):
  nightsight  — airy moonlit shimmer, rising fifth glissandi
  heal        — warm major-arpeggio bells
  magicarrow  — fast whoosh + force-dart ping
  fireball    — low fire roar with a sub thump
  teleport    — phasey upward zip
  mark        — crystalline rune-etch ding
  recall      — deep gate swirl
  cure        — clean water-drop chime, minor resolving to major
  poison      — sizzling hiss with bubbling glugs
  bless       — warm golden pad with rising fifth bells
  lightning   — sharp crack + sizzling descent + thunder tail

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


def sfx_cure() -> np.ndarray:
    total = 0.9
    sig = np.zeros(int(SR * total))
    # water drops: quick downward blips
    for onset, f0 in [(0.0, 980.0), (0.16, 1240.0)]:
        drop = gliss(f0, f0 * 0.45, 0.09) * np.exp(-t(0.09) / 0.028)
        start = int(SR * onset)
        sig[start : start + len(drop)] += drop * 0.8
    # the resolve: A5 -> C#6 -> E6 bells, cool and clean
    for i, f in enumerate([880.0, 1108.7, 1318.5]):
        sig += bell(f, 0.7, 0.32, 0.28 + i * 0.09, total)
    return finish(sig * 0.85)


def sfx_poison() -> np.ndarray:
    dur = 0.75
    sizzle = sweep_noise(dur, 4600, 2300, 1.1, seed=17) * adsr(int(SR * dur), 0.01, 0.3)
    sig = sizzle * 0.55
    # bubbling glugs, descending
    for onset, f0 in [(0.1, 320.0), (0.28, 260.0), (0.46, 200.0)]:
        glug = gliss(f0, f0 * 0.5, 0.08, 1.4) * np.exp(-t(0.08) / 0.03)
        start = int(SR * onset)
        sig[start : start + len(glug)] += glug * 0.9
    drone = gliss(160, 120, dur) * np.exp(-t(dur) / 0.5) * 0.18
    return finish(sig + drone)


def sfx_bless() -> np.ndarray:
    total = 1.2
    sig = np.zeros(int(SR * total))
    # golden pad: D-A fifth breathing underneath
    pad = (gliss(293.7, 293.7, total) + 0.6 * gliss(440.0, 440.0, total)) * adsr(int(SR * total), 0.4, 0.5)
    sig += pad * 0.22
    # rising fifth bells: D5 A5 D6
    for i, f in enumerate([587.3, 880.0, 1174.7]):
        sig += bell(f, 0.85, 0.4, 0.1 + i * 0.14, total)
    shimmer = sweep_noise(total, 7000, 9000, 0.8, seed=19) * 0.05
    return finish(sig * 0.8 + shimmer)


def sfx_lightning() -> np.ndarray:
    dur = 0.62
    sig = np.zeros(int(SR * dur))
    # the crack: a 25ms high snap
    snap = sweep_noise(0.025, 7500, 9000, 0.6, seed=23)
    sig[: len(snap)] += snap * 3.2
    # the sizzling descent of the bolt itself
    fry = sweep_noise(0.22, 8000, 900, 0.9, seed=29) * np.exp(-t(0.22) / 0.1)
    sig[int(SR * 0.02) : int(SR * 0.02) + len(fry)] += fry * 1.1
    # thunder tail
    roll = gliss(78, 44, 0.42, 1.3) * np.exp(-t(0.42) / 0.22)
    sig[int(SR * 0.16) : int(SR * 0.16) + len(roll)] += roll * 0.85
    sig = np.tanh(sig * 1.1)
    return finish(sig, peak=0.78)


def sfx_summon() -> np.ndarray:
    total = 1.1
    sig = np.zeros(int(SR * total))
    # the portal: a deep whoosh opening downward, then the bind pulls up
    whoosh = sweep_noise(0.55, 900, 220, 1.2, seed=31) * np.exp(-t(0.55) / 0.3)
    sig[: len(whoosh)] += whoosh * 0.9
    pull = sweep_noise(0.35, 300, 1400, 1.4, seed=37) * adsr(int(SR * 0.35), 0.12, 0.12)
    sig[int(SR * 0.4) : int(SR * 0.4) + len(pull)] += pull * 0.4
    # a low toll, then the binding chime
    sig += bell(196.0, 0.9, 0.4, 0.05, total) * 0.5
    sig += bell(392.0, 0.6, 0.3, 0.62, total) * 0.35
    sig += bell(523.3, 0.5, 0.26, 0.72, total) * 0.28
    return finish(sig * 0.9)


def sfx_paralyze() -> np.ndarray:
    total = 0.7
    sig = np.zeros(int(SR * total))
    # the lock: a cluster of high sines snapping into unison
    for i, f in enumerate([1760.0, 2217.5, 2637.0, 3136.0]):
        blip = gliss(f * 1.12, f, 0.1 + i * 0.02, 1.6) * np.exp(-t(0.1 + i * 0.02) / 0.05)
        start = int(SR * (0.03 + i * 0.05))
        sig[start : start + len(blip)] += blip * 0.5
    # the freeze: glassy shimmer held, then cut short
    hold = (gliss(3136.0, 3136.0, 0.3) + 0.5 * gliss(4698.3, 4698.3, 0.3)) * adsr(int(SR * 0.3), 0.02, 0.06)
    sig[int(SR * 0.28) : int(SR * 0.28) + len(hold)] += hold * 0.16
    snap = sweep_noise(0.02, 8000, 9000, 0.7, seed=41)
    sig[int(SR * 0.58) : int(SR * 0.58) + len(snap)] += snap * 2.0
    return finish(sig, peak=0.82)


def sfx_invisibility() -> np.ndarray:
    total = 0.9
    sig = np.zeros(int(SR * total))
    # detuned high sines dissolving — the shape of you coming apart
    for i, f in enumerate([1046.5, 1051.5, 1318.5, 1324.0]):
        sig += bell(f, 0.75, 0.34, 0.04 + i * 0.07, total) * 0.3
    # the hush that swallows them
    hush = sweep_noise(0.6, 6500, 2400, 0.8, seed=43) * adsr(int(SR * 0.6), 0.2, 0.35)
    sig[int(SR * 0.28) : int(SR * 0.28) + len(hush)] += hush * 0.3
    return finish(sig * 0.8)


def sfx_curse() -> np.ndarray:
    total = 0.95
    sig = np.zeros(int(SR * total))
    # a low drone, soured by its own minor second
    drone = (gliss(138.6, 110.0, total, 1.4) + 0.7 * gliss(146.8, 116.5, total, 1.4)) * adsr(int(SR * total), 0.1, 0.4)
    sig += drone * 0.34
    # something wraps around the throat: a slow descending wheeze
    wheeze = sweep_noise(0.5, 1200, 500, 1.5, seed=47) * np.exp(-t(0.5) / 0.3)
    sig[int(SR * 0.3) : int(SR * 0.3) + len(wheeze)] += wheeze * 0.4
    sig = np.tanh(sig * 1.2)
    return finish(sig, peak=0.8)


def sfx_thornsnare() -> np.ndarray:
    total = 0.8
    sig = np.zeros(int(SR * total))
    # the briar whips up: a fibrous rising scratch
    scratch = sweep_noise(0.3, 700, 2600, 1.6, seed=53) * adsr(int(SR * 0.3), 0.03, 0.1)
    sig[: len(scratch)] += scratch * 0.8
    # woody snaps as the coils cinch
    for onset, f0 in [(0.18, 900.0), (0.3, 700.0), (0.44, 520.0)]:
        snap = sweep_noise(0.03, f0 * 3, f0 * 2, 0.9, seed=int(f0)) * 2.2
        start = int(SR * onset)
        sig[start : start + len(snap)] += snap
        knock = gliss(f0, f0 * 0.6, 0.06, 1.3) * np.exp(-t(0.06) / 0.025)
        sig[start : start + len(knock)] += knock * 0.6
    # and the prickles keep biting
    prickle = sweep_noise(0.25, 4000, 5200, 2.0, seed=59) * adsr(int(SR * 0.25), 0.02, 0.12)
    sig[int(SR * 0.5) : int(SR * 0.5) + len(prickle)] += prickle * 0.2
    return finish(sig, peak=0.8)


def sfx_ironwood() -> np.ndarray:
    total = 1.0
    sig = np.zeros(int(SR * total))
    # a deep wooden knock, then the grain settling
    knock = gliss(196.0, 98.0, 0.12, 1.5) * np.exp(-t(0.12) / 0.04)
    sig[: len(knock)] += knock * 1.1
    body = (gliss(130.8, 123.5, 0.7) + 0.5 * gliss(196.0, 185.0, 0.7)) * adsr(int(SR * 0.7), 0.02, 0.35)
    sig[int(SR * 0.08) : int(SR * 0.08) + len(body)] += body * 0.3
    grain = sweep_noise(0.6, 900, 500, 1.2, seed=61) * np.exp(-t(0.6) / 0.35)
    sig[int(SR * 0.12) : int(SR * 0.12) + len(grain)] += grain * 0.25
    sig = np.tanh(sig * 1.1)
    return finish(sig, peak=0.78)


def sfx_leech() -> np.ndarray:
    total = 0.8
    sig = np.zeros(int(SR * total))
    # a wet attach, then the slow draw downward
    attach = sweep_noise(0.06, 900, 500, 1.0, seed=67) * 1.8
    sig[: len(attach)] += attach
    draw = sweep_noise(0.45, 1400, 300, 1.1, seed=71) * adsr(int(SR * 0.45), 0.08, 0.2)
    sig[int(SR * 0.1) : int(SR * 0.1) + len(draw)] += draw * 0.5
    pulse = gliss(70.0, 55.0, 0.55) * (1 + 0.5 * np.sin(2 * np.pi * 4 * t(0.55))) * np.exp(-t(0.55) / 0.3)
    sig[int(SR * 0.12) : int(SR * 0.12) + len(pulse)] += pulse * 0.5
    sig = np.tanh(sig * 1.15)
    return finish(sig, peak=0.78)


def sfx_flash() -> np.ndarray:
    total = 0.65
    sig = np.zeros(int(SR * total))
    # the white snap: instant broadband burst
    snap = noise(int(SR * 0.03), seed=73) * 2.6
    sig[: len(snap)] += snap * np.linspace(1, 0.2, len(snap))
    # the high ring your ears keep after
    ring = (gliss(5200.0, 5100.0, 0.45) + 0.4 * gliss(7800.0, 7600.0, 0.45)) * np.exp(-t(0.45) / 0.18)
    sig[int(SR * 0.03) : int(SR * 0.03) + len(ring)] += ring * 0.28
    return finish(sig, peak=0.75)


def sfx_fireblast() -> np.ndarray:
    total = 0.9
    sig = np.zeros(int(SR * total))
    # the ground thump, then the ring of fire rolling outward
    thump = gliss(120.0, 40.0, 0.18, 1.3) * np.exp(-t(0.18) / 0.07)
    sig[: len(thump)] += thump * 1.2
    roar = sweep_noise(0.6, 1800, 300, 0.6, seed=79) * adsr(int(SR * 0.6), 0.02, 0.3)
    sig[int(SR * 0.05) : int(SR * 0.05) + len(roar)] += roar * 0.8
    crackle = noise(int(SR * 0.4), seed=83) * sweep_noise(0.4, 3000, 1500, 0.8, seed=89)
    sig[int(SR * 0.3) : int(SR * 0.3) + len(crackle)] += crackle * 0.12
    sig = np.tanh(sig * 1.2)
    return finish(sig, peak=0.75)


def sfx_blizzard() -> np.ndarray:
    total = 1.1
    sig = np.zeros(int(SR * total))
    # the front arrives: a low howl climbing into wind
    howl = sweep_noise(total, 300, 1800, 0.7, seed=97) * adsr(int(SR * total), 0.25, 0.4)
    sig += howl * 0.55
    gust = sweep_noise(0.4, 900, 2400, 1.0, seed=101) * np.sin(np.pi * np.clip(t(0.4) / 0.4, 0, 1)) ** 1.2
    sig[int(SR * 0.45) : int(SR * 0.45) + len(gust)] += gust * 0.4
    # ice crystals: a scatter of high cold chimes
    for i, f in enumerate([2093.0, 2637.0, 3136.0, 3729.0]):
        sig += bell(f, 0.5, 0.22, 0.12 + i * 0.11, total) * 0.22
    return finish(sig * 0.9)


def sfx_chainlightning() -> np.ndarray:
    total = 0.7
    sig = np.zeros(int(SR * total))
    # the first crack — same sky as lightning
    snap = sweep_noise(0.025, 7500, 9000, 0.6, seed=103)
    sig[: len(snap)] += snap * 3.0
    fry = sweep_noise(0.18, 8000, 900, 0.9, seed=107) * np.exp(-t(0.18) / 0.08)
    sig[int(SR * 0.02) : int(SR * 0.02) + len(fry)] += fry * 1.0
    # the arcs: two weaker cracks chasing after
    for onset, amp in [(0.24, 1.6), (0.42, 1.0)]:
        arc = sweep_noise(0.02, 6500, 8000, 0.7, seed=int(onset * 1000))
        start = int(SR * onset)
        sig[start : start + len(arc)] += arc * amp
        tail = sweep_noise(0.1, 5000, 1200, 1.0, seed=int(onset * 2000)) * np.exp(-t(0.1) / 0.05)
        sig[start + int(SR * 0.02) : start + int(SR * 0.02) + len(tail)] += tail * 0.5
    sig = np.tanh(sig * 1.1)
    return finish(sig, peak=0.76)


def sfx_sleep() -> np.ndarray:
    total = 1.1
    sig = np.zeros(int(SR * total))
    # a small lullaby, descending — bells losing their grip
    for i, f in enumerate([784.0, 659.3, 587.3, 523.3]):
        sig += bell(f, 0.9, 0.4, 0.08 + i * 0.18, total) * (0.4 - i * 0.07)
    # the hush that tucks it in
    hush = sweep_noise(0.7, 3000, 800, 0.8, seed=109) * adsr(int(SR * 0.7), 0.25, 0.35)
    sig[int(SR * 0.35) : int(SR * 0.35) + len(hush)] += hush * 0.18
    return finish(sig * 0.85)


def sfx_meteor() -> np.ndarray:
    total = 1.4
    sig = np.zeros(int(SR * total))
    # the whistle of the fall, long and dropping
    whistle = gliss(2600.0, 300.0, 0.6, 1.2) * adsr(int(SR * 0.6), 0.05, 0.05)
    sig[: len(whistle)] += whistle * 0.5
    # the impact: sub boom + earth roar
    boom = gliss(90.0, 32.0, 0.7, 1.4) * np.exp(-t(0.7) / 0.35)
    sig[int(SR * 0.55) : int(SR * 0.55) + len(boom)] += boom * 1.2
    roar = sweep_noise(0.65, 1200, 200, 0.5, seed=113) * np.exp(-t(0.65) / 0.35)
    sig[int(SR * 0.58) : int(SR * 0.58) + len(roar)] += roar * 0.9
    # the scatter of falling debris
    for onset in [0.75, 0.85, 0.98, 1.12]:
        debris = sweep_noise(0.04, 2000, 800, 1.0, seed=int(onset * 500)) * 0.8
        start = int(SR * onset)
        sig[start : start + len(debris)] += debris
    sig = np.tanh(sig * 1.25)
    return finish(sig, peak=0.78)


SPELLS = {
    "spell-nightsight": sfx_nightsight,
    "spell-heal": sfx_heal,
    "spell-magicarrow": sfx_magicarrow,
    "spell-fireball": sfx_fireball,
    "spell-teleport": sfx_teleport,
    "spell-mark": sfx_mark,
    "spell-recall": sfx_recall,
    "spell-cure": sfx_cure,
    "spell-poison": sfx_poison,
    "spell-bless": sfx_bless,
    "spell-lightning": sfx_lightning,
    "spell-summon": sfx_summon,
    "spell-paralyze": sfx_paralyze,
    "spell-invisibility": sfx_invisibility,
    "spell-curse": sfx_curse,
    "spell-thornsnare": sfx_thornsnare,
    "spell-ironwood": sfx_ironwood,
    "spell-leech": sfx_leech,
    "spell-flash": sfx_flash,
    "spell-fireblast": sfx_fireblast,
    "spell-blizzard": sfx_blizzard,
    "spell-chainlightning": sfx_chainlightning,
    "spell-sleep": sfx_sleep,
    "spell-meteor": sfx_meteor,
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for name, fn in SPELLS.items():
            save_mp3(name, fn(), tmp)
    print("done")
