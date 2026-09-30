import { useCallback, useEffect, useRef, useState } from 'react';
import MapOverlayPanel from '../map/MapOverlayPanel';
import { UsageOverviewContent, UsageRegionContent } from './UsagePanelContent';
import { getRegion, regionRank } from '../../lib/usageRegions';

/*
 * In a compact container the panel is a bottom sheet. The usage sheet stops
 * short of the default 85% so the region it describes stays visible above it;
 * UsageMapLayer fits the camera into the space this leaves. Keep the fraction
 * and the Tailwind class in step.
 */
export const USAGE_SHEET_MAX_FRACTION = 0.55;
const SHEET_MAX_HEIGHT_CLASS = 'max-h-[55%]';

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/*
 * A rank only where it says something: first outright, or top five and not
 * tied. "#34 of 42" for what is really a ten-way tie said nothing true.
 */
function regionSubtitle(usage, region) {
  const institutions = plural(region.institutions.length, 'institution', 'institutions');
  const rank = regionRank(usage, region.code);
  if (!rank || rank.tied > 1 || rank.rank > 5) return institutions;
  return `${institutions} · ${rank.rank === 1 ? 'most in the US' : `#${rank.rank} in the US`}`;
}

/*
 * One MapOverlayPanel for both states, so React keeps the same instance and its
 * expanded/collapsed state. `expandKey` opens a collapsed bottom sheet when a
 * region is clicked on the map (small iframes start collapsed).
 *
 * Keyboard flow: picking a row moves focus to the region's heading, and leaving
 * the region (Back or Escape) returns focus to that row. Each change is also
 * announced, since the map changing is not something a screen reader sees.
 */
export default function UsagePanel({ usage, error, isLoading, onRetry, usageSelection }) {
  const { selection, selectFromPanel, clear, mapHoverCode, setPanelHoverCode } = usageSelection;
  const region = getRegion(usage, selection.code);

  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const titleRef = useRef(null);
  const overviewRef = useRef(null);
  const returnRowRef = useRef(null);

  const pick = useCallback((code, institution, rowKey) => {
    returnRowRef.current = rowKey;
    selectFromPanel(code, institution);
  }, [selectFromPanel]);

  const regionCode = region?.code ?? null;
  useEffect(() => {
    if (regionCode) {
      setAnnouncement(`${region.name}: ${plural(region.institutions.length, 'institution', 'institutions')}`);
      if (selection.source === 'panel') titleRef.current?.focus({ preventScroll: true });
      return;
    }
    // Back to the overview. Only take focus back if it was dropped (the heading
    // or Back button that held it is gone), never from the map or elsewhere.
    const rowKey = returnRowRef.current;
    returnRowRef.current = null;
    if (!rowKey) return;
    setAnnouncement('All regions');
    if (document.activeElement && document.activeElement !== document.body) return;
    const row = [...(overviewRef.current?.querySelectorAll('[data-usage-row]') || [])]
      .find((element) => element.dataset.usageRow === rowKey);
    row?.focus();
    // Keyed on the region alone: a new pick of the same region re-announces nothing.
  }, [regionCode]);

  return (
    <>
      <MapOverlayPanel
        position="right"
        title={region?.name}
        subtitle={region ? regionSubtitle(usage, region) : undefined}
        titleRef={titleRef}
        onBack={region ? clear : undefined}
        expandKey={region?.code ?? null}
        compactMaxHeightClass={SHEET_MAX_HEIGHT_CLASS}
      >
        {region ? (
          <UsageRegionContent
            region={region}
            window={usage?.window}
            highlightName={selection.institution}
          />
        ) : (
          <UsageOverviewContent
            usage={usage}
            error={error}
            isLoading={isLoading}
            onRetry={onRetry}
            query={query}
            onQueryChange={setQuery}
            showAll={showAll}
            onShowAllChange={setShowAll}
            litCode={mapHoverCode}
            onPick={pick}
            onHover={setPanelHoverCode}
            containerRef={overviewRef}
          />
        )}
      </MapOverlayPanel>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </>
  );
}
