"""Deterministic original offline SFX. ffmpeg/libmp3lame required, no downloads.
Prefer orchestrator WAVs in public/audio/sfx/raw/<output-name>.wav when present.
Bed is a periodic harmonic field with matching endpoints, encoded with gapless metadata.
"""
import array
import math
import pathlib
import random
import subprocess
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/audio/sfx'
WORK = ROOT / 'art/audio-synthesis'
WORK.mkdir(parents=True, exist_ok=True)
RATE = 22050
TAU = math.tau

def render(name, duration, family, event):
    raw = OUT / 'raw' / (name + '.wav')
    generated = WORK / (name + '.wav')
    if raw.exists():
        source = raw
    else:
        rng = random.Random(name)
        n = round(duration * RATE)
        values = []
        low = 0.0
        phase = 0.0
        harmonics = [(rng.randrange(220, 3200), rng.random()*TAU, rng.uniform(.003, .009)) for _ in range(32)]
        for i in range(n):
            t = i/RATE
            u = i/(n-1)
            noise = rng.uniform(-1, 1)
            low += .045*(noise-low)
            if family == 'bed':
                # All frequencies are integer multiples of 1/duration: no join click.
                value = .13*math.sin(TAU*47*t)+.08*math.sin(TAU*71*t)
                value += sum(a*math.sin(TAU*k*t/duration+p) for k,p,a in harmonics)
                value *= .72+.15*math.sin(TAU*t/duration)+.1*math.sin(TAU*3*t/duration)
            else:
                env = min(1,t/.025)*min(1,(duration-t)/.12)*math.exp(-u*(1.2 if event=='death' else 2))
                if family == 'golem' or family == 'door':
                    freq = (72 if family=='golem' else 42)*(1-.5*u)
                    phase += TAU*freq/RATE
                    grit = noise*.16*(.3+.7*max(0,math.sin(TAU*(17 if event=='attack' else 9)*t)))
                    value = (.24*math.sin(phase)+low*1.5+grit)*env
                    if event=='death': value *= .35+.65*abs(math.sin(TAU*6*t))
                elif family == 'crawler':
                    freq = (1150 if event=='hit' else 760)*(1+.25*math.sin(TAU*13*t)-.45*u)
                    phase += TAU*freq/RATE
                    pulse = max(0,math.sin(TAU*(23 if event=='aggro' else 14)*t))**2
                    value = (.22*math.sin(phase)+noise*.13)*pulse*env
                else:
                    freq = (390 if event=='hit' else 230)*(1-.5*u)+12*math.sin(TAU*5*t)
                    phase += TAU*freq/RATE
                    value = (.19*math.sin(phase)+.07*math.sin(phase*2.01)+low*.6)*env
            values.append(value)
        if family != 'bed':
            # Low-level short reflections; no abrupt tail cutoff.
            for delay,gain in [(round(.071*RATE),.19),(round(.133*RATE),.12)]:
                for i in range(n-1,delay,-1): values[i] += values[i-delay]*gain*min(1,(n-i)/(.1*RATE))
        pcm = array.array('h',(round(max(-.9,min(.9,v))*32767) for v in values))
        with wave.open(str(generated),'wb') as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(RATE); f.writeframes(pcm.tobytes())
        source = generated
    dest = OUT/(name+'.mp3')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-ac','1','-ar',str(RATE),'-codec:a','libmp3lame','-b:a','48k',str(dest)],check=True)
    assert 0 < dest.stat().st_size < 200000
    print(f'{name}: {dest.stat().st_size} bytes ({"provided" if raw.exists() else "original synth"})')
    if generated.exists(): generated.unlink()

for kind,family in [('slag-golem','golem'),('embercrawler','crawler'),('gloomwraith','wraith')]:
    for event,seconds in [('aggro',1.15),('attack',.65),('hit',.38),('death',1.8)]: render(f'{kind}-{event}',seconds,family,event)
render('emberdeep-door',2.6,'door','death')
render('emberdeep-ambience',16,'bed','loop')
