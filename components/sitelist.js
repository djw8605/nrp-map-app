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
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th colSpan="2">Collaborating Campuses</th>
            </tr>
          </thead>
          <tbody>
            {Sites.sites.map((site) => {
              return (
                <tr key={site.name}>
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
