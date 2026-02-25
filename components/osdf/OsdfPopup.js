import { useMemo } from 'react';
import { AreaChart, Card } from '@tremor/react';
import { formatNetworkRate } from './formatters';

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export default function OsdfPopup({ node }) {
  const chartData = useMemo(() => {
    const rawPoints = Array.isArray(node?.timeseries) ? node.timeseries : [];
    return rawPoints.map((point) => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      sent: Number(point.upload) || 0,
      received: Number(point.download) || 0,
    }));
  }, [node?.timeseries]);

  return (
    <Card className="w-[320px] border border-slate-700 bg-slate-900 text-slate-100 shadow-none ring-0">
      <div className="space-y-1">
        <div className="text-base font-semibold text-slate-100">{node.institution}</div>
        <div className="text-xs text-slate-400">{node.nodeId}</div>
      </div>

      <div className="mt-4 space-y-2">
        <StatRow
          label="Status"
          value={
            <span className="inline-flex items-center gap-2 text-emerald-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Healthy
            </span>
          }
        />
        <StatRow label="Sent" value={formatNetworkRate(node.upload)} />
        <StatRow label="Received" value={formatNetworkRate(node.download)} />
      </div>

      <div className="mt-4 border-t border-slate-700 pt-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Last 60 minutes
        </div>
        {chartData.length > 0 ? (
          <AreaChart
            data={chartData}
            index="time"
            categories={['sent', 'received']}
            colors={['emerald', 'sky']}
            showLegend={true}
            showGridLines={false}
            startEndOnly={true}
            showYAxis={false}
            valueFormatter={formatNetworkRate}
            className="h-36"
          />
        ) : (
          <div className="rounded-md border border-dashed border-slate-700 bg-slate-800/60 p-4 text-center text-xs text-slate-400">
            No traffic time series available.
          </div>
        )}
      </div>
    </Card>
  );
}
