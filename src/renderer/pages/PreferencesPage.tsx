// ============================================
// PREFERENCES PAGE
// Application preferences and settings
// ============================================

import { ThemeSelector } from '../components/ThemeSelector';

export const PreferencesPage = () => {
  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Preferences
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-2xl space-y-8">
          {/* Appearance Section */}
          <section>
            <h2 className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-4">
              Appearance
            </h2>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Theme
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Choose how Line Optimizer looks to you.
                  </p>
                  <ThemeSelector />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    System follows your operating system preference.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
