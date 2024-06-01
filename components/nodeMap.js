'use client'
import React, { useEffect, useRef, ReactElement, useState, useMemo } from "react";
import Map, {
  Marker,
  Popup,
  FullscreenControl,
  NavigationControl,
} from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
//import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import Nodes from "../data/nodes.json"
//import 'leaflet/dist/leaflet.css';
//import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
//import "leaflet-defaulticon-compatibility";
//import { update } from '../redux/siteDisplay'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot, faExpand } from "@fortawesome/free-solid-svg-icons";
import MapInfoPanel from "./mapInfoPanel";

var siteIndex = 0;
/*
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
*/

function SiteName() {
  const site = useSelector((state) => state.siteDisplay.value);
  return (
    <h4>{site}</h4>
  )

}

function SummaryStat({ title, value }) {
  return (
    <div className='bg-slate-100 p-1 flex items-center justify-center gap-2'>
      <div className='flex flex-col gap-1 text-center'>
        <div className='text-xl font-bold'>{value}</div>
        <div className='text-sm'>{title}</div>
      </div>
    </div>
  )
}



export default function NodeMap( {setSelectedSite, selectedSite}) {

  const uluru = { lat: 39.63517934689119, lng: -97.0739061397193 };

  const mapRef = useRef(null);
  var markers = Array();
  for (const [key, value] of Object.entries(Nodes)) {
    markers.push(value);
  }

  const initialViewState = {
    longitude: -97.0739061397193,
    latitude: 39.63517934689119,
    zoom: 3
  }

  console.log(markers);
  // <img src={site.logo} alt={site.name} className='object-scale-down h-10 w-10' />
  //const [popupInfo, setPopupInfo] = useState(null);
  const pins = useMemo(() => {
    return markers.map((node) => {
      return (
        <Marker key={node.id}
          longitude={node.longitude}
          latitude={node.latitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            console.log(node);
            setSelectedSite(node);
          }}
          onMouseEnter={(e) => {
            console.log('enter: ' + node);
          }}
        >
          <FontAwesomeIcon icon={faLocationDot} size="2x" className={node == selectedSite ? "text-red-500 z-10" : "text-sky-500 z-0"} />
        </Marker>
      )
    });
  }, [selectedSite]);

  // <MapMover />
  return (
    <>
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/djw8605/cluhrtvp201az01pd8tomenyv"
        initialViewState={initialViewState}
        onClick={(e) => {
          setSelectedSite(null);
        }}

      >
        <FullscreenControl position="top-left" />
        <NavigationControl position="top-left" />
        {pins}


      </Map>
    </>
  )
}


