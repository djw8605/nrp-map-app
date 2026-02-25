import { useEffect, useMemo, useRef, useState } from 'react';
import { RiArrowDownLine, RiArrowUpLine, RiDatabase2Line } from '@remixicon/react';
import { AreaChart, Card } from '@tremor/react';
import { formatNetworkRate, formatShortNumber } from './formatters';

function useCountUpValue(targetValue, { duration = 700, enabled = true } = {}) {
  const numericTarget = Number.isFinite(targetValue) ? targetValue : 0;
  const [animatedValue, setAnimatedValue] = useState(numericTarget);
  const valueRef = useRef(numericTarget);

  useEffect(() => {
    if (!enabled) {
      valueRef.current = numericTarget;
      setAnimatedValue(numericTarget);
      return undefined;
    }

    const startValue = valueRef.current;
    const delta = numericTarget - startValue;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + delta * eased;
      valueRef.current = nextValue;
      setAnimatedValue(nextValue);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [duration, enabled, numericTarget]);

  return animatedValue;
}

function KpiValue({ loading, value, accentClassName = 'text-slate-100' }) {
  if (loading) {
    return <div className="mt-2 h-9 w-40 animate-pulse rounded-md bg-slate-700/70" />;
  }

  return (
    <div className={`mt-1.5 text-[2rem] font-semibold leading-none tracking-tight ${accentClassName}`}>
      {value}
    </div>
  );
}

function KpiTrend({ loading, chartData, category, color, chartClassName = '' }) {
  if (loading) {
    return <div className="mt-2 h-16 w-full animate-pulse rounded-md bg-slate-700/50" />;
  }

  if (!chartData.length) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-slate-700 bg-slate-900/30 p-2 text-center text-xs text-slate-400">
        No trend data available
      </div>
    );
  }

  return (
    <div className={chartClassName}>
      <AreaChart
        data={chartData}
        index="time"
        categories={[category]}
        colors={[color]}
        showLegend={false}
        showYAxis={false}
        showGridLines={false}
        showGradient={false}
        startEndOnly={true}
        valueFormatter={formatNetworkRate}
        className="mt-1.5 h-16"
      />
    </div>
  );
}

function KpiTitle({ icon: Icon, title, iconClassName }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${iconClassName}`}>
        <Icon size={14} />
      </span>
      <span>{title}</span>
    </div>
  );
}

export default function OsdfKpis({ totalNodes, aggregateTraffic, isLoading }) {
  const trendData = useMemo(() => {
    const points = Array.isArray(aggregateTraffic?.timeseries) ? aggregateTraffic.timeseries : [];
    return points.map((point) => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      sent: Number(point.upload) || 0,
      received: Number(point.download) || 0,
    }));
  }, [aggregateTraffic?.timeseries]);

  const animatedTotalNodes = useCountUpValue(totalNodes, {
    duration: 700,
    enabled: !isLoading,
  });
  const animatedSent = useCountUpValue(aggregateTraffic?.upload || 0, {
    duration: 850,
    enabled: !isLoading,
  });
  const animatedReceived = useCountUpValue(aggregateTraffic?.download || 0, {
    duration: 850,
    enabled: !isLoading,
  });

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Card className="!p-4 border border-slate-600/90 bg-slate-800/80 shadow-none ring-0">
        <KpiTitle
          icon={RiDatabase2Line}
          title="Total OSDF Nodes"
          iconClassName="bg-slate-700 text-slate-200"
        />
        <KpiValue loading={isLoading} value={formatShortNumber(Math.round(animatedTotalNodes))} />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Not all OSDF nodes are part of the{' '}
          <a
            href="https://nrp.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-300 underline decoration-sky-500/60 underline-offset-2 hover:text-sky-200"
          >
            National Research Platform
          </a>
          . Only OSDF nodes that are part of the NRP are measured and visualized here.
        </p>
      </Card>

      <Card className="!p-4 border border-emerald-500/45 bg-slate-800/85 shadow-none ring-0">
        <KpiTitle
          icon={RiArrowUpLine}
          title="Data being sent from OSDF nodes"
          iconClassName="bg-emerald-500/20 text-[#22ff88]"
        />
        <KpiValue
          loading={isLoading}
          value={formatNetworkRate(animatedSent)}
          accentClassName="text-[#7dffbc]"
        />
        <KpiTrend
          loading={isLoading}
          chartData={trendData}
          category="sent"
          color="emerald"
          chartClassName="kpi-trend-sent"
        />
      </Card>

      <Card className="!p-4 border border-sky-500/45 bg-slate-800/85 shadow-none ring-0">
        <KpiTitle
          icon={RiArrowDownLine}
          title="Data being received by OSDF nodes"
          iconClassName="bg-sky-500/20 text-sky-300"
        />
        <KpiValue
          loading={isLoading}
          value={formatNetworkRate(animatedReceived)}
          accentClassName="text-sky-200"
        />
        <KpiTrend
          loading={isLoading}
          chartData={trendData}
          category="received"
          color="sky"
          chartClassName="kpi-trend-received"
        />
      </Card>
    </div>
  );
}
