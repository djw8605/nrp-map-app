'use client'
import { Card } from '@tremor/react';
import { RiServerLine, RiCpuLine, RiMapPinLine, RiDashboard3Line } from '@remixicon/react';
import useSWR from 'swr';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { fetcher } from '../lib/fetcher';

function KpiCard({ title, value, icon: Icon, iconColor, description }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
            {title}
          </p>
          {value != null ? (
            <p className="mt-1 text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {value}
            </p>
          ) : (
            <div className="mt-1">
              <Skeleton height={32} width={80} />
            </div>
          )}
          <p className="mt-1 text-tremor-label text-tremor-content dark:text-dark-tremor-content">
            {description}
          </p>
        </div>
        <Icon className={`h-8 w-8 ${iconColor} flex-shrink-0`} aria-hidden="true" />
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
    <div className="container mx-auto mt-2 px-2 sm:px-0">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Sites"
          value={totalSites != null ? totalSites.toLocaleString() : null}
          icon={RiMapPinLine}
          iconColor="text-red-500"
          description="Hosting NRP nodes"
        />
        <KpiCard
          title="Nodes"
          value={totalNodes != null ? totalNodes.toLocaleString() : null}
          icon={RiServerLine}
          iconColor="text-green-500"
          description="Registered in Kubernetes"
        />
        <KpiCard
          title="GPUs"
          value={totalGPUs != null ? totalGPUs.toLocaleString() : null}
          icon={RiDashboard3Line}
          iconColor="text-blue-500"
          description="Across all nodes"
        />
        <KpiCard
          title="CPU Cores"
          value={totalCPUs != null ? totalCPUs.toLocaleString() : null}
          icon={RiCpuLine}
          iconColor="text-orange-500"
          description="Across all nodes"
        />
      </dl>
    </div>
  );
}
