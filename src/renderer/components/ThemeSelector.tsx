// ============================================
// THEME SELECTOR COMPONENT
// Three-option segmented control for theme selection
// ============================================

import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, Theme } from '../store/useThemeStore';

// ===== Types =====

interface ThemeOption {
  value: Theme;
  label: string;
  icon: typeof Sun;
}

// ===== Constants =====

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

// ===== Component =====

export const ThemeSelector = () => {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1">
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = theme === option.value;

        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              transition-all duration-150 ease-out
              ${isSelected
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
            aria-pressed={isSelected}
            title={`${option.label} theme`}
          >
            <Icon className="w-4 h-4" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
