// ============================================
// HOME PAGE
// Landing page con menu de navegacion
// ============================================

import { useNavigate } from 'react-router-dom';
import { Factory, BarChart3, Settings } from 'lucide-react';

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Line Optimizer
          </h1>
          <p className="text-xl text-gray-600">
            Sistema de optimizacion de lineas de produccion
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Canvas */}
          <button
            onClick={() => navigate('/canvas')}
            className="group bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary-500"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
                <Factory className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Canvas
              </h3>
              <p className="text-sm text-gray-600">
                Visualizar y organizar lineas de produccion
              </p>
            </div>
          </button>

          {/* Dashboard */}
          <button
            onClick={() => navigate('/dashboard')}
            className="group bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary-500"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
                <BarChart3 className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Dashboard
              </h3>
              <p className="text-sm text-gray-600">
                Metricas y analisis de utilizacion
              </p>
            </div>
          </button>

          {/* Settings */}
          <button
            onClick={() => navigate('/settings')}
            className="group bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary-500"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
                <Settings className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Settings
              </h3>
              <p className="text-sm text-gray-600">
                Configuracion y catalogos
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
