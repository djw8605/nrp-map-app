import { RiBookOpenLine } from '@remixicon/react';
import ThemeToggle from './themeToggle';

export default function NavBar() {
  return (
    <header className="app-header sticky top-0 z-30">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex h-16 flex-wrap items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2.5">
            {/* Brand blue as a small accent rather than a full-width slab. */}
            <span className="h-5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-500" aria-hidden="true" />
            <span className="whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              National Research Platform
            </span>
          </a>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="https://nationalresearchplatform.org/documentation"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold
                text-white transition-colors hover:bg-blue-700
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-offset-slate-900"
            >
              <RiBookOpenLine className="h-4 w-4" aria-hidden="true" />
              Docs
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
