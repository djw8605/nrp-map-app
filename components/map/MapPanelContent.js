import { Badge } from '@tremor/react';
import { RiCpuLine, RiServerLine, RiDatabase2Line } from '@remixicon/react';
import {
  SiteGpuStats,
  SiteGpuTypes,
  SiteNetworkStats,
  SiteStats,
} from '../mapInfoPanel';
import { SiteMultiSelectBox, SiteSelectBox } from './SiteSelect';

// border-[1px] rather than border: see the note in ./SiteSelect.js — the global
// `.border` rule in globals.css would otherwise override these colours.
const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border-[1px] border-solid border-slate-300 dark:border-slate-600 rounded-lg ' +
  'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';

const LABEL_CLASS = 'text-sm text-slate-500 dark:text-slate-400 block mb-1.5';

/*
 * Overview variant — the NRP logo leads, then the site pickers and regex filter.
 *
 * Composed here rather than reusing mapInfoPanel's DefaultInfoPanel so the logo
 * can sit at the very top with no section heading above it. Deliberately no
 * fleet-wide KPI tiles either: those already live in the KpiRow above the map.
 */
export function MapOverviewContent({
  selectedSite,
  setSelectedSite,
  selectedSites = [],
  setSelectedSites,
  selectionLegendName = 'Selected Sites',
  setSelectionLegendName,
  regexPattern = '',
  handleRegexChange,
  regexError,
}) {
  return (
    <div className="space-y-4">
      <a
        href="https://nationalresearchplatform.org"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src="/images/NRP_LOGO-cropped.png"
          alt="National Research Platform"
          className="block h-12 object-scale-down dark:hidden"
        />
        <img
          src="/images/NRP_LOGO-cropped-dark.png"
          alt="National Research Platform"
          className="hidden h-12 object-scale-down dark:block"
        />
      </a>

      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        A partnership of more than 50 institutions, led by researchers at UC San Diego,
        University of Nebraska&ndash;Lincoln, and Massachusetts Green High Performance
        Computing Center.
      </p>

      <div>
        <label htmlFor="siteSelect" className={LABEL_CLASS}>
          Choose a site or click the map
        </label>
        <SiteSelectBox id="siteSelect" selectedSite={selectedSite} setSelectedSite={setSelectedSite} />
      </div>

      <div>
        <label htmlFor="multiSiteSelect" className={LABEL_CLASS}>
          Highlight multiple sites
        </label>
        <SiteMultiSelectBox
          id="multiSiteSelect"
          selectedSites={selectedSites}
          setSelectedSites={setSelectedSites}
        />
      </div>

      <div>
        <label htmlFor="regexSelect" className={LABEL_CLASS}>
          Or filter by regex pattern
        </label>
        <input
          id="regexSelect"
          type="text"
          value={regexPattern}
          onChange={(e) => handleRegexChange && handleRegexChange(e.target.value)}
          placeholder="e.g., chicago|boulder|^ucsd.*"
          className={INPUT_CLASS}
        />
        {regexError && (
          <span className="mt-1 block text-xs text-red-500 dark:text-red-400">{regexError}</span>
        )}
        {regexPattern && !regexError && selectedSites.length > 0 && (
          <span className="mt-1 block text-xs text-green-600 dark:text-green-400">
            Selected {selectedSites.length} site{selectedSites.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {selectedSites.length > 0 && (
        <>
          <div>
            <label htmlFor="legendLabel" className={LABEL_CLASS}>
              Label for red pins (Legend)
            </label>
            <input
              id="legendLabel"
              type="text"
              value={selectionLegendName}
              onChange={(e) => setSelectionLegendName && setSelectionLegendName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (setSelectedSites) setSelectedSites([]);
              if (handleRegexChange) handleRegexChange('');
            }}
            className="w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            Clear Selection ({selectedSites.length})
          </button>
        </>
      )}
    </div>
  );
}

/*
 * Site variant — the full per-site metric stack, reusing the existing cards.
 *
 * No site name and no picker in here: the panel header renders one SiteSelectBox
 * that both names the current site and switches to another. Rendering the name in
 * the header *and* a picker below it showed the same institution twice.
 */
export function MapSiteContent({ site }) {
  if (!site) return null;

  const siteNodes = site.nodes || [];
  const totalGpus = siteNodes.reduce((acc, node) => acc + (parseInt(node.gpus) || 0), 0);
  const totalCaches = siteNodes.reduce((acc, node) => acc + (node.cache ? 1 : 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-row flex-wrap gap-2">
        <Badge icon={RiServerLine} color="green">
          {siteNodes.length} Nodes Online
        </Badge>
        {totalGpus > 0 && (
          <Badge icon={RiCpuLine} color="blue">
            {totalGpus} GPUs
          </Badge>
        )}
        {totalCaches > 0 && (
          <Badge icon={RiDatabase2Line} color="violet">
            {totalCaches} OSDF Nodes
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <SiteStats site={site} />
        {totalGpus > 0 ? <SiteGpuStats site={site} /> : null}
        {totalGpus > 0 ? <SiteGpuTypes site={site} /> : null}
        <SiteNetworkStats site={site} />
      </div>
    </div>
  );
}
