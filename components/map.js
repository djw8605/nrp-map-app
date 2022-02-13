import React, { useEffect, useRef, ReactElement } from "react";
import Sites from "../data/sites.json"


class Map extends React.Component {
  markers = new Array();
  
  componentDidMount() {
    const uluru = { lat: 39.63517934689119, lng: -97.0739061397193 };
    
    // The map, centered at Uluru
    this.map = new google.maps.Map(document.getElementById("map"), {
      zoom: 5,
      center: uluru,
      disableDefaultUI: true,
    });

    Sites.sites.map((site) => {
      console.log(site);
      var marker = new google.maps.Marker({
        position: { lat: site.lat, lng: site.log },
        map: this.map,
      });
      const infowindow = new google.maps.InfoWindow({
        content: site.name,
      });
      var map = this.map;
      marker.addListener("click", () => {
        infowindow.open({
          anchor: marker,
          map,
          shouldFocus: false,
        });
      });
      this.markers.push(marker);
    });
  }

  
  render() {
    return (
      <div id="map"></div>
    )
  }


}

export default Map;


