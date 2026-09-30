import { useEffect, useMemo, useRef, useState } from 'react';
import { RiBuilding2Line } from '@remixicon/react';
import NrpPanelIntro from '../map/NrpPanelIntro';
import { INPUT_CLASS, LABEL_CLASS } from '../map/MapPanelContent';
import { useIsDarkMode } from './useIsDarkMode';
import { usageColors } from './usageColors';
import {
  binIndex,
  formatUsageAmount,
  formatUsageExact,
  formatWindow,
  otherRegionList,
  USAGE_METRIC_KEYS,
  searchUsage,
  topCount,
  usHeadline,
  usRegionList,
  windowMonths,
} from '../../lib/usageRegions';

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// Same heading treatment as the contributors panel's section labels.
const SECTION_TITLE_CLASS =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
// Same container as ClusterMemberList, so a list of rows looks the same in both views.
const LIST_BOX_CLASS =
  'overflow-hidden rounded-xl border-[1px] border-solid border-slate-200 bg-white/60 ' +
  'dark:border-slate-700 dark:bg-slate-800/50';
const LIST_CLASS = 'list-none divide-y divide-slate-200 dark:divide-slate-700';
const FOCUS_RING_CLASS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500';
const MORE_BUTTON_CLASS =
  'w-full border-t-[1px] border-solid border-slate-200 px-2.5 py-2 text-xs font-medium text-blue-600 ' +
  'transition-colors hover:bg-slate-100/70 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-700/40 ' +
  FOCUS_RING_CLASS;
// Institution search results shown before "keep typing".
const INSTITUTION_RESULT_LIMIT = 8;
// Below this many institutions a region's list needs no filter box.
const FILTER_MIN_INSTITUTIONS = 12;
const ROW_SELECTOR = '[data-usage-row]';

// The map key's colour for a region, so each row points at its own shade on the map.
function Swatch({ count }) {
  const colors = usageColors(useIsDarkMode());
  const index = binIndex(count);
  return (
    <span
      aria-hidden="true"
      className="mt-[0.3125rem] h-2.5 w-2.5 shrink-0 rounded-[2px] ring-1 ring-inset ring-slate-900/10 dark:ring-white/10"
      style={{ backgroundColor: index >= 0 ? colors.ramp[index] : 'transparent' }}
    />
  );
}

/*
 * Up and Down move between rows, and Down from the search box enters the list.
 * The rows stay ordinary tab stops as well, so this only adds a faster path.
 */
function moveRowFocus(container, event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const rows = [...(container?.querySelectorAll(ROW_SELECTOR) || [])];
  if (!rows.length) return;
  event.preventDefault();
  const current = rows.indexOf(document.activeElement);
  const step = event.key === 'ArrowDown' ? 1 : -1;
  const next = current === -1 ? 0 : Math.min(rows.length - 1, Math.max(0, current + step));
  rows[next].focus();
}

/*
 * One region, as a button: selecting it flies the map there. Hovering or
 * focusing it lights the region on the map; `isLit` is the reverse, the region
 * currently hovered on the map.
 */
function RegionRow({ region, max, isLit, onPick, onHover }) {
  const count = region.institutionCount;
  const width = max ? Math.max(2, Math.round((count / max) * 100)) : 0;

  return (
    <li>
      <button
        type="button"
        data-usage-row={`region:${region.code}`}
        onClick={() => onPick(region.code, null, `region:${region.code}`)}
        onMouseEnter={() => onHover(region.code)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(region.code)}
        onBlur={() => onHover(null)}
        aria-label={`${region.name}, ${plural(count, 'institution', 'institutions')}`}
        className={`flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left transition-colors ${FOCUS_RING_CLASS} ${
          isLit
            ? 'bg-sky-50 dark:bg-sky-400/15'
            : 'hover:bg-slate-100/70 dark:hover:bg-slate-700/40'
        }`}
      >
        <Swatch count={count} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {region.name}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">{count}</span>
          </span>
          <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-slate-200/80 dark:bg-slate-700/70">
            <span
              className="block h-1 rounded-full bg-sky-500 dark:bg-sky-400"
              style={{ width: `${width}%` }}
            />
          </span>
        </span>
      </button>
    </li>
  );
}

function InstitutionResultRow({ result, isLit, onPick, onHover }) {
  const key = `institution:${result.code}:${result.name}`;
  return (
    <li>
      <button
        type="button"
        data-usage-row={key}
        onClick={() => onPick(result.code, result.name, key)}
        onMouseEnter={() => onHover(result.code)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(result.code)}
        onBlur={() => onHover(null)}
        className={`flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left transition-colors ${FOCUS_RING_CLASS} ${
          isLit
            ? 'bg-sky-50 dark:bg-sky-400/15'
            : 'hover:bg-slate-100/70 dark:hover:bg-slate-700/40'
        }`}
      >
        <RiBuilding2Line className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm leading-snug text-slate-900 dark:text-slate-100">{result.name}</span>
          <span className="block text-xs text-slate-600 dark:text-slate-300">{result.regionName}</span>
        </span>
      </button>
    </li>
  );
}

