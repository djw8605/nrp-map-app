import { useEffect } from 'react';
import useSWR from 'swr';

export const OSDF_TRAFFIC_WINDOW_MINUTES = 60;
const OSDF_TRAFFIC_REFRESH_MS = 300000;

const EMPTY_TRAFFIC = {
  perNode: {},
  aggregate: {
    upload: 0,
    download: 0,
    timeseries: [],
  },
};

const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch OSDF traffic: ${response.status}`);
  }
  return response.json();
};

export function buildOsdfTrafficKey({
  windowMinutes = OSDF_TRAFFIC_WINDOW_MINUTES,
  nodeIds = [],
  enabled = true,
} = {}) {
  if (!enabled) return null;

  const params = new URLSearchParams();
  params.set('windowMinutes', String(windowMinutes));
  if (Array.isArray(nodeIds) && nodeIds.length > 0) {
    params.set('nodeIds', nodeIds.join(','));
  }

  return `/api/osdftraffic?${params.toString()}`;
}

export function useOsdfTraffic(options = {}) {
  const key = buildOsdfTrafficKey(options);
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 15000,
  });

  useEffect(() => {
    if (!key) return undefined;

    const refreshTraffic = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      mutate();
    };

    const intervalId = setInterval(refreshTraffic, OSDF_TRAFFIC_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      mutate();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [key, mutate]);

  return {
    traffic: data || EMPTY_TRAFFIC,
    isLoading,
    error,
  };
}
