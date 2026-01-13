// ============================================
// HOOK: useAreaCatalog
// Carga catalogo de areas desde DB
// ============================================

import { useState, useEffect } from 'react';

interface AreaCatalogItem {
  id: string;
  code: string;
  name: string;
  color: string;
}

export function useAreaCatalog() {
  const [areas, setAreas] = useState<AreaCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAreas = async () => {
      try {
        const response = await window.electronAPI.invoke<AreaCatalogItem[]>(
          'catalog:areas:get-all'
        );

        if (response.success && response.data) {
          setAreas(response.data);
        } else {
          setError(response.error || 'Failed to load areas');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadAreas();
  }, []);

  return { areas, loading, error };
}
