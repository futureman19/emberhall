/** Presentation only: retained compatibility for existing oak saplings, now worldwide. */
export function usesAuthoredOak(resourceId: string, tx: number, ty: number, ready: boolean) {
  void tx; void ty;
  return ready && resourceId === "oak";
}
