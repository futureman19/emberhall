/** One scoped touch gesture. No simulation writes; callbacks run only for valid contacts. */
export interface TouchContact {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
}
export interface TouchTile { tx: number; ty: number }
export const TOUCH_HOLD_MS = 550;
export const TOUCH_HOLD_SLOP = 8;

export function createTouchHold(options: {
  schedule: (callback: () => void, ms: number) => number;
  unschedule: (handle: number) => void;
  eligible: (tile: TouchTile) => boolean;
  tap: (tile: TouchTile) => void;
  hold: (tile: TouchTile, point: TouchContact) => void;
}) {
  const contacts = new Set<number>();
  let multi = false;
  let active: { point: TouchContact; tile: TouchTile; held: boolean; timer: number | null } | null = null;
  function clearActive() {
    if (active?.timer != null) options.unschedule(active.timer);
    active = null;
  }
  return {
    trackDown(point: TouchContact) {
      if (point.pointerType !== "touch") return;
      contacts.add(point.pointerId);
      if (contacts.size > 1) { multi = true; clearActive(); }
    },
    begin(point: TouchContact, tile: TouchTile) {
      if (point.pointerType !== "touch" || multi || contacts.size !== 1 || !options.eligible(tile)) return false;
      clearActive();
      const current = { point: { ...point }, tile: { ...tile }, held: false, timer: null as number | null };
      active = current;
      current.timer = options.schedule(() => {
        if (active !== current || current.held) return;
        current.timer = null;
        if (!options.eligible(current.tile)) { clearActive(); return; }
        current.held = true;
        options.hold(current.tile, current.point);
      }, TOUCH_HOLD_MS);
      return true;
    },
    move(point: TouchContact) {
      if (active?.point.pointerId !== point.pointerId) return;
      if (Math.hypot(point.clientX - active.point.clientX, point.clientY - active.point.clientY) > TOUCH_HOLD_SLOP) clearActive();
    },
    end(point: TouchContact) {
      contacts.delete(point.pointerId);
      if (contacts.size === 0) multi = false;
      if (active?.point.pointerId !== point.pointerId) return;
      const current = active;
      clearActive();
      if (!current.held && options.eligible(current.tile)) options.tap(current.tile);
    },
    cancel() { clearActive(); contacts.clear(); multi = false; },
  };
}
