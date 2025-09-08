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

  // Return loading state if data is not yet available
  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading map...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full">Error loading map data</div>;
  }

  if (!Nodes) {
    return <div className="flex items-center justify-center h-full">No data available</div>;
  }

  var markers = Array();
  for (const [key, value] of Object.entries(Nodes)) {
    markers.push(value);
  }

  const initialViewState = {
    longitude: -97.0739061397193,
    latitude: 39.63517934689119,
    zoom: 3
  }

  //console.log(markers);
  // <img src={site.logo} alt={site.name} className='object-scale-down h-10 w-10' />
  //const [popupInfo, setPopupInfo] = useState(null);
  const pins = useMemo(() => {
    return markers.map((node) => {
      // Check if all the nodes in the site are cache nodes
      let allCache = true;
      for (var i = 0; i < node.nodes.length; i++) {
        if (!node.nodes[i].cache) {
          allCache = false;
          break;
        }
      }
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
          {allCache ?
            <FontAwesomeIcon icon={faDatabase} size="2x" className={`map-pin cursor-pointer ${node == selectedSite ? "text-red-500 z-10" : "text-green-500 z-0"}`} />
            :
            <FontAwesomeIcon icon={faLocationDot} size="2x" className={`map-pin cursor-pointer ${node == selectedSite ? "text-red-500 z-10" : "text-sky-500 z-0"}`} />
          }
        </Marker>
      )
    });
  }, [selectedSite]);

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

  // On initial load, set the size of the pins
  useEffect(() => {
    var markers = document.getElementsByClassName('map-pin');
    for (var i = 0; i < markers.length; i++) {
      markers[i].style.width = Math.max(Math.min(9 * mapRef.current.getMap().getZoom(), 30), 7) + 'px';
      markers[i].style.height = Math.max(Math.min(9 * mapRef.current.getMap().getZoom(), 30), 7) + 'px';
    }
  }, []);

  //
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
          
          onZoom={(e) => {
            // Loop through the pins and adjust the size of the icons
            var markers = document.getElementsByClassName('map-pin');
            for (var i = 0; i < markers.length; i++) {
              markers[i].style.width = Math.max(Math.min(9 * mapRef.current.getMap().getZoom(), 30), 7) + 'px';
              markers[i].style.height = Math.max(Math.min(9 * mapRef.current.getMap().getZoom(), 30), 7) + 'px';
            }
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


