import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {
  faRotateRight,
  faCircleArrowUp, faCircleArrowDown
} from "@fortawesome/free-solid-svg-icons";
import useSWR from 'swr'
import {Badge, BarChart, Card, SparkAreaChart, BadgeDelta, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell} from '@tremor/react';
import {useEffect, useMemo} from 'react';
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { fetcher } from '../lib/fetcher';
import { reportPrometheusError } from '../lib/prometheusToastStore';
import { formatCompactNumber } from '../lib/formatUtils';

/*
 * Fixed metrics window. Previously driven by a global 24h/7d/30d selector; that
 * selector was removed and every panel had been rendering at 24h, so this pins
 * the behaviour that was actually shipping.
 */
const METRICS_RANGE = '24h';

/*
 * The GPU-hours trend comes from the accounting service, which only has daily
 * points, so a 24h window would draw a single bar. Thirty days is the same
 * window the accounting tools default to for trends.
 */
const GPU_TREND_RANGE = '30d';

/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
function humanTransferSpeed(bytes, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u] + "/s";
}

function LoadingElement() {
  return (
    <div className="flex gap-2 items-center">
      <div>
        <FontAwesomeIcon icon={faRotateRight} className='animate-spin h-6 w-6'/>
      </div>
      <div className=''>Loading...</div>
    </div>
  )
}

function NetworkCard({data, currentValue, title, icon, iconColor, graphColor}) {
  return (
    <Card className="w-full flex flex-col justify-between rounded-xl shadow-sm p-0">
      <div className="flex flex-row justify-between items-center px-4 pt-4">
        <div className="flex flex-col items-start">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
          <p className="text-xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {data ? currentValue : "Loading..."}
          </p>
        </div>
        <div>
          <FontAwesomeIcon icon={icon} size="lg" className={`${iconColor}`}/>
        </div>
      </div>
      {!data ? (
        <LoadingElement/>
      ) : (
        <SparkAreaChart
          data={data}
          categories={['value']}
          index={'time'}
          colors={[graphColor]}
          className="w-full mt-2"
        />
      )}
    </Card>
  )
}

export function SiteNetworkStats({site}) {

  const {data, error} = useSWR(`/api/sitenetwork?site=${site.slug}&range=${METRICS_RANGE}`, fetcher, {refreshInterval: 60000});
  const errorMessage = error?.message || null;
  useEffect(() => {
    if (errorMessage) {
      reportPrometheusError(errorMessage);
    }
  }, [errorMessage]);
  var humanTransmit = "";
  var humanReceive = "";
  if (data) {
    // Get the last element from data.transmit
    let last_transmit = data.transmit[data.transmit.length - 1];
    humanTransmit = humanTransferSpeed(last_transmit.value, true);

    let last_receive = data.receive[data.receive.length - 1];
    humanReceive = humanTransferSpeed(last_receive.value, true);
  }

  if (errorMessage) {
    return (
      <div className='mx-auto w-full grid lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-2 grid-cols-1 gap-2'>
        <Card className="w-full p-4 text-sm text-red-600 dark:text-red-400">
          Failed to load network metrics: {errorMessage}
        </Card>
        <Card className="w-full p-4 text-sm text-red-600 dark:text-red-400">
          Failed to load network metrics: {errorMessage}
        </Card>
      </div>
    );
  }


  return (
    <>
      <div className='mx-auto w-full grid lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-2 grid-cols-1 gap-2'>
        <NetworkCard
          data={data ? data.receive : null}
          currentValue={humanReceive}
          title="Receive"
          icon={faCircleArrowDown}
          iconColor="text-green-500"
          graphColor="emerald"
        />
        <NetworkCard
          data={data ? data.transmit : null}
          currentValue={humanTransmit}
          title="Transmit"
          icon={faCircleArrowUp}
          iconColor="text-red-500"
          graphColor="red"
        />
      </div>

    </>
  )
}

