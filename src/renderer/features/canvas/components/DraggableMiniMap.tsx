// ============================================
// DRAGGABLE MINIMAP
// ReactFlow MiniMap wrapper with drag-to-reposition
// and localStorage persistence
// ============================================

import { useRef, useState, useCallback, useEffect } from 'react';
import { MiniMap } from 'reactflow';
import { GripHorizontal } from 'lucide-react';

// ===== localStorage helpers =====

const STORAGE_KEY = 'lineOptimizer_minimapPosition';

function loadPosition(): { x: number; y: number } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function savePosition(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    console.warn('[DraggableMiniMap] Failed to persist position');
  }
}

function clearPosition(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ===== Constants =====

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const HANDLE_HEIGHT = 20;

// ===== Area color map (matches GenericShapeNode) =====

const AREA_COLORS: Record<string, string> = {
  ICT: '#60a5fa',
  SMT: '#34d399',
  WAVE: '#fbbf24',
  ASSEMBLY: '#f472b6',
  TEST: '#a78bfa',
};

// ===== Component =====

interface DraggableMiniMapProps {
  isPanelOpen: boolean;
}

export const DraggableMiniMap = ({ isPanelOpen }: DraggableMiniMapProps) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    () => loadPosition()
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(position);

  // Keep positionRef in sync for use inside event handlers
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas pan/select from activating

    const container = wrapperRef.current?.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();

    // Record where within the wrapper the user clicked
    const offsetX = wrapperRect ? e.clientX - wrapperRect.left : MINIMAP_WIDTH / 2;
    const offsetY = wrapperRect ? e.clientY - wrapperRect.top : HANDLE_HEIGHT / 2;

    const onMove = (moveEvent: MouseEvent) => {
      const newX = moveEvent.clientX - containerRect.left - offsetX;
      const newY = moveEvent.clientY - containerRect.top - offsetY;

      // Clamp within canvas container bounds
      const clampedX = Math.max(0, Math.min(newX, containerRect.width - MINIMAP_WIDTH));
      const clampedY = Math.max(0, Math.min(newY, containerRect.height - MINIMAP_HEIGHT - HANDLE_HEIGHT));

      setPosition({ x: clampedX, y: clampedY });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      // Persist final position
      if (positionRef.current) {
        savePosition(positionRef.current);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearPosition();
    setPosition(null);
  }, []);

  // Compute wrapper position style
  const isCustomPosition = position !== null;
  const wrapperStyle: React.CSSProperties = isCustomPosition
    ? {
        top: position.y,
        left: position.x,
        transition: 'none',
      }
    : {
        bottom: 15,
        right: isPanelOpen ? 'calc(22rem + 15px)' : 15,
        transition: 'right 0.3s ease',
      };

  return (
    <div
      ref={wrapperRef}
      className="absolute z-10"
      style={wrapperStyle}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing select-none"
        style={{ height: HANDLE_HEIGHT, width: MINIMAP_WIDTH }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleReset}
        title="Drag to reposition · Double-click to reset"
      >
        <GripHorizontal className="w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
      </div>

      {/* MiniMap — style overrides Panel's position:absolute so our wrapper controls layout */}
      <MiniMap
        nodeColor={(node) => AREA_COLORS[node.data.area as string] || '#9ca3af'}
        maskColor="rgba(0, 0, 0, 0.1)"
        position="bottom-right"
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-sm"
        style={{ position: 'static', margin: 0 }}
      />
    </div>
  );
};
