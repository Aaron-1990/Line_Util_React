// ============================================
// HOOK: useLoadLines
// Carga lineas desde DB al canvas
// ============================================

import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { ProductionLine } from '@shared/types';

export function useLoadLines() {
  const { addNode, setNodes } = useCanvasStore();

  useEffect(() => {
    const loadLines = async () => {
      try {
        setNodes([]);

        const response = await window.electronAPI.invoke<ProductionLine[]>('lines:get-all');
        
        if (response.success && response.data) {
          response.data.forEach((line) => {
            addNode({
              id: line.id,
              type: 'productionLine',
              position: { x: line.xPosition, y: line.yPosition },
              data: {
                id: line.id,
                name: line.name,
                area: line.area,
                timeAvailableDaily: line.timeAvailableDaily,
                assignedModelsCount: 0,
              },
            });
          });
        }
      } catch (error) {
        console.error('Error loading lines:', error);
      }
    };

    loadLines();
  }, [addNode, setNodes]);
}
