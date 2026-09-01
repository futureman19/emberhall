import { inGreybarrow } from "@/game/atlas";
import { useGame } from "@/game/store";
import { WEATHER_META } from "@/game/weather";

/**
 * View-only rain: two composited CSS layers replace hundreds of world-space
 * drop matrices. Weather simulation, wetness, sound and gameplay remain in the
 * world model; this component only paints the player's viewport.
 */
export function ScreenRain() {
  const phase = useGame((state) => state.phase);
  const kind = useGame((state) => state.snap.weather.kind);
  const cloud = useGame((state) => state.snap.weather.cloud);
  const x = useGame((state) => state.snap.youX);
  const z = useGame((state) => state.snap.youZ);
  const target = WEATHER_META[kind].rain;
  const cover = Math.max(0, Math.min(1, (cloud - 0.55) / 0.4));
  const underground = inGreybarrow(Math.round(x), Math.round(z));
  const rain = phase === "playing" && !underground ? target * cover : 0;
  const active = rain > 0.03;

  return (
    <div
      data-testid="screen-rain"
      data-active={active ? "true" : "false"}
      className="ember-screen-rain pointer-events-none absolute inset-0 z-20"
      style={{ opacity: Math.min(0.68, rain * 0.68) }}
      aria-hidden
    >
      <span className="ember-screen-rain__far absolute inset-0" />
      <span className="ember-screen-rain__near absolute inset-0" />
    </div>
  );
}
