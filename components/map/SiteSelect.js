import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import useSWR from 'swr';
import Skeleton from 'react-loading-skeleton';
import SitePinMarker from './SitePinMarker';
import { fetcher } from '../../lib/fetcher';

/*
 * Site pickers.
 *
 * Rewritten from the pair that used to live in components/mapInfoPanel.js, for
 * three reasons:
 *
 *  1. Long institution names did not fit. react-select's own singleValue base
 *     style is `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`,
 *     so anything past ~30 characters was cut off. Those are inline styles, so a
 *     class cannot beat them — the `styles` overrides below are what let the
 *     control grow to two or three lines instead of truncating.
 *  2. The old markup hard-coded `text-black` and default react-select colours, so
 *     the menu stayed light in dark mode. `unstyled` + `classNames` puts every
 *     surface on the same Tailwind tokens as the rest of the panel.
 *  3. The row glyph was a raw red faLocationDot, which no longer matched the map.
 *     It now renders the real SitePinMarker.
 */

const WRAP_STYLES = {
  // Let the value wrap: these all override react-select's inline base styles.
  valueContainer: (base) => ({ ...base, overflow: 'visible' }),
  singleValue: (base) => ({
    ...base,
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
    maxWidth: '100%',
  }),
  multiValue: (base) => ({ ...base, maxWidth: '100%' }),
  multiValueLabel: (base) => ({
    ...base,
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
  }),
  // Above the glass panel (z-10) and the Mapbox controls.
  menuPortal: (base) => ({ ...base, zIndex: 60 }),
};

/*
 * Widths are `border-[1px]`, not `border`, on purpose: styles/globals.css defines
 * a global `.border { @apply border-slate-200 dark:border-slate-800 }` that lands
 * after Tailwind's utilities, so on any element carrying the bare `border` class
 * an explicit border-<color> — including the blue focus border — is overridden.
 */
const CLASS_NAMES = {
  control: ({ isFocused }) =>
    [
      'rounded-lg border-[1px] border-solid bg-white text-sm transition-colors dark:bg-slate-800',
      isFocused
        ? 'border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-400'
        : 'border-slate-300 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500',
    ].join(' '),
  valueContainer: () => 'gap-1 py-1.5 pl-2.5 pr-1',
  placeholder: () => 'text-slate-400 dark:text-slate-500',
  input: () => 'text-slate-900 dark:text-slate-100',
  indicatorSeparator: () => 'hidden',
  indicatorsContainer: () => 'pr-1.5',
  dropdownIndicator: () =>
    'px-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
  clearIndicator: () => 'px-1 text-slate-400 hover:text-rose-500',
  menu: () =>
    'mt-1 overflow-hidden rounded-xl border-[1px] border-solid border-slate-200 bg-white shadow-xl ' +
    'dark:border-slate-700 dark:bg-slate-800',
  menuList: () => 'max-h-72 overflow-y-auto overscroll-contain py-1',
  option: ({ isFocused, isSelected }) =>
    [
      'cursor-pointer px-2.5 py-2',
      isSelected
        ? 'bg-blue-50 dark:bg-blue-500/20'
        : isFocused
          ? 'bg-slate-100 dark:bg-slate-700/60'
          : '',
    ].join(' '),
  noOptionsMessage: () => 'px-3 py-2 text-sm text-slate-500 dark:text-slate-400',
  multiValue: () =>
    'items-start gap-1 rounded-md bg-blue-50 py-0.5 pl-2 pr-0.5 dark:bg-blue-500/20',
  multiValueLabel: () => 'text-xs leading-snug text-blue-900 dark:text-blue-100',
  multiValueRemove: () =>
    'rounded px-1 text-blue-500 hover:bg-blue-100 hover:text-blue-800 ' +
    'dark:hover:bg-blue-500/30 dark:hover:text-blue-50',
};

/** Two-line row: the site's own pin, its name, and the building when it differs. */
function renderSiteOption({ fullSite }, { context }) {
  const showSiteName = fullSite.siteName && fullSite.siteName !== fullSite.name;

  return (
    <div className="flex items-start gap-2">
      <SitePinMarker
        size={15}
        interactive={false}
        // In the control, match the colour the site's pin has on the map.
        isSelected={context === 'value'}
      />
      <div className="min-w-0">
        <span className="block break-words text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
          {fullSite.name}
        </span>
        {showSiteName ? (
          <span className="block break-words text-xs leading-snug text-slate-500 dark:text-slate-400">
            {fullSite.siteName}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Sorted so a 100+ entry list is scannable. */
function useSiteOptions() {
  const { data: Nodes, error, isLoading } = useSWR('/api/nodes', fetcher);

  const options = useMemo(() => {
    if (!Nodes) return [];
    return Object.values(Nodes)
      .map((node) => ({ value: node.id, label: node.name, fullSite: node }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [Nodes]);

  return { options, error, isLoading };
}

// react-select renders different markup on the server than after hydration, so
// both pickers wait for mount (this is why the original had an isMounted gate).
function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  return isMounted;
}

const PORTAL_TARGET = () => (typeof document === 'undefined' ? undefined : document.body);

export function SiteSelectBox({ selectedSite, setSelectedSite, id = 'site-select' }) {
  const { options, error, isLoading } = useSiteOptions();
  const isMounted = useIsMounted();

  if (!isMounted || isLoading) return <Skeleton height={40} />;
  if (error) return <div className="text-sm text-rose-500">Error loading sites</div>;

  return (
    <Select
      unstyled
      instanceId={id}
      inputId={id}
      options={options}
      formatOptionLabel={renderSiteOption}
      classNames={CLASS_NAMES}
      styles={WRAP_STYLES}
      menuPortalTarget={PORTAL_TARGET()}
      menuPlacement="auto"
      placeholder="Select a site…"
      // Clearing is how you leave a site from the panel header.
      isClearable
      value={selectedSite ? options.find((option) => option.value === selectedSite.id) ?? null : null}
      onChange={(option) => setSelectedSite && setSelectedSite(option ? option.fullSite : null)}
    />
  );
}

export function SiteMultiSelectBox({ selectedSites = [], setSelectedSites, id = 'site-multi-select' }) {
  const { options, error, isLoading } = useSiteOptions();
  const isMounted = useIsMounted();

  if (!isMounted || isLoading) return <Skeleton height={40} />;
  if (error) return <div className="text-sm text-rose-500">Error loading sites</div>;

  const value = selectedSites
    .map((site) => options.find((option) => option.value === site.id))
    .filter(Boolean);

  return (
    <Select
      isMulti
      unstyled
      instanceId={id}
      inputId={id}
      options={options}
      // Chips only need the name; the pin and building would crowd the control.
      formatOptionLabel={(option, meta) =>
        meta.context === 'value' ? option.label : renderSiteOption(option, meta)
      }
      classNames={CLASS_NAMES}
      styles={WRAP_STYLES}
      menuPortalTarget={PORTAL_TARGET()}
      menuPlacement="auto"
      placeholder="Select multiple sites…"
      closeMenuOnSelect={false}
      value={value}
      onChange={(selected) =>
        setSelectedSites && setSelectedSites(selected ? selected.map((option) => option.fullSite) : [])
      }
    />
  );
}
