import { RiCpuLine, RiDatabase2Line, RiServerLine } from '@remixicon/react';

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
 */
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

export default function SiteHoverCard({ site }) {
  if (!site) return null;

  const siteNodes = site.nodes || [];
  const totalGpus = siteNodes.reduce((acc, node) => acc + (parseInt(node.gpus) || 0), 0);
  const totalCaches = siteNodes.reduce((acc, node) => acc + (node.cache ? 1 : 0), 0);

  return (
    <div className="max-w-[16rem]">
      <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
        {site.name}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Stat
          icon={RiServerLine}
          value={siteNodes.length}
          label={siteNodes.length === 1 ? 'node' : 'nodes'}
        />
        {totalGpus > 0 && (
          <Stat icon={RiCpuLine} value={totalGpus} label={totalGpus === 1 ? 'GPU' : 'GPUs'} />
        )}
        {/* Tinted to the OSDF pin's green so the card explains the pin colour. */}
        {totalCaches > 0 && (
          <Stat
            icon={RiDatabase2Line}
            value={totalCaches}
            label={totalCaches === 1 ? 'OSDF cache' : 'OSDF caches'}
            className="text-green-700 dark:text-green-400"
          />
        )}
      </div>
    </div>
  );
}
