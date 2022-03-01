import React, { useEffect, useRef, ReactElement } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import Sites from "../data/sites.json"
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import "leaflet-defaulticon-compatibility";
import { useSelector, useDispatch } from 'react-redux'
import { update } from '../redux/siteDisplay'

var siteIndex = 0;

function MapMover() {
  const map = useMap();
  const dispatch = useDispatch()
  useEffect(() => {
    const interval = setInterval(() => {
      map.setView([Sites.sites[siteIndex].lat, Sites.sites[siteIndex].log], 14, { animate: true });
      dispatch(update(Sites.sites[siteIndex].name));
      siteIndex = (siteIndex + 1) % Sites.sites.length;
      console.log('This will run every second!');
      
    }, 15000);
    return () => clearInterval(interval);
  }, []);
  return null;
}


function SiteName() {
  const site = useSelector((state) => state.siteDisplay.value);
  return (
    <h4>{site}</h4>
  )

}

export default function Map() {

  const uluru = { lat: 39.63517934689119, lng: -97.0739061397193 };
  // <MapMover />
  return (
    <>
      <SiteName />
      <MapContainer className="map" center={[uluru.lat, uluru.lng]} zoom={5}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {Sites.sites.map((site) => {
          return (
            <Marker key={site.name} position={[site.lat, site.log]}>
              <Popup>
                {site.name}
              </Popup>
            </Marker>
          )
        })
        }
      </MapContainer>
    </>
  )
}


