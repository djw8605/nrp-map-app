import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';

const SWR_OPTIONS = { revalidateOnFocus: false };

/*
 * The usage payload and the region outlines, fetched only once the usage view
 * is first shown: both keys stay null until then, so a visitor who never
 * toggles loads exactly what they loaded before.
 */
export function useUsageData(enabled) {
  const usage = useSWR(enabled ? '/api/usageByRegion' : null, fetcher, SWR_OPTIONS);
  const shapes = useSWR(enabled ? '/geo/usage-regions.json' : null, fetcher, SWR_OPTIONS);
  const error = usage.error || shapes.error;

  return {
    usage: usage.data,
    shapes: shapes.data,
    error,
    isLoading: Boolean(enabled && !error && (!usage.data || !shapes.data)),
  };
}
