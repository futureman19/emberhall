import { useFrame } from "@react-three/fiber";
import { inGreybarrow } from "@/game/atlas";
import { getWorld } from "@/game/live";
import { rainRate } from "@/game/weather";
import { setRainLevel } from "@/game/vale-sfx";

/** Rain audio remains tied to the simulated rainfall even though the visible
 * drops are rendered as a lightweight screen-space layer outside Three.js. */
function WeatherAudio() {
  useFrame(() => {
    const world = getWorld();
    const player = world.people.find((person) => person.isPlayer);
    const underground = Boolean(player && inGreybarrow(Math.round(player.x), Math.round(player.z)));
    setRainLevel(underground ? 0 : rainRate(world));
  });
  return null;
}

export function WeatherFx() {
  return <WeatherAudio />;
}
