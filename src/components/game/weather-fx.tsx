import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { inGreybarrow } from "@/game/atlas";
import { inEmberdeep } from "@/game/emberdeep";
import { syncDungeonAudio } from "@/game/emberdeep-audio";
import { getWorld } from "@/game/live";
import { rainRate } from "@/game/weather";
import { setRainLevel, setDungeonAmbience } from "@/game/vale-sfx";

/** Environment loops follow the listener even while simulation is paused. */
function WeatherAudio() {
  useEffect(
    () => () => {
      setRainLevel(0);
      setDungeonAmbience(false);
    },
    [],
  );
  useFrame(() => {
    const world = getWorld();
    const player = world.people.find((person) => person.isPlayer);
    const underground = Boolean(
      player &&
      (inGreybarrow(Math.round(player.x), Math.round(player.z)) || inEmberdeep(player.x, player.z)),
    );
    setRainLevel(underground ? 0 : rainRate(world));
    syncDungeonAudio(world);
  });
  return null;
}

export function WeatherFx() {
  return <WeatherAudio />;
}
