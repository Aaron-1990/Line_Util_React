// ============================================
// EXCEL IMPORT PAGE
// Pagina para importar datos desde Excel
// Supports both single-sheet (legacy) and multi-sheet import
// ============================================

import { useNavigate, useSearchParams } from 'react-router-dom';
import { ImportWizard, MultiSheetImportWizard } from '../features/excel';

export const ExcelImportPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Use 'mode' query param to determine import mode
  // Default to multi-sheet import (new default)
  // Use ?mode=single for legacy single-sheet import
  const importMode = searchParams.get('mode') || 'multi';

  const handleComplete = () => {
    navigate('/canvas');
  };

  const handleCancel = () => {
    navigate('/canvas');
  };

  // Use MultiSheetImportWizard by default, fallback to legacy ImportWizard
  if (importMode === 'single') {
    return <ImportWizard onComplete={handleComplete} onCancel={handleCancel} />;
  }

  return <MultiSheetImportWizard onComplete={handleComplete} onCancel={handleCancel} />;
};
