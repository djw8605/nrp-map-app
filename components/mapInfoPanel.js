'use client'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {
  faLocationDot,
  faExpand,
  faServer,
  faCircle,
  faNetworkWired,
  faMicrochip,
  faRotateRight,
  faChartColumn, faCircleArrowUp, faCircleArrowDown
} from "@fortawesome/free-solid-svg-icons";
import useSWR from 'swr'
import {Badge, BarChart, Card, SparkAreaChart, BadgeDelta, Flex, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell} from '@tremor/react';
import {RiCpuLine, RiServerLine, RiDatabase2Line} from '@remixicon/react';
import Select from 'react-select'
import {useState, useEffect, useMemo} from 'react';
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { fetcher } from '../lib/fetcher';
import { reportPrometheusError } from '../lib/prometheusToastStore';
import { formatCompactNumber, formatThroughput } from '../lib/formatUtils';
import SectionHeader from './SectionHeader';

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
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
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

function SiteNetworkStats({site, timeRange = '24h'}) {

  const {data, error} = useSWR(`/api/sitenetwork?site=${site.slug}&range=${timeRange}`, fetcher, {refreshInterval: 60000});
  const errorMessage = error?.message || null;
  useEffect(() => {
    if (errorMessage) {
      reportPrometheusError(errorMessage);
    }
  }, [errorMessage]);
  var humanTransmit = "";
  var humanReceive = "";
  if (data) {
    console.log(data);
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
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
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
            <span className="text-xs text-gray-400 dark:text-gray-500">{belowText}</span>
          </div>
        </>
      )}
    </div>
  )
}

