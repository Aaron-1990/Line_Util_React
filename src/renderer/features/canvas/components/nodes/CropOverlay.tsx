// ============================================
// CROP OVERLAY
// PowerPoint-style 8-handle crop UI for layout images
// Phase 8.5c: Non-destructive image crop
// Phase 8.5c Phase 2: imageOriginX/Y + imageScale primary fields
//
// Coordinate system:
//   All crop values are in ORIGINAL IMAGE pixel space.
//   activeArea: where the image renders within the node (display px)
//   imageRange: which portion of the original image activeArea represents
//   Conversion: displayPx = activeArea.origin + (imgPx - imageRange.origin) * scale
//   where scale = activeArea.size / imageRange.size
//
// Event handling (CRITICAL):
//   ReactFlow uses native pointerdown/mousedown listeners on the node wrapper.
//   These fire during DOM bubble — BEFORE React fires synthetic events.
//   Therefore e.stopPropagation() in a React onMouseDown handler is too late.
//
//   Fix: a native mousedown listener on the overlay root (via useEffect) intercepts
//   handle clicks and calls e.stopPropagation() BEFORE the event bubbles to the
//   ReactFlow node wrapper. pointer-events:none on the overlay root does NOT prevent
//   this — that CSS only blocks the element from being the initial target, not from
//   receiving bubbled events or hosting native event listeners.
//
// Rules:
//   - Document-level mousemove/mouseup for smooth drag outside the node
//   - Escape key commits the current crop and exits crop mode
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useReactFlow } from 'reactflow';

// ---- Types ----

export interface CropRect {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

type HandleId =
  | 'top-left' | 'top' | 'top-right'
  | 'right' | 'bottom-right' | 'bottom'
  | 'bottom-left' | 'left';

interface HandleDef {
  id: HandleId;
  style: React.CSSProperties;
  cursor: string;
}

interface CropOverlayProps {
  crop: CropRect;
  activeArea: { x: number; y: number; width: number; height: number };
  imageRange: { x: number; y: number; width: number; height: number };
  onCropChange: (crop: CropRect) => void;
  onCropEnd: (crop: CropRect) => void;
  /** Called on Escape: cancel the session, discard pending changes, restore pre-session crop. */
  onCancel: () => void;
}

// ---- Constants ----

const HANDLE_SIZE = 8;
const MIN_CROP_PX = 20;

// ---- Handle definitions ----

const HANDLES: HandleDef[] = [
  { id: 'top-left',     style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },   cursor: 'nwse-resize' },
  { id: 'top',          style: { top: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'top-right',    style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },   cursor: 'nesw-resize' },
  { id: 'right',        style: { top: '50%', right: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { id: 'bottom-right', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 }, cursor: 'nwse-resize' },
  { id: 'bottom',       style: { bottom: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'bottom-left',  style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 }, cursor: 'nesw-resize' },
  { id: 'left',         style: { top: '50%', left: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
];

// ============================================
// COMPONENT
// ============================================

export const CropOverlay: React.FC<CropOverlayProps> = ({
  crop,
  activeArea,
  imageRange,
  onCropChange,
  onCropEnd,
  onCancel,
}) => {
  const { getViewport } = useReactFlow();

  // Root div ref — used by the native mousedown interceptor below.
  const overlayRef = useRef<HTMLDivElement>(null);

  // Drag state. Set by the native mousedown interceptor, read by document mousemove/mouseup.
  const dragRef = useRef<{
    handle: HandleId;
    startMouseX: number;
    startMouseY: number;
    startCrop: CropRect;
  } | null>(null);

  // Keep crop ref in sync so closures always read the latest value.
  const cropRef = useRef<CropRect>(crop);
  cropRef.current = crop;

  // ---- Conversion helpers ----

  const scaleX = activeArea.width / imageRange.width;
  const scaleY = activeArea.height / imageRange.height;

  const toDisplayX = (imgPx: number) => activeArea.x + (imgPx - imageRange.x) * scaleX;
  const toDisplayY = (imgPx: number) => activeArea.y + (imgPx - imageRange.y) * scaleY;

  // ---- Constraint helper ----

  const constrainCrop = useCallback((c: CropRect): CropRect => {
    const maxX = imageRange.x + imageRange.width;
    const maxY = imageRange.y + imageRange.height;
    let { cropX, cropY, cropW, cropH } = c;

    cropX = Math.max(imageRange.x, cropX);
    cropY = Math.max(imageRange.y, cropY);
    cropW = Math.max(MIN_CROP_PX, cropW);
    cropH = Math.max(MIN_CROP_PX, cropH);

    if (cropX + cropW > maxX) cropW = maxX - cropX;
    if (cropY + cropH > maxY) cropH = maxY - cropY;
    if (cropW < MIN_CROP_PX) { cropX = Math.max(imageRange.x, maxX - MIN_CROP_PX); cropW = MIN_CROP_PX; }
    if (cropH < MIN_CROP_PX) { cropY = Math.max(imageRange.y, maxY - MIN_CROP_PX); cropH = MIN_CROP_PX; }

    return { cropX, cropY, cropW, cropH };
  }, [imageRange.x, imageRange.y, imageRange.width, imageRange.height]);

  // ---- Native mousedown interceptor ----
  //
  // WHY NATIVE (not React synthetic):
  //   ReactFlow registers native pointerdown/mousedown listeners on the node wrapper
  //   element. These fire during DOM bubble, which runs BEFORE React dispatches synthetic
  //   events at the root container. So calling e.stopPropagation() in a React onMouseDown
  //   handler is too late — ReactFlow has already received the event.
  //
  //   This useEffect adds a native mousedown listener to the overlay root div (which sits
  //   INSIDE the ReactFlow node wrapper). Bubbled events from child handles pass through
  //   the overlay root before reaching the node wrapper, so stopPropagation() here
  //   prevents ReactFlow from ever seeing handle mousedown events.
  //
  //   NOTE: pointer-events:none on the overlay root div only prevents it from being the
  //   INITIAL target of pointer events. It does NOT prevent native event listeners on
  //   the element from receiving BUBBLED events from children with pointer-events:auto.

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const onNativeMouseDown = (e: MouseEvent) => {
      // Hit-test: check if the event originated from a crop handle.
      const handleEl = (e.target as HTMLElement).closest('[data-handle-id]') as HTMLElement | null;
      if (!handleEl) return;

      // Stop native propagation here, before the event reaches the ReactFlow node wrapper.
      e.stopPropagation();
      e.preventDefault();

      const handleId = handleEl.dataset.handleId as HandleId;
      dragRef.current = {
        handle: handleId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startCrop: { ...cropRef.current },
      };
    };

    overlay.addEventListener('mousedown', onNativeMouseDown);
    return () => overlay.removeEventListener('mousedown', onNativeMouseDown);
  }, []); // mount once; cropRef.current and dragRef.current are kept fresh via refs

  // ---- Document mouse move / up ----

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;

      const { handle, startMouseX, startMouseY, startCrop } = dragRef.current;
      const zoom = getViewport().zoom;

      const dxImg = (e.clientX - startMouseX) / (scaleX * zoom);
      const dyImg = (e.clientY - startMouseY) / (scaleY * zoom);

      let { cropX, cropY, cropW, cropH } = startCrop;

      switch (handle) {
        case 'top-left':     cropX += dxImg; cropW -= dxImg; cropY += dyImg; cropH -= dyImg; break;
        case 'top':          cropY += dyImg; cropH -= dyImg; break;
        case 'top-right':    cropW += dxImg; cropY += dyImg; cropH -= dyImg; break;
        case 'right':        cropW += dxImg; break;
        case 'bottom-right': cropW += dxImg; cropH += dyImg; break;
        case 'bottom':       cropH += dyImg; break;
        case 'bottom-left':  cropX += dxImg; cropW -= dxImg; cropH += dyImg; break;
        case 'left':         cropX += dxImg; cropW -= dxImg; break;
      }

      const next = constrainCrop({ cropX, cropY, cropW, cropH });
      cropRef.current = next;
      onCropChange(next);
    };

