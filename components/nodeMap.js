'use client'
import React, { useEffect, useRef, ReactElement, useState, useMemo } from "react";
import Map, {
  Marker,
  Popup,
  FullscreenControl,
  NavigationControl,
} from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import useSWR from 'swr';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {faLocationDot, faExpand, faDatabase} from "@fortawesome/free-solid-svg-icons";
import MapInfoPanel from "./mapInfoPanel";

const fetcher = (url) => fetch(url).then((res) => res.json());


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



export default function NodeMap( {setSelectedSite, selectedSite, usePopup=false}) {
  // Fetch nodes data from API
  const { data: Nodes, error, isLoading } = useSWR('/api/nodes', fetcher);

  const uluru = { lat: 39.63517934689119, lng: -97.0739061397193 };

  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(3);

  // Build pins at top-level so hooks order is stable across renders
  const pins = useMemo(() => {
    if (!Nodes) return [];
    const markers = [];
    for (const [key, value] of Object.entries(Nodes)) {
      markers.push(value);
    }

    const computedSize = Math.max(Math.min(9 * (zoom || 1), 30), 7);

    return markers.map((node) => {
      // Check if all the nodes in the site are cache nodes
      let allCache = true;
      for (let i = 0; i < node.nodes.length; i++) {
        if (!node.nodes[i].cache) {
          allCache = false;
          break;
        }
      }

      const iconStyle = { width: `${computedSize}px`, height: `${computedSize}px` };

      return (
        <Marker key={node.id}
          longitude={node.longitude}
          latitude={node.latitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setSelectedSite(node);
          }}
        >
          {allCache ?
            <FontAwesomeIcon icon={faDatabase} style={iconStyle} className={`map-pin cursor-pointer ${node === selectedSite ? "text-red-500 z-10" : "text-green-500 z-0"}`} />
            :
            <FontAwesomeIcon icon={faLocationDot} style={iconStyle} className={`map-pin cursor-pointer ${node === selectedSite ? "text-red-500 z-10" : "text-sky-500 z-0"}`} />
          }
        </Marker>
      );
    });
  }, [Nodes, selectedSite, zoom, setSelectedSite]);

  // Return loading state if data is not yet available
  if (isLoading) {
    return (
      <div className="loader-wrapper h-full">
        <div className="concentric-loader" aria-hidden="true">
          <div className="loading-ring loading-ring-1"></div>
          <div className="loading-ring loading-ring-2"></div>
          <div className="loading-ring loading-ring-3"></div>
          <div className="loader-text">Loading map...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center h-full">Error loading map data</div>;
  }

  if (!Nodes) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  const initialViewState = {
    longitude: -97.0739061397193,
    latitude: 39.63517934689119,
    zoom: 3
  }

  // Create the legend
  const Legend = () => {
    return (
      <div className="absolute bottom-4 right-1 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <ul className="list-none text-xs text-gray-900 dark:text-gray-100">
          <li className="flex flex-row items-center gap-2 mb-2">
            <FontAwesomeIcon icon={faLocationDot} size="2x" className="text-sky-500"/>
            NRP Site
          </li>
          <li className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faDatabase} size="2x" className="text-green-500"/>
            OSDF-exclusive Site
          </li>
        </ul>

      </div>
    );
  };

  //
  // <MapMover />
  return (
    <>
      <div className='w-full relative h-full'>
      <Map
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          mapStyle="mapbox://styles/djw8605/cluhrtvp201az01pd8tomenyv"
          initialViewState={initialViewState}
          onClick={(e) => {
            setSelectedSite(null);
          }}
          onMove={(e) => {
            setZoom(e.viewState?.zoom ?? zoom);
          }}

        >
          <FullscreenControl position="top-left" />
          <NavigationControl position="top-left" />
          {pins}

        { selectedSite && usePopup && (
          <Popup
            anchor="top"
            longitude={Number(selectedSite.longitude)}
            latitude={Number(selectedSite.latitude)}
            onClose={() => setSelectedSite(null)}
            >
            <h3 className="text-sm">{selectedSite.name}</h3>
          </Popup>
        )}


        </Map>
        <Legend />
      </div>
    </>
  )
}


