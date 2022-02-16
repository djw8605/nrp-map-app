import React from "react";
import { GetProjects } from "./gatherdata";

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function Projects() {
  const { data, error } = GetProjects();
  if (!data) {
    return (
      <tr key='loading'>
        <td colSpan='2'>
          <div className="spinner-border spinner-border-sm" role="status">
          </div>&nbsp;Loading...</td>
      </tr>
    )
  }
  data.projects.sort((a, b) => (b.usage - a.usage))
  return (
    <>
      {data.projects.map((project) => {
        if (project.usage < 10) {
          return
        }
        return (
          <tr key={project.name}>
            <td>
              <div className="fieldofscience">{project.fieldofscience}</div>
              <div className="organiztion">{project.organization}</div>
              <div className="projectname">ID: {project.name}</div>

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
        font-style: italic;
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
        <div className="table-scroll">
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>OSG Project</th>
              <th className="text-right">Core Hours</th>
            </tr>
          </thead>
          <tbody>
            <Projects />
          </tbody>
        </table>
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