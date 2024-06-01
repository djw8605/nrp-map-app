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
import {Badge, BarChart, Card, SparkAreaChart, DonutChart, Legend, BadgeDelta} from '@tremor/react';
import {RiCpuLine, RiServerLine, RiDatabase2Line} from '@remixicon/react';
import Nodes from "../data/nodes.json"
import Select from 'react-select'
import {useState, useEffect, useMemo} from 'react';

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

function SiteNetworkStats({site}) {

  const {data, error} = useSWR(`/api/sitenetwork?site=${site.slug}`, fetcher, {refreshInterval: 60000});
  var humanTransmit = "";
  var humanReceive = "";
  if (data) {
    console.log(data);
    // Get the last element from data.transmit
    let last_transmit = data.transmit[data.transmit.length - 1];
    humanTransmit = humanTransferSpeed(last_transmit.value, true);

    let last_receive = data.receive[data.transmit.length - 1];
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
        <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content mb-1">
          {title}
        </p>
        {!value ? (
          <LoadingElement/>
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

function SiteStats({site}) {

  const {data, error} = useSWR(`/api/sitemetrics?site=${site.slug}`, fetcher, {refreshInterval: 60000});
  if (data) {
    console.log("Site Stats");
    console.log(data);
  }

  let totalGpus = site.nodes.reduce((acc, node) => {
    return acc + parseInt(node.gpus)
  }, 0);

  return (
    <Card className='mx-auto w-full p-0'>
      <div className='grid lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-2 grid-cols-1 lg:divide-x sm:divide-x md:divide-y divide-y'>
        {totalGpus > 0 && (
          <MetricCard
            title="GPU Hours"
            value={data ? data.gpuHours.toLocaleString(undefined, {maximumFractionDigits: 0}) : null}
            belowText="From previous week"
            difference={data ? ((data.gpuHours - data.prevGpuHours) / data.prevGpuHours) : null}/>
        )}

        <MetricCard
          title="CPU Hours"
          value={data ? data.cpuHours.toLocaleString(undefined, {maximumFractionDigits: 0}) : null}
          belowText="From previous week"
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

function SiteGpuStats({site}) {
  // Fetch the GPU metrics
  const {data, error} = useSWR(`/api/sitegpus?site=${site.slug}`, fetcher, {refreshInterval: 60000});

  var cleaned_data = null;
  if (data) {
    console.log(data);
    // Convert Date to just the month/day
    cleaned_data = data.map((item) => {
      console.log(item.time);
      let current_date = new Date(item.time);
      return {"Date": current_date.getMonth() + "/" + current_date.getDate(), "GPU Hours": item.value}
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
  // valueFormatter={dataFormatter}

  const [selectedGpuType, setSelectedGpuType] = useState(null);

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
    // Convert to an array of objects
    return Array.from(tmpGpuTypes, ([name, value]) => ({name: name, value: value}));

  }, [site]);

  //console.log("GPU Types");
  //console.log(gpuTypes);
  // Calculate all of the unique names from gpuTypes
  const gpuNames = gpuTypes.map((gpu) => gpu.name);

  return (
    <Card className='mx-auto w-full p-2 max-h-80'>
      <h3 className="text-lg font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
        GPU Types
      </h3>
      <div className='grid lg:grid-cols-8 grid-cols-1 gap-2'>
        <DonutChart
          className='lg:col-span-3'
          data={gpuTypes}
          index="name"
          categories={["value"]}
          onValueChange={(v) => {
            //console.log(v);
            if (!v) {
              setSelectedGpuType(null);
            } else {
              selectedGpuType === v.name ? setSelectedGpuType(null) : setSelectedGpuType(v.name);
            }
          }}
          active={selectedGpuType}
        />
        <Legend
          className='lg:col-span-5'
          categories={gpuNames}
          activeLegend={selectedGpuType}
          onClickLegendItem={(e) => {
            selectedGpuType === e ? setSelectedGpuType(null) : setSelectedGpuType(e);
          }}/>
      </div>
    </Card>
  )
}

function SiteSelectBox({selectedSite, setSelectedSite}) {
  const internalSetSelectedSite = ({value, label, fullSite}) => {
    // Find the site from the slug
    //let newSelectedSite = Nodes.find((node) => node.slug == site);
    //console.log(newSelectedSite);
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

  const options = Nodes.map((node) => {
    return (
      {value: node.slug, label: node.name, fullSite: node}
    )
  });

  const formatOptionLabel = ({value, label, fullSite}) => (

    <div className="flex flex-row gap-2 items-center">
      <FontAwesomeIcon icon={faLocationDot} size="2x" className="text-red-500 text-xl"/>
      <div>
        <h2 className="text-xl font-bold">{fullSite.name}</h2>
        {fullSite.name == fullSite.siteName ? null :
          <h6
            className="whitespace-nowrap truncate text-tremor-default text-tremor-content group-hover:text-tremor-content-emphasis dark:text-dark-tremor-content opacity-100 dark:group-hover:text-dark-tremor-content-emphasis">{fullSite.siteName}</h6>}
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


function DefaultInfoPanel({setSelectedSite, selectedSite}) {
  // max-h-[30em] lg:w-80 overflow-scroll lg:top-1 lg:right-1 lg:absolute

  // Count the number of sits in the nodes
  let totalNodes = Nodes.reduce((acc, site) => {
    return acc + parseInt(site.nodes.length);
  }, 0);
  let totalSites = Nodes.length;
  return (
    <div className="bg-white flex flex-col p-2">
      <div className=''>
        <img src="/images/NRP_LOGO-cropped.png" alt="NRP Logo" className='object-scale-down'/>
      </div>
      <div className='mt-1'>
        <p>
          The National Research Platform is a partnership of more than 50 institutions, led by researchers at
          UC San Diego, University of Nebraska-Lincoln, and UC Berkeley and includes the National Science
          Foundation, Department of Energy,
          and multiple research universities in the US and around the world.
        </p>
      </div>
      <div className='my-2'>
        <label htmlFor="siteSelect"
               className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">Select a site
          or click on a site in the map</label>
        <SiteSelectBox id="siteSelect" selectedSite={selectedSite} setSelectedSite={setSelectedSite}/>
      </div>
      <Card className='mx-auto w-full p-0 my-2'>
        <div className='grid lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-2 grid-cols-1 lg:divide-x sm:divide-x md:divide-y divide-y'>

          <MetricCard
            title="Sites"
            value={totalSites.toLocaleString(undefined)}
            belowText="Sites hosting NRP nodes"
            />

          <MetricCard
            title="Nodes"
            value={totalNodes.toLocaleString(undefined)}
            belowText="Nodes registered in Kubernetes"
          />
        </div>
      </Card>
    </div>
  )
}

export default function MapInfoPanel({site, setSelectedSite}) {
  if (!site) {
    return (
      <>
        <DefaultInfoPanel selectedSite={site} setSelectedSite={setSelectedSite}/>
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
  // <StatusBadge icon={RiServerLine} text={`${site.nodes.length} Nodes Online`} color="text-green-500" />
  // <StatusBadge icon={faMicrochip} text={`${totalGpus} GPUs`} color="text-sky-500" />
  // max-h-[30em]
  // lg:w-96 overflow-scroll lg:top-1 lg:right-1 lg:absolute relative
  console.log(site);
  return (
    <div className="bg-white p-2 md:p-0">
      <div className='mb-2'>
        <SiteSelectBox selectedSite={site} setSelectedSite={setSelectedSite}/>
      </div>
      <div className='flex flex-row flex-wrap gap-2 mb-2'>
        <Badge icon={RiServerLine} color="green">{site.nodes.length} Nodes Online</Badge>
        {totalGpus > 0 && <Badge icon={RiCpuLine} color="blue">{totalGpus} GPUs</Badge>}
        {totalCaches > 0 && <Badge icon={RiDatabase2Line} color="violet">{totalCaches} OSDF Nodes</Badge>}
      </div>
      <div className="flex flex-col gap-2">
        <SiteStats site={site}/>
        {totalGpus > 0 ? <SiteGpuStats site={site}/> : null}
        {totalGpus > 0 ? <SiteGpuTypes site={site}/> : null}
        <SiteNetworkStats site={site}/>
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