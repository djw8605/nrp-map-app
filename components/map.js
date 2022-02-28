import React, { useEffect, useRef, ReactElement } from "react";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import Sites from "../data/sites.json"
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import "leaflet-defaulticon-compatibility";


export default function Map() {
  
  const uluru = { lat: 39.63517934689119, lng: -97.0739061397193 };

  return (
    <>
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


