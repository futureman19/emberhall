import { AudioLines, Music2 } from "lucide-react";
import { useState } from "react";
import { musicMuted, toggleValeMusic } from "@/game/vale-music";
import { sfxMuted, toggleSfx } from "@/game/vale-sfx";
import { cn } from "@/lib/utils";

export function SoundToggles({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <MusicToggle />
      <SfxToggle />
    </div>
  );
}

export function MusicToggle() {
  const [mute, setMute] = useState(musicMuted);
  return (
    <button
      type="button"
      onClick={() => setMute(toggleValeMusic())}
      className={cn("grid size-11 place-items-center text-muted", mute && "opacity-40")}
      aria-label={mute ? "Music off" : "Music on"}
      aria-pressed={!mute}
      title={mute ? "Music is still" : "Still the lute"}
    >
      <Music2 className="size-4" />
    </button>
  );
}

export function SfxToggle() {
  const [mute, setMute] = useState(sfxMuted);
  return (
    <button
      type="button"
      onClick={() => setMute(toggleSfx())}
      className={cn("grid size-11 place-items-center text-muted", mute && "opacity-40")}
      aria-label={mute ? "Sounds off" : "Sounds on"}
      aria-pressed={!mute}
      title={mute ? "Work sounds are still" : "Still the chop and the spell"}
    >
      <AudioLines className="size-4" />
    </button>
  );
}
