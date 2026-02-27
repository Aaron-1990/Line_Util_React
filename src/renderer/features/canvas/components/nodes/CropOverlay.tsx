// ============================================
// CROP OVERLAY
// PowerPoint-style 8-handle crop UI for layout images
// Phase 8.5c: Non-destructive image crop
//
// Coordinate system:
//   All crop values are in ORIGINAL IMAGE pixel space.
//   Conversion: displayPx = imagePx * (nodeSize / originalSize)
//
// Rules:
//   - All mouse events call e.stopPropagation() to prevent RF drag/selection
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
  /** CSS position relative to crop rect */
  style: React.CSSProperties;
  cursor: string;
}

interface CropOverlayProps {
  /** Current crop rect in image pixel coordinates */
  crop: CropRect;
  /** Node display dimensions (px on screen, pre-zoom) */
  nodeWidth: number;
  nodeHeight: number;
  /** Original image dimensions in pixels */
  originalWidth: number;
  originalHeight: number;
  /** Called on every drag tick (live preview) */
  onCropChange: (crop: CropRect) => void;
  /** Called on mouseup (persist to store) */
  onCropEnd: (crop: CropRect) => void;
  /** Exit crop mode */
  onExit: () => void;
}

// ---- Constants ----

const HANDLE_SIZE = 8;
const MIN_CROP_PX = 20; // minimum crop dimension in image pixels

// ---- Handle definitions ----
// Positions are relative to the crop rect border

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
  nodeWidth,
  nodeHeight,
  originalWidth,
  originalHeight,
  onCropChange,
  onCropEnd,
  onExit,
}) => {
  const { getViewport } = useReactFlow();

  // Refs to avoid stale closures in document mouse handlers
  const dragRef = useRef<{
    handle: HandleId;
    startMouseX: number;
    startMouseY: number;
    startCrop: CropRect;
  } | null>(null);

  const cropRef = useRef<CropRect>(crop);
  cropRef.current = crop;

  // ---- Conversion helpers ----

  const scaleX = nodeWidth / originalWidth;   // display px per image px (X)
  const scaleY = nodeHeight / originalHeight; // display px per image px (Y)

  // Convert image pixels -> display pixels
  const toDisplayX = (imgPx: number) => imgPx * scaleX;
  const toDisplayY = (imgPx: number) => imgPx * scaleY;

  // ---- Constraint helper ----

  const constrainCrop = useCallback((c: CropRect): CropRect => {
    let { cropX, cropY, cropW, cropH } = c;

    cropX = Math.max(0, cropX);
    cropY = Math.max(0, cropY);
    cropW = Math.max(MIN_CROP_PX, cropW);
    cropH = Math.max(MIN_CROP_PX, cropH);

    if (cropX + cropW > originalWidth)  cropW = originalWidth - cropX;
    if (cropY + cropH > originalHeight) cropH = originalHeight - cropY;
    if (cropW < MIN_CROP_PX) { cropX = Math.max(0, originalWidth - MIN_CROP_PX); cropW = MIN_CROP_PX; }
    if (cropH < MIN_CROP_PX) { cropY = Math.max(0, originalHeight - MIN_CROP_PX); cropH = MIN_CROP_PX; }

    return { cropX, cropY, cropW, cropH };
  }, [originalWidth, originalHeight]);

  // ---- Mouse down on a handle ----

  const handleMouseDown = useCallback((e: React.MouseEvent, handleId: HandleId) => {
    e.stopPropagation();
    e.preventDefault();

    dragRef.current = {
      handle: handleId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startCrop: { ...cropRef.current },
    };
  }, []);

  // ---- Document mouse move ----

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;

      const { handle, startMouseX, startMouseY, startCrop } = dragRef.current;
      const zoom = getViewport().zoom;

      // Delta in screen pixels → convert to image pixels
      const dxScreen = e.clientX - startMouseX;
      const dyScreen = e.clientY - startMouseY;
      const dxImg = dxScreen / (scaleX * zoom);
      const dyImg = dyScreen / (scaleY * zoom);

      let { cropX, cropY, cropW, cropH } = startCrop;

      switch (handle) {
        case 'top-left':
          cropX += dxImg; cropW -= dxImg;
          cropY += dyImg; cropH -= dyImg;
          break;
        case 'top':
          cropY += dyImg; cropH -= dyImg;
          break;
        case 'top-right':
          cropW += dxImg;
          cropY += dyImg; cropH -= dyImg;
          break;
        case 'right':
          cropW += dxImg;
          break;
        case 'bottom-right':
          cropW += dxImg;
          cropH += dyImg;
          break;
        case 'bottom':
          cropH += dyImg;
          break;
        case 'bottom-left':
          cropX += dxImg; cropW -= dxImg;
          cropH += dyImg;
          break;
        case 'left':
          cropX += dxImg; cropW -= dxImg;
          break;
      }

      const next = constrainCrop({ cropX, cropY, cropW, cropH });
      onCropChange(next);
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      onCropEnd(cropRef.current);
      dragRef.current = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [scaleX, scaleY, constrainCrop, onCropChange, onCropEnd, getViewport]);

  // ---- Escape key: commit current crop and exit ----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCropEnd(cropRef.current);
        onExit();
      }
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onCropEnd, onExit]);

  // ---- Derived display coords ----

  const dispX = toDisplayX(crop.cropX);
  const dispY = toDisplayY(crop.cropY);
  const dispW = toDisplayX(crop.cropW);
  const dispH = toDisplayY(crop.cropH);

  // ---- Render ----

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none', // Overlay itself is transparent; handles are interactive
        zIndex: 20,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Dark mask: top */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: dispY,
          background: 'rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      {/* Dark mask: bottom */}
      <div
        style={{
          position: 'absolute',
          top: dispY + dispH, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      {/* Dark mask: left (between top and bottom masks) */}
      <div
        style={{
          position: 'absolute',
          top: dispY, left: 0,
          width: dispX,
          height: dispH,
          background: 'rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      {/* Dark mask: right */}
      <div
        style={{
          position: 'absolute',
          top: dispY,
          left: dispX + dispW,
          right: 0,
          height: dispH,
          background: 'rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />

      {/* Crop rect: dashed blue border + 8 handles */}
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
            onMouseDown={(e) => handleMouseDown(e, id)}
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
