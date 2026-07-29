import React from "react";
import Image from 'next/image'

class SiteList extends React.Component {
  constructor(props) {
    super(props);
    // Read in the JSON file
    Sites.sites.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))

  }
  render() {

    return (
      <>
        <table className="table table-striped table-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          <thead>
            <tr>
              <th colSpan="2" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100">Collaborating Campuses</th>
            </tr>
          </thead>
          <tbody>
            {Sites.sites.map((site) => {
              return (
                <tr key={site.name} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="logo-image">
                    {site.logo && <Image src={site.logo} layout={'fill'} objectFit={'contain'}/>
                    }
                  </td>
                  <td>{site.name}</td>
                </tr>
              )
            })
            }
          </tbody>
        </table>
        <style jsx>{`
        .logo-image {
          position: relative;
          width: 32px;
          height: 32px;
        }
      `}</style>
      </>
    )
  }

}

export default SiteList;
