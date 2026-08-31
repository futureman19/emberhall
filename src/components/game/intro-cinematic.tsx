// The intro cinematic — full-screen story cards over the vale's art.
//
// Standalone by contract: no store imports, no save logic. The host wires
// boot order and calls onDone() when the tale finishes (or is skipped).
// look-lane Phase 3; art swaps to commissioned panels by filename only.

import { useCallback, useEffect, useRef, useState } from "react";
import { INTRO_BEATS, type IntroBeat } from "@/game/intro/beats";

type Props = {
  onDone: () => void;
  beats?: IntroBeat[];
};

/** Tiny two-note chime — self-contained, no audio module dependency. */
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    try {
      const Ctor = window.AudioContext;
      ctxRef.current = Ctor ? new Ctor() : null;
    } catch {
      ctxRef.current = null;
    }
    return ctxRef.current;
  }, []);
  const unlock = useCallback(() => void ensure(), [ensure]);
  const chime = useCallback(() => {
    const ctx = ensure();
    if (!ctx || ctx.state === "suspended") return;
    try {
      const t0 = ctx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.035, t0 + i * 0.14 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.14 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + i * 0.14);
        osc.stop(t0 + i * 0.14 + 0.55);
      });
    } catch {
      /* audio is a garnish, never a blocker */
    }
  }, [ensure]);
  return { unlock, chime };
}

export function IntroCinematic({ onDone, beats = INTRO_BEATS }: Props) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const { unlock, chime } = useChime();
  const beat = beats[index]!;
  const last = index === beats.length - 1;

  // Preload every panel so cross-fades never stutter.
  useEffect(() => {
    for (const b of beats) {
      const img = new Image();
      img.src = b.art;
    }
  }, [beats]);

  // Clear the outgoing layer after its fade.
  useEffect(() => {
    if (leaving === null) return;
    const t = window.setTimeout(() => setLeaving(null), 700);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const advance = useCallback(() => {
    unlock();
    if (last) {
      onDone();
      return;
    }
    chime();
    setLeaving(index);
    setIndex(index + 1);
  }, [unlock, last, onDone, chime, index]);

  const skip = useCallback(() => {
    unlock();
    onDone();
  }, [unlock, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, skip]);

  return (
    <div
      data-testid="intro-cinematic"
      className="fixed inset-0 z-[90] cursor-pointer select-none bg-black"
      onClick={advance}
      role="button"
      aria-label="Continue the story"
    >
      <style>{`
        @keyframes introDrift { from { transform: scale(1.02) translateX(-0.6%); } to { transform: scale(1.1) translateX(0.6%); } }
        @keyframes introFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .intro-art { animation: introDrift 14s ease-in-out infinite alternate; }
        .intro-art.in { animation: introDrift 14s ease-in-out infinite alternate, introFadeIn 700ms ease-out both; }
        @media (prefers-reduced-motion: reduce) { .intro-art, .intro-art.in { animation: none; } }
      `}</style>

      {/* outgoing layer: stays visible while the new one fades in over it */}
      {leaving !== null && beats[leaving] && (
        <img
          key={`out-${leaving}`}
          src={beats[leaving]!.art}
          alt=""
          className="intro-art absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* current layer: drifts + fades in (re-mounts per beat via key) */}
      <img
        key={`in-${index}`}
        src={beat.art}
        alt=""
        className="intro-art in absolute inset-0 h-full w-full object-cover"
      />

      {/* legibility scrims: top for title, bottom for text */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      {/* story text */}
      <div className="pointer-events-none absolute inset-x-0 top-[8%] flex flex-col items-center px-6 text-center">
        <h2
          key={`t-${index}`}
          className="font-serif text-3xl tracking-wide text-[#ece6d8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] md:text-5xl"
        >
          {beat.title}
        </h2>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[12%] flex justify-center px-6">
        <p
          key={`x-${index}`}
          className="max-w-xl text-center font-serif text-base leading-relaxed text-[#ece6d8] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] md:text-lg"
        >
          {beat.text}
        </p>
      </div>

      {/* progress dots */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center gap-2">
        {beats.map((b, i) => (
          <span
            key={b.id}
            className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-[#e8b96a]" : "bg-[#ece6d8]/40"}`}
          />
        ))}
      </div>

      {/* final call to action */}
      {last && beat.cta && (
        <div className="absolute inset-x-0 bottom-[20%] flex justify-center">
          <button
            data-testid="intro-cta"
            onClick={(e) => {
              e.stopPropagation();
              advance();
            }}
            className="pointer-events-auto rounded border border-[#e8b96a]/70 bg-black/50 px-6 py-2 font-serif text-lg text-[#e8b96a] shadow-[0_0_24px_rgba(232,185,106,0.25)] transition-colors hover:bg-[#e8b96a]/20"
          >
            {beat.cta}
          </button>
        </div>
      )}

      {/* skip */}
      <button
        data-testid="intro-skip"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
        className="absolute right-4 top-4 rounded bg-black/40 px-3 py-1 text-sm text-[#ece6d8]/70 transition-colors hover:text-[#ece6d8]"
      >
        Skip
      </button>
    </div>
  );
}
