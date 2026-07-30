import { RiCpuLine, RiDatabase2Line, RiServerLine } from '@remixicon/react';
import { describeMembers, siteHasOsdfCache, summarizeSites } from '../../lib/siteClusters';

/*
 * Hover card contents for a site pin.
 *
 * Deliberately static: every number here comes from the /api/nodes payload the
 * map already holds, so hovering a pin never triggers a fetch. The live
 * per-site metrics (utilisation, network, GPU breakdown) stay in the overlay
 * panel one click away.
 *
 * Same three reducers as MapSiteContent's badge row, so the hover card and the
 * panel can never disagree about a site's totals.
 *
 * When the pin is a merged group (lib/siteClusters), the card also lists the sites
 * behind it. That list is the answer to the question a merged pin provokes — "what
 * is actually here?" — and answering it on hover is what makes the merge feel like
 * a summary rather than like missing data. It is capped at MAX_LISTED_MEMBERS: this
 * is a tooltip following the cursor, so it has to stay a glance.
 */

const MAX_LISTED_MEMBERS = 3;

function Stat({ icon: Icon, value, label, className = 'text-slate-600 dark:text-slate-300' }) {
  return (
    <span className={`flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span>
        <span className="font-semibold tabular-nums">{value}</span> {label}
      </span>
    </span>
  );
}

/** Distance rendered the way the panel's member list renders it. */
const formatSpan = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/*
 * A dot, not a SitePinMarker: the pin's ground shadow and hover lift are wrong for
 * a 6px inline bullet, and the only thing the row needs to carry over from the map
 * is the OSDF/NRP colour.
 */
function MemberDot({ site }) {
  return (
    <span
      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
        siteHasOsdfCache(site) ? 'bg-green-600 dark:bg-green-500' : 'bg-sky-600 dark:bg-sky-500'
      }`}
      aria-hidden="true"
    />
  );
}

function MemberLines({ cluster }) {
  // describeMembers, not `site.name`: campus siblings usually share `name`, and
  // three rows of the same string is worse than no list at all.
  const described = describeMembers(cluster.members);
  const listed = described.slice(0, MAX_LISTED_MEMBERS);
  const hiddenCount = described.length - listed.length;

  return (
    <ul className="mt-2 list-none space-y-1 border-t border-slate-300/50 pt-2 text-xs dark:border-slate-600/50">
      {listed.map(({ site, label }) => {
        const { nodeCount } = summarizeSites([site]);
        return (
          <li key={site.id} className="flex items-start gap-1.5">
            <MemberDot site={site} />
            <span className="min-w-0 flex-1 break-words leading-snug text-slate-700 dark:text-slate-200">
              {label}
            </span>
            {/* Unit spelled out: a bare "6" beside a name reads as ambiguous when
                the row above it counts nodes, GPUs and caches together. */}
            <span className="shrink-0 whitespace-nowrap tabular-nums text-slate-400 dark:text-slate-500">
              {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
            </span>
          </li>
        );
      })}

      {hiddenCount > 0 ? (
        <li className="pl-3 text-slate-400 dark:text-slate-500">
          +{hiddenCount} more site{hiddenCount === 1 ? '' : 's'}
        </li>
      ) : null}
    </ul>
  );
}

export default function SiteHoverCard({ site }) {
  if (!site) return null;

  const { nodeCount, gpuCount, cacheCount } = summarizeSites([site]);
  const members = site.members || [site];
  const isMerged = members.length > 1;

  return (
    // Merged cards carry a name column and a count column, so they get a little
    // more room; a single site keeps exactly the width it had before.
    <div className={isMerged ? 'max-w-[19rem]' : 'max-w-[16rem]'}>
      <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
        {site.name}
      </p>

      {isMerged ? (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {members.length} sites within {formatSpan(site.spanKm)}
        </p>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Stat
          icon={RiServerLine}
          value={nodeCount}
          label={nodeCount === 1 ? 'node' : 'nodes'}
        />
        {gpuCount > 0 && (
          <Stat icon={RiCpuLine} value={gpuCount} label={gpuCount === 1 ? 'GPU' : 'GPUs'} />
        )}
        {/* Tinted to the OSDF pin's green so the card explains the pin colour. */}
        {cacheCount > 0 && (
          <Stat
            icon={RiDatabase2Line}
            value={cacheCount}
            label={cacheCount === 1 ? 'OSDF cache' : 'OSDF caches'}
            className="text-green-700 dark:text-green-400"
          />
        )}
      </div>

      {isMerged ? <MemberLines cluster={site} /> : null}
    </div>
  );
}
