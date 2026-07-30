import { useState } from 'react';
import { Badge } from '@tremor/react';
import { RiCpuLine, RiServerLine, RiDatabase2Line, RiStackLine } from '@remixicon/react';
import {
  SiteGpuStats,
  SiteGpuTypes,
  SiteNetworkStats,
  SiteStats,
} from '../mapInfoPanel';
import { SiteMultiSelectBox, SiteSelectBox } from './SiteSelect';
import ClusterMemberList from './ClusterMemberList';
import { summarizeSites } from '../../lib/siteClusters';

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
 *
 * `site` may be a merged group from lib/siteClusters (see clusterSites). A group
 * is site-shaped, so the badge row below reads it unchanged and reports the
 * combined totals. The metric cards are the part that cannot be merged: every one
 * of them fetches `/api/<metric>?site=<slug>` and a group has no slug of its own,
 * so they always render for exactly one *member* — chosen here, named above the
 * stack, and switchable from the member list. That keeps the panel honest instead
 * of quietly showing the biggest member's charts under a merged heading.
 */
export function MapSiteContent({
  site,
  // Optional external control, so a page can keep its header picker and the panel
  // pointing at the same member. Uncontrolled, the panel manages it alone.
  focusedSiteId,
  onFocusSite,
  // The preview harness renders the identity half without the live fetches.
  showMetrics = true,
}) {
  const [internalFocusId, setInternalFocusId] = useState(null);

  if (!site) return null;

  const members = site.members || [site];
  const isMerged = members.length > 1;

  /*
   * Falling back to members[0] rather than resetting on change: when the panel
   * switches to a different group the remembered id is not in the new member
   * list, so the lookup misses and the primary wins — which is the reset, without
   * an effect that would render the old member's charts for one frame first.
   */
  const requestedId = focusedSiteId ?? internalFocusId;
  const focusedSite =
    members.find((member) => String(member.id) === String(requestedId)) || members[0];

  const selectMember = (member) => {
    setInternalFocusId(member.id);
    if (onFocusSite) onFocusSite(member);
  };

  // Aggregate across the whole group; `site.nodes` is already the concatenation.
  const { nodeCount, gpuCount, cacheCount } = summarizeSites([site]);

  return (
    <div className="space-y-4">
      <div className="flex flex-row flex-wrap gap-2">
        {isMerged && (
          /*
           * Neutral rather than a fifth hue — this badge counts *sites*, not a
           * resource, so it should not compete with the three that do. Tremor's
           * own `slate` badge resolves to slate-400/10 on slate-500 text in dark
           * mode, which is barely legible on the glass panel, hence the explicit
           * surface. Same reasoning as the pin's count badge.
           */
          <Badge
            icon={RiStackLine}
            color="slate"
            className="!bg-slate-200 !text-slate-700 dark:!bg-slate-600/60 dark:!text-slate-100"
          >
            {members.length} Sites Merged
          </Badge>
        )}
        <Badge icon={RiServerLine} color="green">
          {nodeCount} {nodeCount === 1 ? 'Node' : 'Nodes'} Online
        </Badge>
        {gpuCount > 0 && (
          <Badge icon={RiCpuLine} color="blue">
            {gpuCount} {gpuCount === 1 ? 'GPU' : 'GPUs'}
          </Badge>
        )}
        {cacheCount > 0 && (
          <Badge icon={RiDatabase2Line} color="violet">
            {cacheCount} OSDF {cacheCount === 1 ? 'Node' : 'Nodes'}
          </Badge>
        )}
      </div>

      <ClusterMemberList
        cluster={site}
        activeSiteId={focusedSite.id}
        onSelectSite={selectMember}
      />

      {showMetrics ? (
        <div className="flex flex-col gap-4">
          {/* Only when merged: for a single site this would restate the header. */}
          {isMerged && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Usage ·{' '}
              <span className="normal-case text-slate-700 dark:text-slate-200">
                {focusedSite.name}
              </span>
            </p>
          )}
          <MemberMetrics site={focusedSite} />
        </div>
      ) : null}
    </div>
  );
}

/*
 * Keyed on the member's slug so switching members remounts the cards rather than
 * re-rendering them: each card holds its own SWR subscription plus chart state,
 * and without the remount the previous member's bars stay on screen until the new
 * query resolves.
 */
function MemberMetrics({ site }) {
  const { gpuCount } = summarizeSites([site]);

  return (
    <div key={site.slug} className="flex flex-col gap-4">
      <SiteStats site={site} />
      {gpuCount > 0 ? <SiteGpuStats site={site} /> : null}
      {gpuCount > 0 ? <SiteGpuTypes site={site} /> : null}
      <SiteNetworkStats site={site} />
    </div>
  );
}