function SiteStats({site, timeRange = '7d'}) {

  const {data, error} = useSWR(`/api/sitemetrics?site=${site.slug}&range=${timeRange}`, fetcher, {refreshInterval: 60000});
  const errorMessage = error?.message || null;
  useEffect(() => {
    if (errorMessage) {
      reportPrometheusError(errorMessage);
    }
  }, [errorMessage]);

  let totalGpus = site.nodes.reduce((acc, node) => {
    return acc + parseInt(node.gpus)
  }, 0);

  const periodLabels = { '24h': 'vs previous 24h', '7d': 'vs previous 7d', '30d': 'vs previous 30d' };
  const periodLabel = periodLabels[timeRange] || 'vs previous period';

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
        <h3 className='text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>Compute Usage</h3>
      </div>
      <div className='grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700'>
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

function SiteGpuStats({site, timeRange = '7d'}) {
  // Fetch the GPU metrics
  const {data, error} = useSWR(`/api/sitegpus?site=${site.slug}&range=${timeRange}`, fetcher, {refreshInterval: 60000});
  const errorMessage = error?.message || null;
  useEffect(() => {
    if (errorMessage) {
      reportPrometheusError(errorMessage);
    }
  }, [errorMessage]);

  var cleaned_data = null;
  if (data) {
    console.log(data);
    // Convert Date to just the month/day
    cleaned_data = data.map((item) => {
      console.log(item.time);
      let current_date = new Date(item.time);
      return {"Date": (current_date.getMonth()+1) + "/" + current_date.getDate(), "GPU Hours": item.value}
    });
    console.log(cleaned_data);
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

  const titleMap = {
    '24h': 'GPU Hours (Hourly)',
    '7d': 'GPU Hours per Day',
    '30d': 'GPU Hours per Day',
  };
  const title = titleMap[timeRange] || 'GPU Hours per Day';

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

function SiteGpuTypes({site}) {

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
          <TableRow className="border-b border-gray-200 dark:border-gray-700">
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

function SiteMultiSelectBox({selectedSites=[], setSelectedSites}) {
  const { data: Nodes, error, isLoading } = useSWR('/api/nodes', fetcher);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || isLoading || !Nodes) {
    return (
      <div className="w-full">
        <Skeleton height={44} />
      </div>
    );
  }

  if (error) {
    return <div>Error loading sites</div>;
  }

  const options = Nodes.map((node) => {
    return (
      {value: node.id, label: node.name, fullSite: node}
    )
  });

  const formatOptionLabel = ({value, label, fullSite}) => (
    <div className="flex flex-row gap-2 items-center text-black">
      <FontAwesomeIcon icon={faLocationDot} size="2x" className="text-red-500 text-xl"/>
      <div>
        <h2 className="text-xl font-bold">{fullSite.name}</h2>
        {fullSite.name == fullSite.siteName ? null :
          <h6
            className="whitespace-nowrap truncate text-tremor-default text-tremor-content group-hover:text-tremor-content-emphasis  opacity-100 ">{fullSite.siteName}</h6>}
      </div>
    </div>
  );

  const selectedOptions = selectedSites.map(site => {
    return options.find(opt => opt.value === site.id);
  }).filter(Boolean);

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '38px',
      maxHeight: '120px',
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
    valueContainer: (provided) => ({
      ...provided,
      maxHeight: '118px',
      overflowY: 'auto',
      paddingTop: '2px',
      paddingBottom: '2px',
    }),
    multiValue: (provided) => ({
      ...provided,
      maxWidth: 'calc(100% - 10px)',
      margin: '2px',
    }),
    menu: (provided) => ({
      ...provided,
      maxHeight: '200px',
      zIndex: 9999,
    }),
    menuList: (provided) => ({
      ...provided,
      maxHeight: '200px',
      overflowY: 'auto',
    }),
  };

  return (
    <>
      <Select
        isMulti
        options={options}
        formatOptionLabel={formatOptionLabel}
        onChange={(selectedOptions) => {
          if (!setSelectedSites) return;
          const selected = selectedOptions ? selectedOptions.map(opt => opt.fullSite) : [];
          setSelectedSites(selected);
        }}
        value={selectedOptions}
        placeholder="Select multiple sites..."
        styles={customStyles}
      >
      </Select>
    </>
  )
}

function SiteSelectBox({selectedSite, setSelectedSite}) {
  // Fetch nodes data from API
  const { data: Nodes, error, isLoading } = useSWR('/api/nodes', fetcher);

  const internalSetSelectedSite = ({value, label, fullSite}) => {
    console.log("Setting selected site");
    console.log(fullSite);
    console.log(value);
    setSelectedSite(fullSite);
  }

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  // Show skeletons while nodes are loading
  if (isLoading) {
    return (
      <div className="w-full">
        <Skeleton height={44} />
        <div className="mt-2">
          <Skeleton height={12} width={200} />
        </div>
      </div>
    );
  }

  if (error || !Nodes) {
    return <div>Error loading sites</div>;
  }

  const options = Nodes.map((node) => {
    return (
      {value: node.slug, label: node.name, fullSite: node}
    )
  });

  const formatOptionLabel = ({value, label, fullSite}) => (

    <div className="flex flex-row gap-2 items-center text-black">
      <FontAwesomeIcon icon={faLocationDot} size="2x" className="text-red-500 text-xl"/>
      <div>
        <h2 className="text-xl font-bold">{fullSite.name}</h2>
        {fullSite.name == fullSite.siteName ? null :
          <h6
            className="whitespace-nowrap truncate text-tremor-default text-tremor-content group-hover:text-tremor-content-emphasis  opacity-100 ">{fullSite.siteName}</h6>}
      </div>
    </div>
  );

  return (
    <>
      <Select
        options={options}
        formatOptionLabel={formatOptionLabel}
        onChange={internalSetSelectedSite}
        value={selectedSite ? options.find((option) => option.value === selectedSite.slug) : null}
      >

      </Select>
    </>
  )
}


function DefaultInfoPanel({setSelectedSite, selectedSite, selectedSites=[], setSelectedSites, selectionLegendName='Selected Sites', setSelectionLegendName, regexPattern='', handleRegexChange, regexError}) {
  return (
    <div className="flex flex-col p-2 space-y-4">
      {/* About NRP Section */}
      <div>
        <SectionHeader title="About NRP" className="mb-3" />
        <a href="https://nationalresearchplatform.org" target="_blank" rel="noopener noreferrer" className="block">
          <img src="/images/NRP_LOGO-cropped.png" alt="NRP Logo" className='object-scale-down h-12 block dark:hidden'/>
          <img src="/images/NRP_LOGO-cropped-dark.png" alt="NRP Logo" className='object-scale-down h-12 hidden dark:block'/>
        </a>
        <p className='mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed'>
          The National Research Platform is a partnership of more than 50 institutions,
          led by researchers at UC San Diego, University of Nebraska-Lincoln, and Massachusetts
          Green High Performance Computing Center and includes contributions by the National
          Science Foundation, the Department of Energy, the Department of Defense, and many
          research universities and R&amp;E networking organizations in the US and around the world.
        </p>
      </div>

      {/* Select Site Section */}
      <div>
        <SectionHeader title="Select Site" className="mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">Choose a site or click on the map</p>
        <SiteSelectBox id="siteSelect" selectedSite={selectedSite} setSelectedSite={setSelectedSite}/>
      </div>
      
      {/* Map Customization Section */}
      <div>
        <SectionHeader title="Map Customization" className="mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">Select multiple sites to highlight</p>
        <SiteMultiSelectBox 
          id="multiSiteSelect" 
          selectedSites={selectedSites} 
          setSelectedSites={setSelectedSites}
        />
      </div>
      
      <div>
        <label htmlFor="regexSelect"
               className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">Or filter by regex pattern</label>
        <input
          id="regexSelect"
          type="text"
          value={regexPattern}
          onChange={(e) => handleRegexChange && handleRegexChange(e.target.value)}
          placeholder="e.g., chicago|boulder|^ucsd.*"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   transition-colors"
        />
        {regexError && (
          <span className="text-xs text-red-500 dark:text-red-400 block mt-1">
            {regexError}
          </span>
        )}
        {regexPattern && !regexError && selectedSites.length > 0 && (
          <span className="text-xs text-green-600 dark:text-green-400 block mt-1">
            Selected {selectedSites.length} site{selectedSites.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {selectedSites.length > 0 && (
        <div>
          <label htmlFor="legendLabel"
                 className="text-sm text-gray-500 dark:text-gray-400 block mb-1.5">Label for red pins (Legend)</label>
          <input
            id="legendLabel"
            type="text"
            value={selectionLegendName}
            onChange={(e) => setSelectionLegendName && setSelectionLegendName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors"
          />
        </div>
      )}

      {selectedSites.length > 0 && (
        <button
          onClick={() => {
            if (setSelectedSites) setSelectedSites([]);
            if (handleRegexChange) handleRegexChange('');
          }}
          className="w-full px-3 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Clear Selection ({selectedSites.length})
        </button>
      )}
    </div>
  )
}

export default function MapInfoPanel({site, setSelectedSite, selectedSites=[], setSelectedSites, selectionLegendName='Selected Sites', setSelectionLegendName, regexPattern='', handleRegexChange, regexError, timeRange='24h'}) {
  if (!site) {
    return (
      <>
        <DefaultInfoPanel 
          selectedSite={site} 
          setSelectedSite={setSelectedSite}
          selectedSites={selectedSites}
          setSelectedSites={setSelectedSites}
          selectionLegendName={selectionLegendName}
          setSelectionLegendName={setSelectionLegendName}
          regexPattern={regexPattern}
          handleRegexChange={handleRegexChange}
          regexError={regexError}
        />
      </>
    );
  }

  // Calculate the number of gpus
  let totalGpus = site.nodes.reduce((acc, node) => {
    return acc + parseInt(node.gpus)
  }, 0);
  let totalCaches = site.nodes.reduce((acc, node) => {
    if (node.cache)
      return acc + 1;
    else
      return acc;
  }, 0);
  return (
    <div className="p-2 space-y-4">
      <div>
        <SiteSelectBox selectedSite={site} setSelectedSite={setSelectedSite}/>
      </div>
      <div className='flex flex-row flex-wrap gap-2'>
        <Badge icon={RiServerLine} color="green">{site.nodes.length} Nodes Online</Badge>
        {totalGpus > 0 && <Badge icon={RiCpuLine} color="blue">{totalGpus} GPUs</Badge>}
        {totalCaches > 0 && <Badge icon={RiDatabase2Line} color="violet">{totalCaches} OSDF Nodes</Badge>}
      </div>
      <div className="flex flex-col gap-4">
        <SiteStats site={site} timeRange={timeRange}/>
        {totalGpus > 0 ? <SiteGpuStats site={site} timeRange={timeRange}/> : null}
        {totalGpus > 0 ? <SiteGpuTypes site={site}/> : null}
        <SiteNetworkStats site={site} timeRange={timeRange}/>
      </div>
    </div>
  )
}

/*
<table className="w-full px-2 text-left text-gray-500 dark:text-gray-400 mt-2">
        <thead className="text-gray-700 bg-gray-50 dark:bg-gray-700 dark:text-gray-400 border-b">
          <tr>
            <th scope="col">Node</th>
          </tr>
        </thead>
        {site.nodes.map((hostname) => {
          return (
            <>
              <tr className="even:bg-white even:dark:bg-gray-900 odd:bg-gray-50 odd:dark:bg-gray-800 border-b dark:border-gray-700">
                <td>
                  {hostname.name}
                </td>
              </tr>
            </>
          );
        })
        }
      </table>
      */