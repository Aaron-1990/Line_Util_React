// ============================================
// DASHBOARD PAGE
// Placeholder para dashboard de metricas
// ============================================

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-white rounded-lg p-8 shadow-sm">
          <p className="text-gray-600">Dashboard en construccion...</p>
        </div>
      </div>
    </div>
  );
};
