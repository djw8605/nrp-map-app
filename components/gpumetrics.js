import useSWR from 'swr'
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Card, BadgeDelta } from '@tremor/react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { fetcher } from '../lib/fetcher';
import { reportPrometheusError } from '../lib/prometheusToastStore';
import { formatCompactNumber } from '../lib/formatUtils';


const numberFormatter = (number) => {
  return Intl.NumberFormat('us').format(number).toString();
};

const percentageFormatter = (number) => {
  return Intl.NumberFormat('us').format(number).toString() + '%';
}


const categories = [
  { name: 'GPUs Allocated',
    chartCategory: 'gpus',
    valueFormatter: numberFormatter,
    color: 'emerald'
  },
  { name: 'Running Jupyter Pods',
    chartCategory: 'jupyter_pods',
    valueFormatter: numberFormatter,
    color: 'blue'
  },
  { name: 'Active Research Groups using GPUs',
    chartCategory: 'gpu_namespaces',
    valueFormatter: numberFormatter,
    color: 'fuchsia'
  },
];

const customTooltipHandler = (props, setselectedChartData) => {
  if (props.active) {
    setselectedChartData((prev) => {
      if (prev?.label === props?.label) return prev;
      return props;
    });
  } else {
    setselectedChartData(null);
  }
  return null;
};


function CustomChart({ item, data }) {
  if (data == null || data.length == 0) {
    return (
      <Card className="rounded-xl shadow-sm p-5 flex flex-col justify-between min-h-[210px]">
        <Skeleton height={150} />
      </Card>
    );
  }
  const [selectedChartData, setselectedChartData] = useState(null);
  const payload = selectedChartData?.payload[0];
  const currentRaw = payload
    ? payload?.payload[item.chartCategory]
    : data[data.length - 1][item.chartCategory];
  const formattedValue = item.valueFormatter(currentRaw);

  // Calculate percent change from first to last value
  const firstVal = data[0]?.[item.chartCategory];
  const lastVal = data[data.length - 1]?.[item.chartCategory];
  let pctChange = null;
  let deltaType = 'unchanged';
  if (firstVal != null && lastVal != null && firstVal !== 0) {
    pctChange = (lastVal - firstVal) / firstVal;
    if (pctChange > 0.15) deltaType = 'increase';
    else if (pctChange > 0.02) deltaType = 'moderateIncrease';
    else if (pctChange > -0.02) deltaType = 'unchanged';
    else if (pctChange > -0.15) deltaType = 'moderateDecrease';
    else deltaType = 'decrease';
  }

  return (
    <Card className="rounded-xl shadow-sm p-5 flex flex-col justify-between min-h-[210px]">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {item.name}
        </dt>
        <dd className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong lg:text-3xl leading-tight">
            {formattedValue}
          </span>
          {pctChange != null && (
            <BadgeDelta size="xs" deltaType={deltaType}>
              {(Math.abs(pctChange) * 100).toFixed(0)}%
            </BadgeDelta>
          )}
        </dd>
      </div>
      <div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {payload ? payload?.payload?.humanDate : data[data.length - 1].humanDate}
        </span>
        <AreaChart
          data={data}
          index="humanDate"
          categories={[item.chartCategory]}
          colors={[item.color]}
          showLegend={false}
          showYAxis={false}
          showGridLines={false}
          showGradient={true}
          startEndOnly={true}
          className="-mb-2 mt-2 h-24"
          customTooltip={(props) => {
            customTooltipHandler(props, setselectedChartData);
          }}
        />
      </div>
    </Card>
  );
}

function ErrorCard({ title, message }) {
  return (
    <Card className="rounded-xl shadow-sm p-5 min-h-[210px]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </dt>
      <dd className="mt-2 text-sm text-red-600 dark:text-red-400">
        {message}
      </dd>
    </Card>
  );
}


export function ClusterMetrics({ timeRange = '24h', onLastUpdated }) {

  const { data, error, mutate } = useSWR(`/api/prommetrics?query=clustermetrics&range=${timeRange}`, fetcher, {
    refreshInterval: 3600000,
    onSuccess: () => {
      if (onLastUpdated) {
        onLastUpdated(Date.now());
      }
    },
  });
  const errorMessage = error?.message || null;
  useEffect(() => {
    if (errorMessage) {
      reportPrometheusError(errorMessage);
    }
  }, [errorMessage]);
  if (data) {
    console.log("Got data from api");
    console.log(data);
    // Go through the data, and for each time item, convert it to human readable hours
    for (let i = 0; i < data.values.length; i++) {
      data.values[i].humanDate = new Date(data.values[i].date * 1000).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', hour12: true });
    }
  }
  
  return (
    <>
      <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((item) => (
          errorMessage ? (
            <ErrorCard key={item.name} title={item.name} message={errorMessage} />
          ) : (
            <CustomChart item={item} key={item.name} data={data ? data.values : null} />
          )
        ))}
      </dl>
    </>
  );

}



