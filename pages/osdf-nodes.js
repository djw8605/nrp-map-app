import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import useSWR from 'swr';
import OsdfKpis from '../components/osdf/OsdfKpis';
import { OSDF_TRAFFIC_WINDOW_MINUTES, useOsdfTraffic } from '../hooks/useOsdfTraffic';

const OsdfMap = dynamic(() => import('../components/osdf/OsdfMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[650px] w-full animate-pulse bg-slate-800/50" />
  ),
});

const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
};

function normalizeSites(nodesPayload) {
  if (Array.isArray(nodesPayload)) return nodesPayload;
  if (nodesPayload && typeof nodesPayload === 'object') return Object.values(nodesPayload);
  return [];
}

function extractOsdfNodes(sites) {
  const osdfNodes = [];

  for (const site of sites) {
    const latitude = Number(site?.latitude);
    const longitude = Number(site?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const siteNodes = Array.isArray(site?.nodes) ? site.nodes : [];
    for (const node of siteNodes) {
      if (node?.cache !== true) continue;
      if (typeof node?.name !== 'string' || node.name.length === 0) continue;

      const slug = site?.slug || site?.id || site?.name || 'site';
      osdfNodes.push({
        id: `${slug}::${node.name}`,
        nodeId: node.name,
        institution: site?.name || site?.siteName || 'Unknown institution',
        latitude,
        longitude,
      });
    }
  }

  return osdfNodes;
}

function attachTraffic(nodes, perNodeTraffic) {
  return nodes.map((node) => {
    const direct = perNodeTraffic[node.nodeId];
    const normalized = perNodeTraffic[node.nodeId.replace(/:[0-9]+$/, '')];
    const traffic = direct || normalized || {};

    return {
      ...node,
      upload: Number(traffic.upload) || 0,
      download: Number(traffic.download) || 0,
      timeseries: Array.isArray(traffic.timeseries) ? traffic.timeseries : [],
    };
  });
}

export default function OsdfNodesPage() {
  const {
    data: nodesPayload,
    error: nodesError,
    isLoading: isNodesLoading,
  } = useSWR('/api/nodes', fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const osdfNodes = useMemo(() => extractOsdfNodes(normalizeSites(nodesPayload)), [nodesPayload]);
  const osdfNodeIds = useMemo(() => osdfNodes.map((node) => node.nodeId), [osdfNodes]);
  const {
    traffic,
    isLoading: isTrafficLoading,
    error: trafficError,
    lastUpdatedAt,
  } = useOsdfTraffic({
    windowMinutes: OSDF_TRAFFIC_WINDOW_MINUTES,
    nodeIds: osdfNodeIds,
    enabled: !isNodesLoading,
  });

  const mappedNodes = useMemo(() => attachTraffic(osdfNodes, traffic.perNode || {}), [osdfNodes, traffic.perNode]);

  return (
    <>
      <Head>
        <title>OSDF nodes</title>
      </Head>

      <main className="min-h-screen bg-slate-900 text-slate-100">
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100">OSDF nodes</h1>
            <div className="text-xs font-medium text-slate-400">
              Updated at{' '}
              {lastUpdatedAt
                ? lastUpdatedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '--'}
            </div>
          </div>

          <div className="mt-5">
            <OsdfKpis
              totalNodes={osdfNodes.length}
              aggregateTraffic={traffic.aggregate || { upload: 0, download: 0, timeseries: [] }}
              isLoading={isNodesLoading || isTrafficLoading}
            />
          </div>

          {nodesError ? (
            <div className="mt-4 rounded-lg border border-red-800/60 bg-red-950/60 px-4 py-3 text-sm text-red-200">
              Failed to load node locations from <code>/api/nodes</code>.
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <OsdfMap
            nodes={mappedNodes}
            isNodesLoading={isNodesLoading}
            isTrafficLoading={isTrafficLoading}
            trafficError={trafficError}
          />
        </div>
      </main>
    </>
  );
}
