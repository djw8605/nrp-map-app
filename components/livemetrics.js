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
  const [coreHours, setCoreHours] = useState(0);
  const [ coreHoursRate, setCoreHoursRate ] = useState(0.08);
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
    data.projects.map((project) => {
      totalCoreHours += project.usage;
      organizations.add(project.organization);
    });

    if (totalCoreHours.toFixed() != coreHoursFromWeb.toFixed()) {
      setCoreHours(totalCoreHours);
      coreHoursFromWeb = coreHours;
    }
    totalOrganizations = organizations.size
    totalProjects = data.projects.length;
    loading = false;
  }

  if (rateData) {
    var newCoreHoursRate = rateData.corehoursrate;
    // Check if the rate changed
    if (newCoreHoursRate.toFixed(4) != coreHoursRate.toFixed(4)) {
      setCoreHoursRate(newCoreHoursRate);
      if (rateInterval > 0) {
        clearInterval(rateInterval);
      }
      rateInterval = setInterval(() => {
        setCoreHours((coreHours) => {
          if (coreHours > 0) coreHours += 1
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
        <LiveMetricRate title='Core Hours Contributed' rate={coreHoursRate * 3600 * 24} loading={loading} value={coreHours} colorScheme="l-bg-orange-dark" icon={faMicrochip} />
      </div>
      <div className='col-md-4'>
        <LiveMetricRate title='OSG Projects' value={totalProjects} loading={loading} colorScheme="l-bg-cherry" icon={faUserGroup} />
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

