import { useMemo, type ReactNode } from "react";
import { RowanContext, useRowanGeometry } from "./rowan-character-context.ts";

/** Scope Rowan to player/creator only; NPCs retain the existing authored pipeline. */
export function RowanCharacterProvider({ enabled = true, skin, hair, ghost = false, children }: {
  enabled?: boolean; skin: string; hair: string; ghost?: boolean; children: ReactNode;
}) {
  const geometry = useRowanGeometry(enabled);
  const value = useMemo(() => ({ geometry, skin, hair, ghost }), [geometry, skin, hair, ghost]);
  return <RowanContext.Provider value={value}>{children}</RowanContext.Provider>;
}