    const onMouseUp = (_e: MouseEvent) => {
      if (!dragRef.current) return;
      const finalCrop = cropRef.current;
      dragRef.current = null;
      onCropEnd(finalCrop);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [scaleX, scaleY, constrainCrop, onCropChange, onCropEnd, getViewport]);

  // ---- Escape key: cancel (discard pending, restore pre-session crop) ----
  // PowerPoint behavior: Escape = cancel, click outside = commit.

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dragRef.current = null; // abort any in-progress drag
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onCancel]);

  // ---- Derived display coords ----

  const dispX = toDisplayX(crop.cropX);
  const dispY = toDisplayY(crop.cropY);
  const dispW = crop.cropW * scaleX;
  const dispH = crop.cropH * scaleY;

  // ---- Render ----

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* Dark mask: top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: dispY, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
      {/* Dark mask: bottom */}
      <div style={{ position: 'absolute', top: dispY + dispH, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
      {/* Dark mask: left */}
      <div style={{ position: 'absolute', top: dispY, left: 0, width: dispX, height: dispH, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
      {/* Dark mask: right */}
      <div style={{ position: 'absolute', top: dispY, left: dispX + dispW, right: 0, height: dispH, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />

      {/* Crop rect with 8 handles */}
      <div
        style={{
          position: 'absolute',
          top: dispY,
          left: dispX,
          width: dispW,
          height: dispH,
          border: '2px dashed #3B82F6',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        {HANDLES.map(({ id, style, cursor }) => (
          <div
            key={id}
            data-handle-id={id}
            style={{
              position: 'absolute',
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              background: '#3B82F6',
              border: '1px solid white',
              borderRadius: 1,
              cursor,
              pointerEvents: 'auto',
              ...style,
            }}
          />
        ))}
      </div>
    </div>
  );
};
