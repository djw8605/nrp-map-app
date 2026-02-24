import useSWR from 'swr'
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Card } from '@tremor/react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { fetcher } from '../lib/fetcher';
import { reportPrometheusError } from '../lib/prometheusToastStore';


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
      <Card>
        <Skeleton height={150} />
      </Card>
    );
  }
  const [selectedChartData, setselectedChartData] = useState(null);
  const payload = selectedChartData?.payload[0];
  const formattedValue = payload
    ? item.valueFormatter(payload?.payload[item.chartCategory])
    : item.valueFormatter(data[data.length-1][item.chartCategory]);
  return (
    <Card>
      <dt className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
        {item.name}
      </dt>
      <dd className="mt-1 flex items-baseline justify-between">
        <span className="text-tremor-title font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          {formattedValue}
        </span>
        <span className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          {payload ? `${payload?.payload?.humanDate}` : `${data[data.length-1].humanDate}`}
        </span>
      </dd>
      <AreaChart
        data={data}
        index="humanDate"
        categories={[item.chartCategory]}
        colors={[item.color]}
        showLegend={false}
        showYAxis={false}
        showGridLines={false}
        showGradient={false}
        startEndOnly={true}
        className="-mb-2 mt-3 h-24"
        customTooltip={(props) => {
          customTooltipHandler(props, setselectedChartData);
        }}
      />
    </Card>
  );
}

function ErrorCard({ title, message }) {
  return (
    <Card>
      <dt className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
        {title}
      </dt>
      <dd className="mt-2 text-sm text-red-600 dark:text-red-400">
        {message}
      </dd>
    </Card>
  );
}


export function ClusterMetrics({ timeRange = '24h' }) {

  const { data, error, mutate } = useSWR(`/api/prommetrics?query=clustermetrics&range=${timeRange}`, fetcher, { refreshInterval: 3600000 });
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
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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



