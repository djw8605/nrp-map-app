import { INSTITUTION_BINS, formatWindow } from '../../lib/usageRegions';
import { useIsDarkMode } from './useIsDarkMode';
import { usageColors } from './usageColors';

/*
 * Bottom-left, where the contributors legend sits. The key for the map's five
 * steps of institution count, plus the dashed outline that marks a US state
 * with no recorded use, so those states read as "none" and not as missing.
 */
export default function UsageLegend({ usage, error, isLoading }) {
  const colors = usageColors(useIsDarkMode());

  let body;
  if (error) {
    body = <p>Usage data unavailable</p>;
  } else if (isLoading || !usage) {
    body = <p>Loading…</p>;
  } else {
    body = (
      <>
        <p className="font-medium">Institutions using NRP</p>
        <ol className="mt-1.5 flex list-none gap-0.5" aria-label="Institutions per region">
          {INSTITUTION_BINS.map((bin, index) => (
            <li key={bin.label} className="w-8 text-center">
              <span
                aria-hidden="true"
                className="block h-2.5 rounded-[2px]"
                style={{ backgroundColor: colors.ramp[index] }}
              />
              <span className="mt-1 block whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">{bin.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1.5 flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span
            aria-hidden="true"
            className="h-2.5 w-8 rounded-[2px] border-[1px] border-dashed"
            style={{ borderColor: colors.unused }}
          />
          No recorded use
        </p>
        <p className="mt-1 text-slate-600 dark:text-slate-300">{formatWindow(usage.window)}</p>
      </>
    );
  }

  return (
    <div className="map-glass-panel absolute bottom-3 left-3 z-10 px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100">
      {body}
    </div>
  );
}
