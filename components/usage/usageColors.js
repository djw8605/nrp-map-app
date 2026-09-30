/*
 * One ramp for the map fill, the legend and the panel's row swatches, so the
 * three cannot drift apart. Sky, like the site pins and the view toggle.
 *
 * Five steps, one per lib/usageRegions INSTITUTION_BINS entry, spaced out along
 * the Tailwind ramp so neighbouring steps stay distinguishable. In dark mode the
 * ramp runs the other way (more institutions = lighter), so the regions with the
 * most use are the ones that stand out from the night basemap in both themes.
 */
export const USAGE_COLORS = {
  light: {
    // Starts at sky-300: sky-200 over the light basemap was hard to tell from a
    // state with no recorded use.
    ramp: ['#7dd3fc', '#38bdf8', '#0284c7', '#075985', '#082f49'], // sky-300 400 600 800 950
    line: '#0369a1',
    // Hover and selection share a colour and differ in width: they have to show
    // against every step, from the palest fill to the darkest.
    hover: '#0f172a', // slate-900
    selected: '#0f172a',
    unused: '#94a3b8', // slate-400
    pointStroke: '#ffffff',
  },
  dark: {
    ramp: ['#0c4a6e', '#0369a1', '#0ea5e9', '#7dd3fc', '#e0f2fe'], // sky-900 700 500 300 100
    line: '#7dd3fc',
    hover: '#ffffff',
    selected: '#ffffff',
    unused: '#64748b', // slate-500
    pointStroke: '#0f172a',
  },
};

export const usageColors = (isDark) => (isDark ? USAGE_COLORS.dark : USAGE_COLORS.light);
