import MapOverlayPanel from '../map/MapOverlayPanel';
import { UsageOverviewContent, UsageRegionContent } from './UsagePanelContent';
import { getRegion } from '../../lib/usageRegions';

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
      subtitle={region ? `${region.institutions.length} ${region.institutions.length === 1 ? 'institution' : 'institutions'}` : undefined}
      onBack={region ? () => onSelectCode(null) : undefined}
      expandKey={region?.code ?? null}
    >
      {region ? (
        <UsageRegionContent region={region} />
      ) : (
        <UsageOverviewContent usage={usage} error={error} isLoading={isLoading} onSelectRegion={onSelectCode} />
      )}
    </MapOverlayPanel>
  );
}
