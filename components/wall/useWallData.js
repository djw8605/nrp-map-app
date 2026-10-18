import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';

const REFRESH_MS = 15 * 60 * 1000;
const FIRST_RETRY_MS = 30 * 1000;

/*
 * SWR's polling skips a key while it is in error, and its default retries stop
 * after errorRetryCount, so an unattended screen would never recover from a long
 * outage. Retry forever instead: 30 s, doubling, then every 15 minutes.
 */
function retryForever(error, key, config, revalidate, { retryCount }) {
  const delay = Math.min(REFRESH_MS, FIRST_RETRY_MS * 2 ** (retryCount - 1));
  setTimeout(() => revalidate({ retryCount }), delay);
}

/*
 * The day's wall.json and the static outline. The data refreshes every 15
 * minutes; when a refresh fails SWR keeps the last good copy on screen.
 */
export function useWallData() {
  const wall = useSWR('/api/wall', fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
    onErrorRetry: retryForever,
  });
  const outline = useSWR('/geo/us-outline.json', fetcher, { revalidateOnFocus: false });

  return {
    wall: wall.data,
    outline: outline.data,
    // Only "unavailable" if there has never been data to show.
    unavailable: Boolean(wall.error && !wall.data),
  };
}