function MetricCard({title, value, belowText, difference}) {

  let deltaType = "moderateIncrease";
  if (difference > 0.15) {
    deltaType = "increase";
  } else if (difference > 0.02) {
    deltaType = "moderateIncrease";
  } else if (difference > -.02) {
    deltaType = "unchanged";
  } else if (difference > -0.15) {
    deltaType = "moderateDecrease";
  } else if (difference <= -0.15) {
    deltaType = "decrease";
  }

  return (
    <div className='w-full p-4'>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>
      {value == null ? (
        <div className='mt-2'>
          <Skeleton height={32} width={160} />
          <div className='mt-2'>
            <Skeleton height={12} width={110} />
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {value}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            {difference && (
              <BadgeDelta size="xs" deltaType={deltaType} isIncreasePositive={true}>
                {(difference * 100).toLocaleString(undefined, {maximumFractionDigits: 0})}%
              </BadgeDelta>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500">{belowText}</span>
          </div>
        </>
      )}
    </div>
  )
}

export function SiteStats({site}) {

  const {data, error} = useSWR(`/api/sitemetrics?site=${site.slug}&range=${METRICS_RANGE}`, fetcher, {refreshInterval: 60000});
  const errorMessage = error?.message || null;
  useEffect(() => {
    if (errorMessage) {
      reportPrometheusError(errorMessage);
    }
  }, [errorMessage]);

  let totalGpus = site.nodes.reduce((acc, node) => {
    return acc + parseInt(node.gpus)
  }, 0);

  // Accounting data is daily, so the window the API actually served may not be
  // the literal 24 hours the old Thanos query used. Label what came back.
  const windowDays = data?.days || 1;
  const periodLabel = windowDays === 1 ? 'vs previous day' : `vs previous ${windowDays} days`;

  if (errorMessage) {
    return (
      <Card className='w-full rounded-xl shadow-sm p-4 text-sm text-red-600 dark:text-red-400'>
        Failed to load site metrics: {errorMessage}
      </Card>
    );
  }

  return (
    <Card className='w-full rounded-xl shadow-sm p-0 overflow-hidden'>
      <div className='px-4 pt-4 pb-2'>
        <h3 className='text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'>Compute Usage</h3>
      </div>
      <div className='grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700'>
        {totalGpus > 0 && (
          <MetricCard
            title="GPU Hours"
            value={data ? formatCompactNumber(data.gpuHours, 0) : null}
            belowText={periodLabel}
            difference={data ? ((data.gpuHours - data.prevGpuHours) / data.prevGpuHours) : null}/>
        )}
        <MetricCard
          title="CPU Hours"
          value={data ? formatCompactNumber(data.cpuHours, 0) : null}
          belowText={periodLabel}
          difference={data ? ((data.cpuHours - data.prevCpuHours) / data.prevCpuHours) : null}
        />
      </div>
    </Card>
  )
}

function StatusBadge({icon, text, color}) {

  return (
    <>
      <Badge
        icon={icon}
      >
        {text}
      </Badge>
    </>

  )

}

export function SiteGpuStats({site}) {
  // Fetch the GPU metrics
  const {data, error} = useSWR(`/api/sitegpus?site=${site.slug}&range=${GPU_TREND_RANGE}`, fetcher, {refreshInterval: 60000});
  const errorMessage = error?.message || null;
  useEffect(() => {
    if (errorMessage) {
      reportPrometheusError(errorMessage);
    }
  }, [errorMessage]);

  var cleaned_data = null;
  if (data) {
    // `item.time` is a UTC calendar day (`YYYY-MM-DD`) from the accounting
    // service; format it in UTC so it doesn't slip a day west of Greenwich.
    const dateFormatter = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'});

    cleaned_data = data.map((item) => {
      let current_date = new Date(item.time);
      return {"Date": dateFormatter.format(current_date), "GPU Hours": item.value}
    });
  }

  const dataFormatter = (number) =>
    Intl.NumberFormat('us').format(number).toString();

  if (errorMessage) {
    return (
      <Card className='w-full rounded-xl shadow-sm p-4 text-sm text-red-600 dark:text-red-400'>
        Failed to load GPU metrics: {errorMessage}
      </Card>
    );
  }

  const title = 'GPU Hours (Daily)';

  return (
    <Card
      className='w-full rounded-xl shadow-sm p-4 max-h-80'>
      <h3 className="text-sm font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
        {title}
      </h3>
      {!data ? (
        <LoadingElement/>
      ) : (
        <BarChart
          className='max-h-40'
          data={cleaned_data}
          index="Date"
          categories={["GPU Hours"]}
          colors={['blue']}
          formatter={dataFormatter}
          yAxisWidth={48}
          onValueChange={(v) => console.log(v)}
        />
      )}

    </Card>
  )

}

export function SiteGpuTypes({site}) {

  var gpuTypes = useMemo(() => {
    var tmpGpuTypes = new Map();
    for (let node in site.nodes) {
      let gpuType = site.nodes[node].gpuType;
      if (!gpuType) {
        continue;
      }
      if (tmpGpuTypes.has(gpuType)) {
        tmpGpuTypes.set(gpuType, tmpGpuTypes.get(gpuType) + (parseInt(site.nodes[node].gpus)));
      } else {
        tmpGpuTypes.set(gpuType, parseInt(site.nodes[node].gpus));
      }
    }
    return Array.from(tmpGpuTypes, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [site]);

  return (
    <Card className='w-full rounded-xl shadow-sm p-4'>
      <h3 className="text-sm font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong mb-1.5">
        GPU Types
      </h3>
      <Table>
        <TableHead className="bg-transparent">
          <TableRow className="border-b border-slate-200 dark:border-slate-700">
            <TableHeaderCell className="bg-transparent py-1">Type</TableHeaderCell>
            <TableHeaderCell className="text-right bg-transparent py-1">Count</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {gpuTypes.map((gpu) => (
            <TableRow key={gpu.name}>
              <TableCell className="py-1.5">{gpu.name}</TableCell>
              <TableCell className="text-right font-semibold py-1.5">{gpu.count.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
