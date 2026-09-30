import MapOverlayPanel from '../map/MapOverlayPanel';
import { UsageOverviewContent, UsageRegionContent } from './UsagePanelContent';
import { getRegion, regionRank } from '../../lib/usageRegions';

function regionSubtitle(usage, region) {
  const count = region.institutions.length;
  const institutions = `${count} ${count === 1 ? 'institution' : 'institutions'}`;
  const rank = regionRank(usage, region.code);
  return rank ? `${institutions} · ranks #${rank.rank} of ${rank.total}` : institutions;
}

/*
 * One MapOverlayPanel for both states, so React keeps the same instance and its
 * expanded/collapsed state. `expandKey` opens a collapsed bottom sheet when a
 * region is clicked on the map (small iframes start collapsed).
 */
export default function UsagePanel({ usage, error, isLoading, selectedCode, onSelectCode }) {
  const region = getRegion(usage, selectedCode);

  return (
    <MapOverlayPanel
      position="right"
      title={region?.name}
      subtitle={region ? regionSubtitle(usage, region) : undefined}
      onBack={region ? () => onSelectCode(null) : undefined}
      expandKey={region?.code ?? null}
    >
      {region ? (
        <UsageRegionContent region={region} window={usage?.window} />
      ) : (
        <UsageOverviewContent usage={usage} error={error} isLoading={isLoading} />
      )}
    </MapOverlayPanel>
  );
}
