import { createFileRoute } from "@tanstack/react-router";
import { Hud } from "@/components/game/hud";
import { WorldScene } from "@/components/game/world-scene";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <WorldScene />
      <Hud />
    </main>
  );
}
