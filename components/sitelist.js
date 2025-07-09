import React from "react";
import Sites from "../data/sites.json"
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
        <table className="table table-striped table-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <thead>
            <tr>
              <th colSpan="2" className="bg-blue-900 text-white dark:bg-gray-800 dark:text-gray-100">Collaborating Campuses</th>
            </tr>
          </thead>
          <tbody>
            {Sites.sites.map((site) => {
              return (
                <tr key={site.name} className="border-b border-gray-200 dark:border-gray-700">
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
