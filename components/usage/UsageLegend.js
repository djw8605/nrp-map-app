import { formatWindow } from '../../lib/usageRegions';

/* Bottom-left, where the contributors legend sits; one swatch because the map has one meaning. */
export default function UsageLegend({ usage, error, isLoading }) {
  let body;
  if (error) {
    body = <p>Usage data unavailable</p>;
  } else if (isLoading || !usage) {
    body = <p>Loading…</p>;
  } else {
    body = (
      <>
        <p className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-3.5 w-5 rounded-sm border-[1px] border-solid border-sky-700 bg-sky-600/30 dark:border-sky-300 dark:bg-sky-400/30"
          />
          Institutions using NRP
        </p>
        <p className="mt-1 pl-[1.875rem] text-slate-500 dark:text-slate-400">{formatWindow(usage.window)}</p>
      </>
    );
  }

  return (
    <div className="map-glass-panel absolute bottom-3 left-3 z-10 px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100">
      {body}
    </div>
  );
}
