import { Head, Html, Main, NextScript } from 'next/document';

/*
 * Sets the `dark` class on <html> before first paint.
 *
 * Tailwind is configured with darkMode: 'class', so without this the page would
 * render in light mode and then snap to dark once React hydrates. The resolution
 * order here must match resolveInitialTheme() in components/themeToggle.js.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('nrp-theme');
    var dark = stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    // localStorage or matchMedia blocked — leave the default light theme.
  }
})();
`;

export default function MyDocument() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
