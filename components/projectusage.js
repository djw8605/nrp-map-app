import React from "react";
import useSWR from 'swr'

const fetcher = (url) => fetch(url).then((res) => res.json());

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function Projects() {
  const { data, error } = useSWR('/api/projects', fetcher, { refreshInterval: 3600000 });
  if (!data) {
    return (
      <tr key='loading'>
        <td colSpan='2'>Loading...</td>
      </tr>
    )
  }
  data.projects.sort((a,b) => (b.usage - a.usage))
  return (
    <>
      {data.projects.map((project) => {
        return (
          <tr key={project.name}>
            <td>
              <div className="fieldofscience">{project.fieldofscience}</div>
              <div className="organiztion">{project.organization}</div>
              <div className="projectname">{project.name}</div>
              
            </td>
            <td align="right">{numberWithCommas(project.usage.toFixed())}</td>
          </tr>
        )
      })
      }
      <style jsx>{`
      .fieldofscience {
        font-weight: bold;
      }
      .organiztion {
        font-size: 0.8em;
      }
      .projectname {
        font-size: 0.8em;
      }
      `}</style>
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
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>Project</th>
              <th align="right">Core Hours</th>
            </tr>
          </thead>
          <tbody>
            <Projects />
          </tbody>
        </table>
      </>
    )
  }
}



export default ProjectUsage;