function RegionSection({ title, aside, regions, max, litCode, onPick, onHover, footer }) {
  if (!regions.length) return null;
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className={SECTION_TITLE_CLASS}>{title}</h3>
        {aside ? <span className="text-xs text-slate-600 dark:text-slate-300">{aside}</span> : null}
      </div>
      <div className={LIST_BOX_CLASS}>
        <ul className={LIST_CLASS}>
          {regions.map((region) => (
            <RegionRow
              key={region.code}
              region={region}
              max={max}
              isLit={region.code === litCode}
              onPick={onPick}
              onHover={onHover}
            />
          ))}
        </ul>
        {footer}
      </div>
    </section>
  );
}

function SearchResults({ usage, query, litCode, onPick, onHover }) {
  const { regions, institutions } = useMemo(() => searchUsage(usage, query), [usage, query]);
  const max = useMemo(() => Math.max(0, ...usRegionList(usage).map((r) => r.institutionCount)), [usage]);
  const shownInstitutions = institutions.slice(0, INSTITUTION_RESULT_LIMIT);
  const hidden = institutions.length - shownInstitutions.length;

  if (!regions.length && !institutions.length) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Nothing matches &ldquo;{query.trim()}&rdquo;. Try a state, a country or part of an institution&rsquo;s name.
      </p>
    );
  }

  return (
    <>
      <RegionSection
        title="States and countries"
        regions={regions}
        max={max}
        litCode={litCode}
        onPick={onPick}
        onHover={onHover}
      />
      {shownInstitutions.length ? (
        <section>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h3 className={SECTION_TITLE_CLASS}>Institutions</h3>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{institutions.length}</span>
          </div>
          <div className={LIST_BOX_CLASS}>
            <ul className={LIST_CLASS}>
              {shownInstitutions.map((result) => (
                <InstitutionResultRow
                  key={`${result.code}:${result.name}`}
                  result={result}
                  isLit={result.code === litCode}
                  onPick={onPick}
                  onHover={onHover}
                />
              ))}
            </ul>
          </div>
          {hidden > 0 ? (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              {plural(hidden, 'more institution matches', 'more institutions match')}. Keep typing to narrow it down.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

/*
 * Nothing selected: a headline, then every region as a ranked, searchable list.
 *
 * The list is the way in for anything the map makes hard to reach: DC and Rhode
 * Island are a few pixels wide at this zoom, Hawaii and the other countries are
 * off-screen, and none of the map is reachable by keyboard. An earlier A–Z list
 * of every region read as a phone book; this one is ranked, shows its skew with
 * a bar, stops at the top ten (plus ties), and is linked both ways to the map.
 *
 * `query` and `showAll` live in UsagePanel so they survive a trip into a region
 * and back.
 */
export function UsageOverviewContent({
  usage,
  error,
  isLoading,
  onRetry,
  query,
  onQueryChange,
  showAll,
  onShowAllChange,
  litCode,
  onPick,
  onHover,
  containerRef,
}) {
  const us = useMemo(() => usRegionList(usage), [usage]);
  const other = useMemo(() => otherRegionList(usage), [usage]);

  let body;
  if (error) {
    body = (
      <div className="space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Usage data couldn&rsquo;t be loaded. It&rsquo;s refreshed every six hours, so it may be between updates.
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={`rounded-lg border-[1px] border-solid border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/60 ${FOCUS_RING_CLASS}`}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  } else if (isLoading || !usage) {
    body = <p className="text-sm text-slate-600 dark:text-slate-300">Loading usage…</p>;
  } else {
    const headline = usHeadline(usage);
    const months = windowMonths(usage.window);
    const max = us[0]?.institutionCount || 0;
    const shown = showAll ? us.length : topCount(us);
    const otherInstitutions = other.reduce((total, region) => total + region.institutionCount, 0);
    const searching = query.trim().length > 0;

    body = (
      <>
        <div>
          <h3 className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-50">
            {headline.label} {headline.regions === 1 ? 'uses' : 'use'} NRP
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {plural(headline.institutions, 'institution', 'institutions')}
            {months ? `, ${months.start} to ${months.end}` : ''}
          </p>
        </div>

        <div>
          <label htmlFor="usage-search" className={LABEL_CLASS}>
            Find a state, country or institution
          </label>
          <input
            id="usage-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                onQueryChange('');
              } else {
                moveRowFocus(containerRef.current, event);
              }
            }}
            placeholder="Nebraska, Scripps…"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </div>

        {searching ? (
          <SearchResults usage={usage} query={query} litCode={litCode} onPick={onPick} onHover={onHover} />
        ) : (
          <>
            <RegionSection
              title="United States"
              aside="Institutions"
              regions={us.slice(0, shown)}
              max={max}
              litCode={litCode}
              onPick={onPick}
              onHover={onHover}
              footer={us.length > topCount(us) ? (
                <button type="button" onClick={() => onShowAllChange(!showAll)} className={MORE_BUTTON_CLASS}>
                  {showAll ? `Show top ${topCount(us)}` : `Show all ${us.length}`}
                </button>
              ) : null}
            />
            <RegionSection
              title="Other countries"
              aside={plural(otherInstitutions, 'institution', 'institutions')}
              regions={other}
              max={max}
              litCode={litCode}
              onPick={onPick}
              onHover={onHover}
            />
          </>
        )}
      </>
    );
  }

  return (
    <div ref={containerRef} className="space-y-5" onKeyDown={(event) => {
      if (event.target.matches?.(ROW_SELECTOR)) moveRowFocus(containerRef.current, event);
    }}>
      <NrpPanelIntro compact />
      {body}
    </div>
  );
}

// In the order the contributors panel names them: GPU, then CPU, then LLM.
const USAGE_METRIC_LABELS = {
  gpu_hours: 'GPU hours',
  cpu_core_hours: 'CPU hours',
  llm_tokens: 'LLM tokens',
};

/*
 * The region's totals, one row per metric, in the institution list's style. No
 * shares, bars or ranks: each of those put the gap between California and every
 * other region on screen, which undersold everyone else. A metric with no use is
 * one quiet "None" row. The compact figure is for sighted readers; the exact one
 * is in the tooltip and is what a screen reader hears, since "184M" is ambiguous
 * aloud. A payload without totals shows no section at all.
 */
function UsageTotals({ totals, window }) {
  if (!totals) return null;
  const period = formatWindow(window);

  return (
    <section aria-labelledby="usage-totals-title">
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <h3 id="usage-totals-title" className={SECTION_TITLE_CLASS}>Totals</h3>
        {period ? <span className="text-xs text-slate-600 dark:text-slate-300">{period}</span> : null}
      </div>
      <ul className="list-none divide-y divide-slate-200/80 dark:divide-slate-700/60">
        {USAGE_METRIC_KEYS.map((key) => {
          const label = USAGE_METRIC_LABELS[key];
          const value = Number(totals[key]) || 0;
          const hasUse = value > 0;
          const exact = formatUsageExact(value);
          return (
            <li key={key} className="flex items-baseline justify-between gap-3 py-2.5">
              <span aria-hidden="true" className="truncate text-sm text-slate-700 dark:text-slate-200">{label}</span>
              <span
                aria-hidden="true"
                title={hasUse ? exact : undefined}
                className={`text-sm tabular-nums ${
                  hasUse
                    ? 'font-semibold text-slate-900 dark:text-slate-50'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {hasUse ? formatUsageAmount(value) : 'None'}
              </span>
              <span className="sr-only">{hasUse ? `${label}: ${exact}` : `${label}: none`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/*
 * A region is selected: its usage totals, then its institutions A–Z. Long lists
 * get a filter box. When the pick was an institution search result, that row is
 * marked and scrolled to.
 */
export function UsageRegionContent({ region, window, highlightName }) {
  const [filter, setFilter] = useState('');
  const highlightRef = useRef(null);
  const count = region.institutions.length;

  useEffect(() => { setFilter(''); }, [region.code]);
  // A frame late: MapOverlayPanel scrolls its content to the top when the region
  // changes, and its effect runs after this one.
  useEffect(() => {
    if (!highlightName) return undefined;
    const frame = requestAnimationFrame(() => {
      highlightRef.current?.scrollIntoView?.({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [region.code, highlightName]);

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? region.institutions.filter((name) => name.toLowerCase().includes(needle))
    : region.institutions;

  return (
    <div className="space-y-4">
      <UsageTotals totals={region.totals} window={window} />

      <section>
        <h3 className={`mb-1.5 ${SECTION_TITLE_CLASS}`}>Institutions</h3>
        {count >= FILTER_MIN_INSTITUTIONS ? (
          <>
            <label htmlFor="usage-institution-filter" className="sr-only">
              Filter institutions in {region.name}
            </label>
            <input
              id="usage-institution-filter"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={`Filter ${count} institutions`}
              autoComplete="off"
              className={`mb-2 ${INPUT_CLASS}`}
            />
          </>
        ) : null}

        {visible.length ? (
          <ul className="list-none divide-y divide-slate-200/80 dark:divide-slate-700/60">
            {visible.map((name) => {
              const isHighlighted = name === highlightName;
              return (
                <li
                  key={name}
                  ref={isHighlighted ? highlightRef : undefined}
                  aria-current={isHighlighted ? 'true' : undefined}
                  className={`flex items-start gap-2.5 py-2 text-sm leading-snug ${
                    isHighlighted
                      ? '-mx-2 rounded-lg bg-sky-50 px-2 font-medium text-sky-950 dark:bg-sky-400/15 dark:text-sky-50'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <RiBuilding2Line className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <span className="min-w-0">{name}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No institution in {region.name} matches &ldquo;{filter.trim()}&rdquo;.
          </p>
        )}
      </section>
    </div>
  );
}
