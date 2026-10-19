import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import useTheme from '../hooks/useTheme';

const OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

/**
 * System / Light / Dark segmented switch. A radiogroup, so the three choices
 * and the current one are announced as such.
 *
 * `variant="onDark"` is for surfaces that are dark in both themes (the sign-in
 * hero), where the gray scale — which inverts with the theme — can't be used.
 */
export default function ThemeToggle({ className, variant = 'default' }) {
  const { preference, setPreference } = useTheme();
  const onDark = variant === 'onDark';
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg p-0.5',
        onDark ? 'bg-white/10 ring-1 ring-white/10' : 'bg-gray-100 ring-1 ring-gray-200',
        className
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setPreference(value)}
            className={cn(
              'inline-flex items-center justify-center rounded-md p-1.5 transition-colors',
              onDark
                ? on
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white'
                : on
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-700'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
