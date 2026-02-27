// ============================================
// LAYOUT PROPERTIES PANEL
// Properties panel for selected layout images
// Phase 8.5: Canvas Background Layouts
// Phase 8.5b: Added rotation, W/H inputs, aspect ratio lock, reset buttons
// ============================================

import { memo, useState, useCallback, useEffect } from 'react';
import {
  X, Lock, Unlock, Eye, EyeOff, Trash2, Image,
  Link, Unlink, RotateCcw, Crop, Check,
} from 'lucide-react';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useCanvasStore } from '../../store/useCanvasStore';

interface LayoutPropertiesPanelProps {
  layoutId: string;
}

const ROTATION_PRESETS = [0, 90, 180, 270] as const;

const MIN_DIM = 50;
const MAX_DIM = 10000;

/** Normalize degrees to [0, 359] */
function normalizeDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** Clamp and round a dimension value */
function clampDim(v: number): number {
  return Math.round(Math.max(MIN_DIM, Math.min(MAX_DIM, v)));
}

/**
 * Properties panel shown when a layout image node is selected.
 * Sections: Identity, Dimensions, Rotation, Appearance, Controls.
 *
 * Hook Chain Audit PASS: all hooks declared before any early returns.
 */
export const LayoutPropertiesPanel = memo(({ layoutId }: LayoutPropertiesPanelProps) => {
  // ---- All hooks BEFORE any early returns ----
  const layout = useLayoutStore((state) => state.layouts.find((l) => l.id === layoutId));
  const updateLayout = useLayoutStore((state) => state.updateLayout);
  const toggleLock = useLayoutStore((state) => state.toggleLock);
  const toggleVisibility = useLayoutStore((state) => state.toggleVisibility);
  const toggleAspectRatioLock = useLayoutStore((state) => state.toggleAspectRatioLock);
  const deleteLayout = useLayoutStore((state) => state.deleteLayout);
  const setSelectedNode = useCanvasStore((state) => state.setSelectedNode);
  const cropModeLayoutId = useLayoutStore((state) => state.cropModeLayoutId);
  const setCropMode = useLayoutStore((state) => state.setCropMode);
  const resetCrop = useLayoutStore((state) => state.resetCrop);

  // Local string state for editable inputs (avoids fighting with store on each keystroke)
  const [nameValue, setNameValue] = useState(layout?.name ?? '');
  const [widthInput, setWidthInput] = useState(String(Math.round(layout?.width ?? 800)));
  const [heightInput, setHeightInput] = useState(String(Math.round(layout?.height ?? 600)));
  const [rotationInput, setRotationInput] = useState(String(layout?.rotation ?? 0));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync local inputs when the store value changes from external sources
  // (e.g., NodeResizer drag, programmatic update)
  useEffect(() => {
    if (!layout) return;
    setNameValue(layout.name);
    setWidthInput(String(Math.round(layout.width)));
    setHeightInput(String(Math.round(layout.height)));
    setRotationInput(String(layout.rotation));
  }, [layout?.width, layout?.height, layout?.rotation, layout?.name]);

  // ---- Callbacks ----

  const handleClose = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleNameBlur = useCallback(() => {
    if (layout && nameValue.trim() && nameValue.trim() !== layout.name) {
      updateLayout(layoutId, { name: nameValue.trim() });
    } else if (layout) {
      setNameValue(layout.name);
    }
  }, [layoutId, layout, nameValue, updateLayout]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') {
        setNameValue(layout?.name ?? '');
        e.currentTarget.blur();
      }
    },
    [layout?.name]
  );

  const handleWidthCommit = useCallback(() => {
    if (!layout) return;
    const parsed = parseFloat(widthInput);
    if (isNaN(parsed)) {
      setWidthInput(String(Math.round(layout.width)));
      return;
    }
    const newW = clampDim(parsed);
    if (layout.aspectRatioLocked && layout.originalWidth > 0) {
      const ratio = layout.originalHeight / layout.originalWidth;
      const newH = clampDim(newW * ratio);
      setWidthInput(String(newW));
      setHeightInput(String(newH));
      updateLayout(layoutId, { width: newW, height: newH });
    } else {
      setWidthInput(String(newW));
      updateLayout(layoutId, { width: newW });
    }
  }, [layoutId, layout, widthInput, updateLayout]);

  const handleHeightCommit = useCallback(() => {
    if (!layout) return;
    const parsed = parseFloat(heightInput);
    if (isNaN(parsed)) {
      setHeightInput(String(Math.round(layout.height)));
      return;
    }
    const newH = clampDim(parsed);
    if (layout.aspectRatioLocked && layout.originalHeight > 0) {
      const ratio = layout.originalWidth / layout.originalHeight;
      const newW = clampDim(newH * ratio);
      setWidthInput(String(newW));
      setHeightInput(String(newH));
      updateLayout(layoutId, { width: newW, height: newH });
    } else {
      setHeightInput(String(newH));
      updateLayout(layoutId, { height: newH });
    }
  }, [layoutId, layout, heightInput, updateLayout]);

  const handleDimKeyDown = useCallback(
    (commit: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.currentTarget.blur(); commit(); }
      if (e.key === 'Escape') e.currentTarget.blur();
    },
    []
  );

  const handleRotationCommit = useCallback(() => {
    if (!layout) return;
    const parsed = parseFloat(rotationInput);
    if (isNaN(parsed)) {
      setRotationInput(String(layout.rotation));
      return;
    }
    const normalized = normalizeDeg(parsed);
    setRotationInput(String(normalized));
    updateLayout(layoutId, { rotation: normalized });
  }, [layoutId, layout, rotationInput, updateLayout]);

  const handleRotationKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.currentTarget.blur(); handleRotationCommit(); }
      if (e.key === 'Escape') {
        setRotationInput(String(layout?.rotation ?? 0));
        e.currentTarget.blur();
      }
    },
    [layout?.rotation, handleRotationCommit]
  );

  const handleRotationPreset = useCallback(
    (deg: number) => {
      setRotationInput(String(deg));
      updateLayout(layoutId, { rotation: deg });
    },
    [layoutId, updateLayout]
  );

  const handleResetDimensions = useCallback(() => {
    if (!layout) return;
    updateLayout(layoutId, {
      width: layout.originalWidth,
      height: layout.originalHeight,
    });
  }, [layoutId, layout, updateLayout]);

  const handleResetRotation = useCallback(() => {
    setRotationInput('0');
    updateLayout(layoutId, { rotation: 0 });
  }, [layoutId, updateLayout]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const opacity = Number(e.target.value) / 100;
      updateLayout(layoutId, { opacity });
    },
    [layoutId, updateLayout]
  );

  const handleDelete = useCallback(() => {
    deleteLayout(layoutId);
    setSelectedNode(null);
  }, [layoutId, deleteLayout, setSelectedNode]);

  // ---- Guard (after ALL hooks) ----
  if (!layout) {
    return null;
  }

  const isOriginalSize =
    Math.round(layout.width) === Math.round(layout.originalWidth) &&
    Math.round(layout.height) === Math.round(layout.originalHeight);

  const activePreset = ROTATION_PRESETS.includes(layout.rotation as typeof ROTATION_PRESETS[number])
    ? layout.rotation
    : null;

  return (
    <aside
      className="absolute right-4 top-4 z-30 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
      style={{ maxHeight: 'calc(100% - 32px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Layout Image</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex flex-col">

        {/* ---- Section: Identity ---- */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Identity
          </p>
          <div className="flex flex-col gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Format</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200 uppercase bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {layout.sourceFormat}
              </span>
            </div>
          </div>
        </div>

        {/* ---- Section: Dimensions ---- */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Dimensions
            </p>
            <button
              onClick={handleResetDimensions}
              disabled={isOriginalSize}
              title="Reset to original size"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Width input */}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">W</label>
              <div className="flex items-center">
                <input
                  type="number"
                  value={widthInput}
                  min={MIN_DIM}
                  max={MAX_DIM}
                  onChange={(e) => setWidthInput(e.target.value)}
                  onBlur={handleWidthCommit}
                  onKeyDown={handleDimKeyDown(handleWidthCommit)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Aspect ratio lock toggle */}
            <button
              onClick={() => toggleAspectRatioLock(layoutId)}
              title={layout.aspectRatioLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              className={`mt-4 p-1.5 rounded-lg border transition-colors ${
                layout.aspectRatioLocked
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'
              }`}
            >
              {layout.aspectRatioLocked
                ? <Link className="w-3.5 h-3.5" />
                : <Unlink className="w-3.5 h-3.5" />
              }
            </button>

            {/* Height input */}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">H</label>
              <input
                type="number"
                value={heightInput}
                min={MIN_DIM}
                max={MAX_DIM}
                onChange={(e) => setHeightInput(e.target.value)}
                onBlur={handleHeightCommit}
                onKeyDown={handleDimKeyDown(handleHeightCommit)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-right">
            Original: {Math.round(layout.originalWidth)} x {Math.round(layout.originalHeight)}
          </p>
        </div>

        {/* ---- Section: Crop ---- */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Crop
          </p>

          {cropModeLayoutId === layoutId ? (
            // Active crop mode: show "Done Cropping" button
            <button
              onClick={() => setCropMode(null)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Done Cropping
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setCropMode(layoutId)}
                disabled={layout.locked}
                title={layout.locked ? 'Unlock to crop' : 'Crop image'}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-gray-600"
              >
                <Crop className="w-3.5 h-3.5" />
                Crop Image
              </button>

              {layout.cropX !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {Math.round(layout.cropW ?? 0)} x {Math.round(layout.cropH ?? 0)} of{' '}
                    {Math.round(layout.originalWidth)} x {Math.round(layout.originalHeight)}
                  </span>
                  <button
                    onClick={() => resetCrop(layoutId)}
                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Section: Rotation ---- */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Rotation
            </p>
            <button
              onClick={handleResetRotation}
              disabled={layout.rotation === 0}
              title="Reset rotation to 0deg"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Numeric degree input */}
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                value={rotationInput}
                min={0}
                max={359}
                onChange={(e) => setRotationInput(e.target.value)}
                onBlur={handleRotationCommit}
                onKeyDown={handleRotationKeyDown}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">deg</span>
            </div>

            {/* Preset pill buttons */}
            <div className="flex gap-1">
              {ROTATION_PRESETS.map((deg) => (
                <button
                  key={deg}
                  onClick={() => handleRotationPreset(deg)}
                  title={`Rotate to ${deg}deg`}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    activePreset === deg
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {deg}&deg;
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Section: Appearance ---- */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Appearance
          </p>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Opacity</label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
              {Math.round(layout.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            value={Math.round(layout.opacity * 100)}
            onChange={handleOpacityChange}
            className="w-full h-2 accent-blue-500 cursor-pointer"
          />
        </div>

        {/* ---- Section: Controls ---- */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
            Controls
          </p>
          <div className="flex gap-2">
            {/* Visibility toggle */}
            <button
              onClick={() => toggleVisibility(layoutId)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                layout.visible
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {layout.visible ? (
                <><Eye className="w-3.5 h-3.5" />Visible</>
              ) : (
                <><EyeOff className="w-3.5 h-3.5" />Hidden</>
              )}
            </button>

            {/* Lock toggle */}
            <button
              onClick={() => toggleLock(layoutId)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                layout.locked
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {layout.locked ? (
                <><Lock className="w-3.5 h-3.5" />Locked</>
              ) : (
                <><Unlock className="w-3.5 h-3.5" />Unlocked</>
              )}
            </button>
          </div>
        </div>

        {/* ---- Delete ---- */}
        <div className="px-4 py-3">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-sm font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
            >
              <Trash2 className="w-4 h-4" />
              Delete Layout
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                Delete this layout image?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
});

LayoutPropertiesPanel.displayName = 'LayoutPropertiesPanel';
