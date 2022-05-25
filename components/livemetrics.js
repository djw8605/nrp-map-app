import React, { useState, useEffect } from 'react';
import useSWR from 'swr'
import { GetCoreHoursRate, GetProjects } from './gatherdata';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrochip, faBuildingColumns, faUserGroup, faArrowUp } from '@fortawesome/free-solid-svg-icons'

var rateInterval = 0;

function numberWithCommas(x) {
  if (x === undefined) {
    return 0;
  } else if (typeof x === 'number') {
    return x.toFixed(0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } else {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

}

function convertWithK(x) {
  return (x.toFixed()/1000).toFixed().toString() + 'k';
}

var coreHoursFromWeb = 0;
export default function LiveMetrics() {
  const [coreHours, setCoreHours] = useState({'corehours': 0, 'gpuhours': 0});
  const [ coreHoursRate, setCoreHoursRate ] = useState({'corehours': 0, 'gpuhours': 0});
  var totalProjects = 0;
  var totalOrganizations = 0;
  var loading = true;
  const { data, error } = GetProjects();
  const { data: rateData, error: rateError } = GetCoreHoursRate();
  if (data) {
    var organizations = new Set();
    // Loop through the projects and get the total number of hours
    // and the total number of organizations
    var totalCoreHours = 0;
    var totalGPUHours = 0;
    data.projects.map((project) => {
      totalCoreHours += project.usage;
      totalGPUHours += project.gpuhours;
      organizations.add(project.organization);
    });

    if (totalCoreHours.toFixed() != coreHoursFromWeb.toFixed()) {
      setCoreHours({'corehours': totalCoreHours, 'gpuhours': totalGPUHours});
      coreHoursFromWeb = coreHours.corehours;
    }
    totalOrganizations = organizations.size
    totalProjects = data.projects.length;
    loading = false;
  }

  if (rateData) {
    var newCoreHoursRate = rateData.corehoursrate;
    var newGpuHoursRate = rateData.gpuhoursrate;
    // Check if the rate changed
    if (newCoreHoursRate.toFixed(4) != coreHoursRate.corehours.toFixed(4)) {
      setCoreHoursRate({'corehours': newCoreHoursRate, 'gpuhours': newGpuHoursRate});
      if (rateInterval > 0) {
        clearInterval(rateInterval);
      }
      rateInterval = setInterval(() => {
        setCoreHours((coreHours) => {
          
          if (coreHours.corehours > 0) coreHours.corehours += 1;
          if (coreHours.gpuhours > 0) coreHours.gpuhours += 1;
          return coreHours;
        });
      }, (1/newCoreHoursRate) * 1000);

    }
  }

  useEffect(() => {
    // Clean up the rate interval
    return () => {
      if (rateInterval > 0) {
        clearInterval(rateInterval);
      }
    }
  }, []);



  return (
    <>
      <div className='col-md-4'>
        <LiveMetricRate title='Core Hours Contributed' rate={coreHoursRate.corehours * 3600 * 24} loading={loading} value={coreHours.corehours} colorScheme="l-bg-orange-dark" icon={faMicrochip} />
      </div>
      <div className='col-md-4'>
        <LiveMetricRate title='GPU Hours Contributed' rate={coreHoursRate.gpuhours * 3600 * 24} value={coreHours.gpuhours} loading={loading} colorScheme="l-bg-cherry" icon={faUserGroup} />
      </div>
      <div className='col-md-4'>
        <LiveMetricRate title='Institutions Supported' value={totalOrganizations} loading={loading} colorScheme="l-bg-cyan" icon={faBuildingColumns} />
      </div>
    </>
  )
}


function LiveMetricRate(props) {
  return (
    <>
      <div className={`card ${props.colorScheme}`}>
        <div className="card-statistic-3 p-4">
          <div className="card-icon card-icon-large"><FontAwesomeIcon icon={props.icon} /></div>
          <div className="mb-4">
            <h5 className="card-title mb-0">{props.title}</h5>
          </div>
          <div className="row align-items-center mb-2 d-flex">
            <div className="col-8">
              <h2 className="d-flex align-items-center mb-0">
                {props.loading ? (
                  <>
                    <div className="spinner-border spinner-border-sm" role="status">
                    </div> &nbsp; Loading...
                  </>
                ) : (
                  <>
                    {numberWithCommas(props.value)}
                  </>
                )
                }
              </h2>
            </div>
            {props.rate ? (
              <>
                <div className="col-4 text-right">
                  <span><FontAwesomeIcon icon={faArrowUp} />~{convertWithK(props.rate)}/day</span>
                </div>
              </>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

