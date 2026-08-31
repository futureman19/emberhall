import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Hud } from "@/components/game/hud";
import { IntroCinematic } from "@/components/game/intro-cinematic";
import { WorldScene } from "@/components/game/world-scene";
import "@/game/debug";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  // look-lane preview wiring (?intro=1) — at merge, the store's boot order
  // (fresh game → intro → Looking Glass → playing) replaces this block.
  const [showIntro, setShowIntro] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).has("intro")
      : false,
  );
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <WorldScene />
      <Hud />
      {showIntro && <IntroCinematic onDone={() => setShowIntro(false)} />}
    </main>
  );
}
