import { useState } from 'react';
import { RiCpuLine, RiDatabase2Line, RiServerLine } from '@remixicon/react';
import SitePinMarker from './SitePinMarker';
import {
  describeMembers,
  haversineKm,
  siteHasOsdfCache,
  summarizeSites,
} from '../../lib/siteClusters';

/*
 * The identity list for a merged pin.
 *
 * This is the whole point of merging rather than hiding: one pin on the map, but
 * every site that pin stands for is still named, still counted, and still one
 * click from its own live metrics.
 *
 * Density rules, because the panel is 360px wide and already carries four metric
 * cards below this:
 *  - three fixed lines per site — name, the other name, counts. Letting the
 *    second name share a wrapping line with the counts made rows 2 or 3 lines
 *    depending on how long the name was, which read as ragged rather than dense;
 *  - the counts are the same three the badge row and the hover card use, so a
 *    reader can add them up and land on the aggregate;
 *  - the distance chip is what explains the merge — "these are 1.1 km apart", not
 *    "the map decided these are one thing";
 *  - past COLLAPSED_LIMIT rows the tail is folded away. Merged groups are usually
 *    2–3 sites, so the toggle almost never appears, but a carrier hotel with six
 *    registrations must not push the metrics off the bottom of the panel.
 */

const COLLAPSED_LIMIT = 4;

const SECTION_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

function MemberStat({ icon: Icon, value, label, className = '' }) {
  return (
    <span className={`flex items-center gap-1 whitespace-nowrap ${className}`}>
      <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}

/**
 * One site inside a merged pin.
 *
 * A <button> rather than a div: picking a member re-targets the live metric cards
 * below, so it is a real control and has to be keyboard reachable. `type="button"`
 * because the overview panel wraps its inputs in a form on some embeds.
 */
function MemberRow({ site, label, secondary, distanceKm, isActive, onSelect }) {
  const { nodeCount, gpuCount, cacheCount } = summarizeSites([site]);

  return (
    <button
      type="button"
      onClick={() => onSelect(site)}
      aria-current={isActive ? 'true' : undefined}
      className={[
        'flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors',
        isActive
          ? 'bg-blue-50 dark:bg-blue-500/20'
          : 'bg-transparent hover:bg-slate-100/70 dark:hover:bg-slate-700/40',
      ].join(' ')}
    >
      {/* The map's own pin, so a row cannot drift from the colour it had before
          the merge — green here still means "this member runs an OSDF cache". */}
      <SitePinMarker size={14} interactive={false} isOsdfCache={siteHasOsdfCache(site)} />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={[
              'min-w-0 flex-1 break-words text-sm leading-snug',
              isActive
                ? 'font-semibold text-blue-900 dark:text-blue-100'
                : 'font-medium text-slate-900 dark:text-slate-100',
            ].join(' ')}
          >
            {label}
          </span>
          {distanceKm > 0 ? (
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-slate-400 dark:text-slate-500">
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
            </span>
          ) : null}
        </span>

        {secondary ? (
          <span className="mt-0.5 block break-words text-[0.6875rem] leading-snug text-slate-500 dark:text-slate-400">
            {secondary}
          </span>
        ) : null}

        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
          <MemberStat
            icon={RiServerLine}
            value={nodeCount}
            label={nodeCount === 1 ? 'node' : 'nodes'}
          />
          {gpuCount > 0 ? (
            <MemberStat
              icon={RiCpuLine}
              value={gpuCount}
              label={gpuCount === 1 ? 'GPU' : 'GPUs'}
            />
          ) : null}
          {cacheCount > 0 ? (
            <MemberStat
              icon={RiDatabase2Line}
              value={cacheCount}
              label={cacheCount === 1 ? 'cache' : 'caches'}
              className="text-green-700 dark:text-green-400"
            />
          ) : null}
        </span>
      </span>
    </button>
  );
}

/**
 * @param {object} cluster A group from clusterSites(). Renders nothing for a
 *   single-site group, so callers do not have to branch.
 * @param {string|number} activeSiteId Member whose metrics are on screen.
 * @param {(site: object) => void} onSelectSite
 */
export default function ClusterMemberList({ cluster, activeSiteId, onSelectSite }) {
  const [showAll, setShowAll] = useState(false);

  const members = cluster?.members || [];
  if (members.length < 2) return null;

  const primary = cluster.primarySite || members[0];
  const described = describeMembers(members);
  const visible = showAll ? described : described.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = described.length - visible.length;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className={SECTION_LABEL_CLASS}>Sites at this location</h3>
        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
          within {cluster.spanKm < 1
            ? `${Math.round(cluster.spanKm * 1000)} m`
            : `${cluster.spanKm.toFixed(1)} km`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border-[1px] border-solid border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50">
        <ul className="list-none divide-y divide-slate-200 dark:divide-slate-700">
          {visible.map(({ site, label, secondary }) => (
            <li key={site.id}>
              <MemberRow
                site={site}
                label={label}
                secondary={secondary}
                distanceKm={haversineKm(primary, site)}
                isActive={String(site.id) === String(activeSiteId)}
                onSelect={onSelectSite}
              />
            </li>
          ))}
        </ul>

        {hiddenCount > 0 || showAll ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="w-full border-t-[1px] border-solid border-slate-200 px-2.5 py-1.5 text-xs
              font-medium text-blue-600 transition-colors hover:bg-slate-100/70
              dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-700/40"
          >
            {showAll ? 'Show fewer' : `Show ${hiddenCount} more site${hiddenCount === 1 ? '' : 's'}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
