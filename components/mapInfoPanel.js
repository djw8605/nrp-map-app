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
import {Badge, BarChart, Card, SparkAreaChart, BadgeDelta} from '@tremor/react';
import {RiCpuLine, RiServerLine, RiDatabase2Line} from '@remixicon/react';
import Select from 'react-select'
import {useState, useEffect, useMemo} from 'react';
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

const fetcher = (url) => fetch(url).then((res) => res.json());

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
    <Card className="w-full flex flex-col justify-between p-0">
      <div className="flex flex-row justify-between px-2 pt-2">
        <div className="flex flex-col items-start">
          <p
            className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content mb-1">{title}</p>
          <p
            className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {data ? currentValue : "Loading..."}
          </p>
        </div>
        <div>
          <FontAwesomeIcon icon={icon} size="2x" className={`${iconColor} text-xl`}/>
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
          className="w-full"
        />
      )}
    </Card>
  )

}

function SiteNetworkStats({site, timeRange = '24h'}) {

  const {data, error} = useSWR(`/api/sitenetwork?site=${site.slug}&range=${timeRange}`, fetcher, {refreshInterval: 60000});
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
    <>
      <div className='mx-auto w-full p-2'>
        <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content ">
          {title}
        </p>
        {value == null ? (
          <div className='p-2'>
            <Skeleton height={28} width={160} />
            <div className='mt-2'>
              <Skeleton height={12} width={110} />
            </div>
          </div>
        ) : (
          <>
            <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {value}
            </p>

            <div className="text-tremor-label text-tremor-content dark:text-dark-tremor-content flex flex-row items-center">
              {difference && (
                <BadgeDelta className='mr-1' size="xs" deltaType={deltaType} isIncreasePositive={true}>
                  {(difference * 100).toLocaleString(undefined, {maximumFractionDigits: 0})}%
                </BadgeDelta>
              )}
              {belowText}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function SiteStats({site, timeRange = '7d'}) {

  const {data, error} = useSWR(`/api/sitemetrics?site=${site.slug}&range=${timeRange}`, fetcher, {refreshInterval: 60000});
  if (data) {
    console.log("Site Stats");
    console.log(data);
  }

  let totalGpus = site.nodes.reduce((acc, node) => {
    return acc + parseInt(node.gpus)
  }, 0);

  const periodLabel = timeRange === '24h' ? 'previous day' : timeRange === '7d' ? 'previous week' : 'previous month';

  return (
    <Card className='mx-auto w-full p-0'>
      <div className='grid lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-2 grid-cols-1'>
        <div className="border-b border-gray-200 dark:border-gray-700 lg:border-b lg:border-r md:border-b-0 md:border-r lg:rounded-tl-lg">
          {totalGpus > 0 && (
            <MetricCard
              title="GPU Hours"
              value={data ? data.gpuHours.toLocaleString(undefined, {maximumFractionDigits: 0}) : null}
              belowText={`From ${periodLabel}`}
              difference={data ? ((data.gpuHours - data.prevGpuHours) / data.prevGpuHours) : null}/>
          )}
        </div>
        <div className="border-b border-gray-200 dark:border-gray-700 lg:border-b lg:border-l md:border-b-0 md:border-l lg:rounded-tr-lg">
          <MetricCard
            title="CPU Hours"
            value={data ? data.cpuHours.toLocaleString(undefined, {maximumFractionDigits: 0}) : null}
            belowText={`From ${periodLabel}`}
            difference={data ? ((data.cpuHours - data.prevCpuHours) / data.prevCpuHours) : null}
          />
        </div>
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

  return (
    <>
      <Card
        className='mx-auto w-full p-2 max-h-80'>
        <h3 className="text-lg font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
          GPU Hours by Day
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
    </>
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
    // Convert to an array of objects for horizontal BarChart
    return Array.from(tmpGpuTypes, ([name, value]) => ({name: name, "Count": value}));

  }, [site]);

  const dataFormatter = (number) =>
    Intl.NumberFormat('us').format(number).toString();

  return (
    <Card className='mx-auto w-full p-2'>
      <h3 className="text-lg font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
        GPU Types
      </h3>
      <BarChart
        className='mt-2'
        data={gpuTypes}
        index="name"
        categories={["Count"]}
        colors={['blue']}
        layout="horizontal"
        valueFormatter={dataFormatter}
        yAxisWidth={120}
        showLegend={false}
      />
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
    <div className="flex flex-col p-2">
      <div className=''>
        <a href="https://nationalresearchplatform.org" target="_blank" rel="noopener noreferrer">
          <img src="/images/NRP_LOGO-cropped.png" alt="NRP Logo" className='object-scale-down block dark:hidden'/>
          <img src="/images/NRP_LOGO-cropped-dark.png" alt="NRP Logo" className='object-scale-down hidden dark:block'/>

        </a>
      </div>
      <div className='mt-1'>
        <p>
          The National Research Platform is a partnership of more than 50 institutions,
          led by researchers at UC San Diego, University of Nebraska-Lincoln, and Massachusetts
          Green High Performance Computing Center and includes contributions by the National
          Science Foundation, the Department of Energy, the Department of Defense, and many
          research universities and R&E networking organizations in the US and around the world.
        </p>
      </div>
      <div className='my-2'>
        <label htmlFor="siteSelect"
               className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">Select a site
          or click on a site in the map</label>
        <SiteSelectBox id="siteSelect" selectedSite={selectedSite} setSelectedSite={setSelectedSite}/>
      </div>
      
      <div className='my-2'>
        <label htmlFor="multiSiteSelect"
               className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">Map Customization - Select Multiple Sites</label>
        <SiteMultiSelectBox 
          id="multiSiteSelect" 
          selectedSites={selectedSites} 
          setSelectedSites={setSelectedSites}
        />
      </div>
      
      <div className='my-2'>
        <label htmlFor="regexSelect"
               className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">Or select by Regex pattern</label>
        <input
          id="regexSelect"
          type="text"
          value={regexPattern}
          onChange={(e) => handleRegexChange && handleRegexChange(e.target.value)}
          placeholder="e.g., chicago|boulder|^ucsd.*"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className='my-2'>
          <label htmlFor="legendLabel"
                 className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">Label for red pins (Legend)</label>
          <input
            id="legendLabel"
            type="text"
            value={selectionLegendName}
            onChange={(e) => setSelectionLegendName && setSelectionLegendName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {selectedSites.length > 0 && (
        <button
          onClick={() => {
            if (setSelectedSites) setSelectedSites([]);
            if (handleRegexChange) handleRegexChange('');
          }}
          className="w-full px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors mt-2"
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
  console.log(site);
  return (
    <div className="p-2 md:p-0">
      <div className='mb-2'>
        <SiteSelectBox selectedSite={site} setSelectedSite={setSelectedSite}/>
      </div>
      <div className='flex flex-row flex-wrap gap-2 mb-2'>
        <Badge icon={RiServerLine} color="green">{site.nodes.length} Nodes Online</Badge>
        {totalGpus > 0 && <Badge icon={RiCpuLine} color="blue">{totalGpus} GPUs</Badge>}
        {totalCaches > 0 && <Badge icon={RiDatabase2Line} color="violet">{totalCaches} OSDF Nodes</Badge>}
      </div>
      <div className="flex flex-col gap-2">
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