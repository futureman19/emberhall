import { CROP_META } from "@/game/farm";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import { hitAt, hoverAt, leftAt, liftAt } from "@/game/world-pointer";
import type { CropPlot } from "@/game/types";

function Plant({ plot }: { plot: CropPlot }) {
  const y = groundY(getWorld(), plot.tx, plot.ty);
  const intent = useGame((s) => s.snap.player.intent);
  const marked =
    (intent.kind === "plant" || intent.kind === "harvest") && intent.tx === plot.tx && intent.ty === plot.ty;
  const stage = plot.stage;
  const crop = plot.crop;
  const h = stage <= 1 ? 0.18 : stage === 2 ? 0.38 : 0.62;
  const w = crop === "wheat" ? 0.12 : crop === "garlic" ? 0.22 : 0.32;
  const color = crop ? (marked ? "#e0b56a" : stage >= 3 ? CROP_META[crop].ripe : CROP_META[crop].color) : "#4a3424";
  return (
    <group
      position={[plot.tx, y, plot.ty]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 2) hitAt(plot.tx, plot.ty, e.clientX, e.clientY);
        else if (e.button === 0) leftAt(plot.tx, plot.ty);
      }}
      onPointerMove={() => hoverAt(plot.tx, plot.ty)}
      onPointerUp={(e) => {
        if (e.button === 0) liftAt(plot.tx, plot.ty);
      }}
    >
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[0.78, 0.1, 0.78]} />
        <meshStandardMaterial color={marked ? "#6a4a28" : "#4a3424"} roughness={0.96} />
      </mesh>
      {crop && stage > 0 && (
        <>
          <mesh position={[0, 0.1 + h * 0.5, 0]} castShadow>
            <boxGeometry args={[w, h, crop === "wheat" ? 0.12 : w]} />
            <meshStandardMaterial color={color} roughness={0.82} />
          </mesh>
          {crop === "cabbage" && stage >= 2 && (
            <mesh position={[0, 0.12 + h, 0]} castShadow>
              <boxGeometry args={[w * 1.15, 0.14, w * 1.15]} />
              <meshStandardMaterial color={stage >= 3 ? "#7a9a50" : "#5a7040"} roughness={0.78} />
            </mesh>
          )}
          {crop === "wheat" && stage >= 2 && (
            <>
              <mesh position={[-0.14, 0.1 + h * 0.55, 0.08]} castShadow>
                <boxGeometry args={[0.08, h * 0.9, 0.08]} />
                <meshStandardMaterial color={color} roughness={0.9} />
              </mesh>
              <mesh position={[0.12, 0.1 + h * 0.45, -0.1]} castShadow>
                <boxGeometry args={[0.08, h * 0.8, 0.08]} />
                <meshStandardMaterial color={color} roughness={0.9} />
              </mesh>
            </>
          )}
          {crop === "garlic" && stage >= 3 && (
            <mesh position={[0, 0.14, 0]} castShadow>
              <boxGeometry args={[0.2, 0.16, 0.2]} />
              <meshStandardMaterial color="#ece6d8" roughness={0.7} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

export function Crops() {
  const plots = useGame((s) => s.snap.plots);
  const hour = useGame((s) => s.snap.hour);
  void hour;
  if (!plots?.length) return null;
  return (
    <group>
      {plots.map((p) => (
        <Plant key={p.id} plot={p} />
      ))}
    </group>
  );
}
