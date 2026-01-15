// ============================================
// EXCEL IMPORT PAGE
// Pagina para importar datos desde Excel
// ============================================

import { useNavigate } from 'react-router-dom';
import { ImportWizard } from '../features/excel';

export const ExcelImportPage = () => {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate('/canvas');
  };

  const handleCancel = () => {
    navigate('/canvas');
  };

  return <ImportWizard onComplete={handleComplete} onCancel={handleCancel} />;
};
