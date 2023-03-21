import React from "react";
import { GetNamespaces, GetNamespaceUsage } from "./gatherdata";
import DataTable from 'react-data-table-component';

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ExpandedRow({ data }) {
  return (
    <div className='fs-9'>
      <div>
        <span className='fw-bold'>Namespace:</span> {data.Name}
      </div>
      <div>
        <span className='fw-bold'>Institution:</span> {data.Institution}
      </div>
      <div>
        <span className='fw-bold'>Description:</span> {data.Description}
      </div>
      <div>
        <span className='fw-bold'>Software:</span> {data.Software}
      </div>
    </div>
  );
}

function DataTableLoading() {
  return (
    <>
      <div className='flex justify-center items-center flex-col'>
        <div role="status" className='mt-3 flex flex-row items-center'>
          <div>
            <p className='text-sm font-medium text-gray-900 dark:text-white'>Loading Usage Information...</p>
          </div>
          <div className='ml-2'>
            <div className="spinner-border spinner-border-sm" role="status">
            </div>
          </div>
          <span className="sr-only">Loading...</span>
        </div>
        <div className='mt-3'>
          <p className='text-sm font-medium text-gray-900 dark:text-white'>This could take a bit...</p>
        </div>
      </div>
    </>
  )
}

function Projects() {
  //const { data, error } = GetProjects();
  const namespace_info = GetNamespaces();
  const namespace_usage = GetNamespaceUsage();
  var loading_text = "Loading "
  if (!namespace_info.data) {
    loading_text += "Namespace Info"
  }
  if (!namespace_info.data && !namespace_usage.data) {
    loading_text += " and Usage"
  }
  if (namespace_info.data && !namespace_usage.data) {
    loading_text += "Namespace Usage"
  }

  if (namespace_info.error) {
    console.log("Got namespace error");
    console.log(namespace_error);
  }

  if (namespace_info.error) {
    console.log("Got namespace data");
    console.log(namespace_data);
  }

  if (namespace_info.data) {
    console.log("Got namespace usage data");
    console.log(namespace_info.data);
  }

  const columns = [
    {
      name: "Namespace",
      selector: row => row.name,
      sortable: true,
    },
    {
      name: "CPUs",
      selector: row => row.cpus,
      format: row => row.cpus.toFixed(0),
      sortable: true,
    },
    {
      name: "GPUs",
      selector: row => row.gpus,
      format: row => row.gpus.toFixed(0),
      sortable: true,
    }
  ];

  var data = [];
  // Just the usage info for now
  if (namespace_usage.data && namespace_info.data) {
    // Convert the namespace usage data from a list to a map
    var namespace_info_map = {};
    namespace_info.data.values.Namespaces.forEach(function (item) {
      namespace_info_map[item.Name] = item;
    });

    Object.keys(namespace_usage.data.values).forEach(function (key) {
      // Check if the namespace is in the namespace info
      if (!namespace_info_map[key]) {
        return;
      }
      data.push({
        name: key,
        cpus: namespace_usage.data.values[key].cpu,
        gpus: namespace_usage.data.values[key].gpu,
        ...namespace_info_map[key]
      });
    });
  }

  /*
  if (!namespace_info.data || !namespace_usage.data) {
    return (
      <>
        <div className="spinner-border spinner-border-sm" role="status">
        </div>
        <div>&nbsp; {loading_text} </div>
      </>
    )
  }
  */

  // Combine the namespace data with the usage data


  //data.projects.sort((a, b) => (b.usage - a.usage))
  // <td align="right">{numberWithCommas(project.usage.toFixed())}</td>
  // <td align="right">{numberWithCommas(project.gpuhours.toFixed())}</td>
  //               <div className="fieldofscience">{namespace.Description}</div>
  return (
    <>
      <DataTable
        title="Namespace Usage"
        columns={columns}
        data={data}
        pagination
        highlightOnHover
        striped
        responsive
        expandableRows
        expandableRowsComponent={ExpandedRow}
        progressPending={namespace_info.data == undefined || namespace_usage.data == undefined}
        progressComponent={DataTableLoading()}
        dense
        defaultSortFieldId={3}
        defaultSortAsc={false}
      />
    </>
  )
}


class ProjectUsage extends React.Component {
  constructor(props) {
    super(props);
    // Read in the JSON file
    this.state = {
      projects: [],
    }
  }


  render() {
    return (
      <>
        <div className="table-scroll">

          <Projects />
        </div>
        <style jsx>{`
        .table-scroll {
          max-height: 600px;
          overflow-y: scroll;
        }
        `}</style>
      </>
    )
  }
}



export default ProjectUsage;