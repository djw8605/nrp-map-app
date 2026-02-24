'use client'
import { Card } from '@tremor/react';
import { RiServerLine, RiCpuLine, RiMapPinLine, RiDashboard3Line } from '@remixicon/react';
import useSWR from 'swr';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { fetcher } from '../lib/fetcher';
import { formatCompactNumber } from '../lib/formatUtils';

function KpiCard({ title, value, icon: Icon, iconColor, description }) {
  return (
    <Card className="rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {title}
          </p>
          {value != null ? (
            <p className="mt-1 text-2xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong lg:text-3xl leading-tight">
              {value}
            </p>
          ) : (
            <div className="mt-1">
              <Skeleton height={32} width={80} />
            </div>
          )}
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {description}
          </p>
        </div>
        <Icon className={`h-7 w-7 ${iconColor} flex-shrink-0`} aria-hidden="true" />
      </div>
    </Card>
  );
}

export default function KpiRow() {
  const { data: Nodes } = useSWR('/api/nodes', fetcher);

  let totalSites = null;
  let totalNodes = null;
  let totalGPUs = null;
  let totalCPUs = null;

  if (Nodes && Array.isArray(Nodes)) {
    totalSites = Nodes.length;
    totalNodes = Nodes.reduce((acc, site) => acc + (site.nodes ? site.nodes.length : 0), 0);
    totalGPUs = Nodes.reduce((acc, site) =>
      acc + (site.nodes ? site.nodes.reduce((n, node) => n + (parseInt(node.gpus) || 0), 0) : 0), 0);
    totalCPUs = Nodes.reduce((acc, site) =>
      acc + (site.nodes ? site.nodes.reduce((n, node) => n + (parseInt(node.cpus) || 0), 0) : 0), 0);
  }

  return (
    <div className="container mx-auto px-2 sm:px-0">
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Sites"
          value={totalSites != null ? formatCompactNumber(totalSites) : null}
          icon={RiMapPinLine}
          iconColor="text-red-500"
          description="Hosting NRP nodes"
        />
        <KpiCard
          title="Nodes"
          value={totalNodes != null ? formatCompactNumber(totalNodes) : null}
          icon={RiServerLine}
          iconColor="text-green-500"
          description="Registered in Kubernetes"
        />
        <KpiCard
          title="GPUs"
          value={totalGPUs != null ? formatCompactNumber(totalGPUs) : null}
          icon={RiDashboard3Line}
          iconColor="text-blue-500"
          description="Across all nodes"
        />
        <KpiCard
          title="CPU Cores"
          value={totalCPUs != null ? formatCompactNumber(totalCPUs) : null}
          icon={RiCpuLine}
          iconColor="text-orange-500"
          description="Across all nodes"
        />
      </dl>
    </div>
  );
}
