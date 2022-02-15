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

export default function LiveMetrics() {
  const [coreHours, setCoreHours] = useState(0);
  var coreHoursRate = 28000;
  var totalProjects = 0;
  var totalOrganizations = 0;
  var loading = true;
  const { data, error } = GetProjects();
  if (data) {
    // Loop through the projects and get the total number of hours
    // and the total number of organizations
    var totalCoreHours = 0;
    data.projects.map((project) => {
      totalCoreHours += project.usage;
      totalOrganizations += 1;
    });

    if (coreHours === 0) {
      setCoreHours(totalCoreHours);
    }
    totalProjects = data.projects.length;
    loading = false;
  }

  useEffect(() => {
    // Update the number of core hours as if GP-ARGO is
    // running 200k core hours a day.
    // Per-second calculation:
    // 200k core hours / (60 seconds * 60 minutes * 24 hours)
    const interval = setInterval(() => {
      setCoreHours((coreHours) => {
        if (coreHours > 0) coreHours += 1
        return coreHours;
      });
    }, (1 / (coreHoursRate / (60 * 60 * 24))) * 1000);
    return () => {
      clearInterval(interval);
    }
  }, []);



  return (
    <>
      <div className='col-md-4'>
        <LiveMetricRate title='Core Hours Contributed' rate={coreHoursRate} loading={loading} value={coreHours} colorScheme="l-bg-orange-dark" icon={faMicrochip} />
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
                <div class="col-4 text-right">
                  <span><FontAwesomeIcon icon={faArrowUp} />~{numberWithCommas(props.rate)}/day</span>
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

