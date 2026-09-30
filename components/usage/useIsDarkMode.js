import { useEffect, useState } from 'react';

const readIsDark = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

/*
 * Class-based, like the rest of the app (Tailwind darkMode: 'class'), so it
 * follows the in-app toggle and not just the OS preference. Mapbox paint is not
 * CSS, so the layers need the flag in JS.
 */
export function useIsDarkMode() {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    setIsDark(readIsDark());
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
