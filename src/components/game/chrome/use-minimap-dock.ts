import { useEffect, useState } from "react";
import { defaultMinimapCollapsed } from "./frame";
import { dockStorage, loadCollapsed, saveCollapsed } from "./minimap-dock";

/** One collapsed flag, shared by the rail toggle and the map block. */
export function useMinimapDock() {
  const [collapsed, setCollapsed] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const fallback = defaultMinimapCollapsed(window.innerWidth);
    const storage = dockStorage();
    setCollapsed(storage ? loadCollapsed(storage, fallback) : fallback);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const storage = dockStorage();
    if (storage) saveCollapsed(storage, collapsed);
  }, [collapsed, ready]);
  return { collapsed, ready, toggle: () => setCollapsed((v) => !v) };
}
