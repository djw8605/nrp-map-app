import { RiBuilding2Line } from '@remixicon/react';
import NrpPanelIntro from '../map/NrpPanelIntro';
import { formatWindow, usSummary, windowMonths } from '../../lib/usageRegions';

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// Same heading treatment as the contributors panel's section labels.
const SECTION_TITLE_CLASS =
  'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const DIVIDER_CLASS = 'border-t-[1px] border-solid border-slate-200/80 pt-4 dark:border-slate-700/60';

function Section({ title, children }) {
  return (
    <section>
      <h3 className={SECTION_TITLE_CLASS}>{title}</h3>
      {children}
    </section>
  );
}

/* Nothing selected: how far US usage reaches; the map itself is the way in. */
export function UsageOverviewContent({ usage, error, isLoading }) {
  let body;
  if (error) {
    body = <p className="text-sm text-slate-600 dark:text-slate-300">Usage data is unavailable right now.</p>;
  } else if (isLoading || !usage) {
    body = <p className="text-sm text-slate-500 dark:text-slate-400">Loading usage…</p>;
  } else {
    const { regions, institutions } = usSummary(usage);
    body = (
      <>
        <div className={DIVIDER_CLASS}>
          <p className="text-5xl font-semibold leading-none text-slate-900 dark:text-slate-50">{regions}</p>
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {regions === 1 ? 'state or territory' : 'states and territories'} using NRP
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {plural(institutions, 'institution', 'institutions')} · {formatWindow(usage.window)}
          </p>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          Select a highlighted state on the map to see its institutions.
        </p>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <NrpPanelIntro />
      {body}
    </div>
  );
}

/* A region is selected: one line of context, then its institutions. */
export function UsageRegionContent({ region, window }) {
  const count = region.institutions.length;
  const months = windowMonths(window);

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm leading-snug text-sky-900 dark:bg-sky-400/10 dark:text-sky-100">
        Researchers at {plural(count, 'institution', 'institutions')} in {region.name} used NRP
        {months ? ` between ${months.start} and ${months.end}` : ''}.
      </p>

      <Section title="Institutions">
        <ul className="list-none divide-y divide-slate-200/80 dark:divide-slate-700/60">
          {region.institutions.map((name) => (
            <li key={name} className="flex items-start gap-2.5 py-2 text-sm leading-snug text-slate-800 dark:text-slate-100">
              <RiBuilding2Line className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span className="min-w-0">{name}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
