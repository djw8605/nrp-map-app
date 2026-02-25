import { useEffect, useMemo, useRef, useState } from 'react';
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
  const chartContainerRef = useRef(null);
  const [isChartReady, setIsChartReady] = useState(false);

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

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return undefined;

    let frameId = 0;
    let resizeObserver;

    const updateChartReady = () => {
      const ready = container.clientWidth > 0 && container.clientHeight > 0;
      setIsChartReady((previous) => (previous === ready ? previous : ready));
    };

    const scheduleMeasure = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateChartReady);
    };

    scheduleMeasure();
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(container);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [node?.nodeId, chartData.length]);

  return (
    <Card className="w-[320px] overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 shadow-none ring-0">
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
        <div ref={chartContainerRef} className="h-28 w-full min-w-[280px]">
          {chartData.length > 0 && isChartReady ? (
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
              className="h-28 w-full"
            />
          ) : (
            <div className="rounded-md border border-dashed border-slate-700 bg-slate-800/60 p-4 text-center text-xs text-slate-400">
              {chartData.length > 0 ? 'Preparing chart...' : 'No traffic time series available.'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
