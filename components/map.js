import React, { useEffect, useRef, ReactElement } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import Nodes from "../data/nodes.json"
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

  var markers = Array();
  for (const [key, value] of Object.entries(Nodes)) {
    markers.push(value);
  }

  // <MapMover />
  return (
    <>
      <SiteName />
      <MapContainer className="map" center={[uluru.lat, uluru.lng]} zoom={4}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((node) => {
          console.log(node);
          return (
            <Marker key={node.geo.region + "." + node.geo.city} position={[node.geo.ll[0], node.geo.ll[1]]}>
              <Popup>
                <strong>{node.geo.city}, {node.geo.region}</strong>
                <br />
                {node.hostnames.map((hostname) => {
                  return (
                    <>
                      {hostname}
                      <br />
                    </>
                  );
                })
                }
              </Popup>
            </Marker>
          );
        })
        }
      </MapContainer>
    </>
  )
}


