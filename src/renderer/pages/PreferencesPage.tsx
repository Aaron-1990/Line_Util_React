// ============================================
// PREFERENCES PAGE (Placeholder)
// Application preferences and settings
// ============================================

import { Settings } from 'lucide-react';

export const PreferencesPage = () => {
  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
          <Settings className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Preferences
        </h2>
        <p className="text-gray-600 max-w-md">
          Application settings and preferences coming soon.
          <br />
          Configure defaults, units, and display options.
        </p>
      </div>
    </div>
  );
};
