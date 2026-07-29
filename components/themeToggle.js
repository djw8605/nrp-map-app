import { useCallback, useEffect, useState } from 'react';
import { RiMoonLine, RiSunLine } from '@remixicon/react';

export const THEME_STORAGE_KEY = 'nrp-theme';

/**
 * Resolve the theme the same way the pre-paint script in pages/_document.js does:
 * an explicit stored choice wins, otherwise fall back to the OS preference.
 * Keep the two in sync — a mismatch causes a flash on first paint.
 */
export function resolveInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (error) {
    // localStorage unavailable (private mode / blocked) — fall through to the OS.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  // Lets the browser paint form controls and scrollbars to match.
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle({ className = '' }) {
  // Start null so the button renders nothing theme-specific until mounted; the
  // real class is already on <html> from the pre-paint script, so there is no flash.
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(resolveInitialTheme());
  }, []);

  // Follow the OS only while the user has made no explicit choice.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      let stored = null;
      try {
        stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      } catch (error) {
        // Ignore and treat as no explicit choice.
      }
      if (stored === 'light' || stored === 'dark') return;
      const next = query.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next);
    };

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (error) {
        // Preference just will not persist; the toggle still works this session.
      }
      return next;
    });
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      // aria-label is static so screen readers are not told a different thing
      // pre- and post-hydration.
      aria-label="Toggle dark mode"
      aria-pressed={theme == null ? undefined : isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200
        text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50
        ${className}`}
    >
      {isDark ? (
        <RiSunLine className="h-4 w-4" aria-hidden="true" />
      ) : (
        <RiMoonLine className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
