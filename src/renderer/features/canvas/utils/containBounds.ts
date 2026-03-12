/**
 * Returns the axis-aligned bounding rect (in container coords) where content
 * would be placed using "object-fit: contain" semantics.
 *
 * Extracted from LayoutImageNode.tsx so it can also be used in useLayoutStore.ts
 * (the store needs it for commitCrop to compute node resize on crop exit).
 */
export function computeContainBounds(
  contentW: number, contentH: number,
  containerW: number, containerH: number
): { x: number; y: number; width: number; height: number } {
  const contentAspect = contentW / contentH;
  const containerAspect = containerW / containerH;
  if (contentAspect > containerAspect) {
    const renderW = containerW;
    const renderH = containerW / contentAspect;
    return { x: 0, y: (containerH - renderH) / 2, width: renderW, height: renderH };
  } else {
    const renderH = containerH;
    const renderW = containerH * contentAspect;
    return { x: (containerW - renderW) / 2, y: 0, width: renderW, height: renderH };
  }
}
