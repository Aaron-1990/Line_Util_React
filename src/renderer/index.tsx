// ============================================
// RENDERER ENTRY POINT
// React Application
// ============================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';

/**
 * App placeholder
 * Se implementara completamente en proximos bloques
 */
function App() {
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    if (window.electronAPI) {
      setIsConnected(true);
      console.log('Electron API connected successfully');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Line Optimizer
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Sistema de optimizacion de lineas de produccion
        </p>
        <div className="space-y-2">
          <div className={`inline-flex items-center px-4 py-2 rounded-lg ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            <span className="w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-green-600' : 'bg-yellow-600'
            }"></span>
            {isConnected ? 'Electron API Connected' : 'Connecting...'}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
