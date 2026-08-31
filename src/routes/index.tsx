import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Hud } from "@/components/game/hud";
import { IntroCinematic } from "@/components/game/intro-cinematic";
import { LookGump } from "@/components/game/look-gump";
import { WorldScene } from "@/components/game/world-scene";

export const Route = createFileRoute("/")({
  component: Home,
});

// look-lane preview wiring — ?intro=1 and ?look=1 mount the new surfaces for
// verification. At merge this file learns the real boot order (fresh save →
// intro → looking glass → playing) gated on the crafting plan's Tasks 0–3.
function Home() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [showIntro, setShowIntro] = useState(() => Boolean(params?.has("intro")));
  const [showLook, setShowLook] = useState(() => Boolean(params?.has("look")));
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <WorldScene />
      <Hud />
      {showIntro && <IntroCinematic onDone={() => setShowIntro(false)} />}
      {showLook && (
        <LookGump
          onDone={(choice) => {
            console.log("[looking-glass]", JSON.stringify(choice));
            setShowLook(false);
          }}
        />
      )}
    </main>
  );
}
