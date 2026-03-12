// ============================================
// deriveBounds — Phase 8.5c Phase 2
// ONE-WAY derivation: primary fields → ReactFlow position/size
//
// Primary fields (source of truth):
//   imageOriginX  — canvas X of full uncropped image top-left; changes only on drag
//   imageOriginY  — canvas Y of full uncropped image top-left; changes only on drag
//   imageScale    — CSS px per image px; changes only on resize
//   cropX/Y/W/H   — crop rect in image px; null = no crop; changes only on crop commit
//   originalWidth/originalHeight — immutable; set at import
//
// Derived fields (for ReactFlow node position/size):
//   xPosition = imageOriginX + (cropX ?? 0) * imageScale
//   yPosition = imageOriginY + (cropY ?? 0) * imageScale
//   width     = (cropW ?? originalWidth)  * imageScale
//   height    = (cropH ?? originalHeight) * imageScale
//
// INVARIANT: This function is the ONLY place this derivation is written.
//            NEVER compute these inline elsewhere.
// ============================================

export interface DerivedBounds {
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
}

export interface PrimaryFields {
  imageOriginX: number;
  imageOriginY: number;
  imageScale: number;
  originalWidth: number;
  originalHeight: number;
  cropX: number | null;
  cropY: number | null;
  cropW: number | null;
  cropH: number | null;
}

/**
 * Derives ReactFlow node position and size from the primary geometry fields.
 * Call this whenever any primary field changes (drag, resize, or crop commit).
 */
export function deriveBounds(p: PrimaryFields): DerivedBounds {
  return {
    xPosition: p.imageOriginX + (p.cropX ?? 0) * p.imageScale,
    yPosition: p.imageOriginY + (p.cropY ?? 0) * p.imageScale,
    width:     (p.cropW ?? p.originalWidth)  * p.imageScale,
    height:    (p.cropH ?? p.originalHeight) * p.imageScale,
  };
}
