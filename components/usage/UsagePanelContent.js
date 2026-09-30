import { formatWindow, regionList, summarizeRegions } from '../../lib/usageRegions';

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function RegionList({ title, regions, onSelectRegion }) {
  if (regions.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <ul className="list-none space-y-0.5">
        {regions.map((region) => (
          <li key={region.code}>
            <button
              type="button"
              onClick={() => onSelectRegion(region.code)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-900/5 dark:text-slate-100 dark:hover:bg-white/10"
            >
              <span className="min-w-0 truncate">{region.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {region.institutionCount}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Nothing selected: how far usage reaches, and every region as a way in. */
export function UsageOverviewContent({ usage, error, isLoading, onSelectRegion }) {
  if (error) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Usage data is unavailable right now.</p>;
  }
  if (isLoading || !usage) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading usage…</p>;
  }

  const { usStates, otherRegions, institutions } = summarizeRegions(usage);
  const regions = regionList(usage);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {plural(institutions, 'institution', 'institutions')} in {plural(usStates, 'US state', 'US states')} and{' '}
        {plural(otherRegions, 'other country or territory', 'other countries and territories')} used NRP
        in {formatWindow(usage.window)}. Click a highlighted region to see who.
      </p>
      <RegionList title="United States" regions={regions.filter((r) => r.isUsState)} onSelectRegion={onSelectRegion} />
      <RegionList
        title="Other countries and territories"
        regions={regions.filter((r) => !r.isUsState)}
        onSelectRegion={onSelectRegion}
      />
    </div>
  );
}

/* A region is selected: its institutions, names only. */
export function UsageRegionContent({ region }) {
  return (
    <ul className="list-none space-y-1.5 text-sm text-slate-800 dark:text-slate-100">
      {region.institutions.map((name) => (
        <li key={name} className="leading-snug">{name}</li>
      ))}
    </ul>
  );
}
