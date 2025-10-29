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



export default function NodeMap( {setSelectedSite, selectedSite, usePopup=false, selectedSites=[], setSelectedSites, selectionLegendName='Selected Sites', regexPattern='', handleRegexChange}) {
  // Fetch nodes data from API
  const { data: Nodes, error, isLoading } = useSWR('/api/nodes', fetcher);

  const uluru = { lat: 39.63517934689119, lng: -97.0739061397193 };

  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(3);

  // Helper to check if a site is selected
  const isSiteSelected = (node) => {
    return selectedSites && selectedSites.some(s => s.id === node.id);
  };

  // Helper to toggle site selection
  const toggleSiteSelection = (node) => {
    if (!setSelectedSites) return;
    setSelectedSites(prev => {
      const isSelected = prev.some(s => s.id === node.id);
      if (isSelected) {
        return prev.filter(s => s.id !== node.id);
      } else {
        return [...prev, node];
      }
    });
  };

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

      const computedSelectedSize = Math.max(Math.min(9 * (zoom || 1) * 1.3, 35), 9);
      
      // Determine colors based on node type
      let pinColor = "text-sky-500"; // Default NRP blue
      if (allCache) {
        pinColor = "text-green-500"; // OSDF green
      }
      
      // Check selection state - multi-selected sites are red
      const isSelected = node === selectedSite;
      const isMultiSelected = isSiteSelected(node);
      
      if (isMultiSelected) {
        pinColor = "text-red-500"; // Red for multi-selected sites
      }
      
      // Selection styling
      let selectionClass = "";
      let finalSize = computedSize;
      if (isMultiSelected) {
        selectionClass = "drop-shadow-lg";
        finalSize = computedSelectedSize;
      }
      const zIndex = (isSelected || isMultiSelected) ? "z-10" : "z-0";
      const finalColor = `${pinColor} ${zIndex} ${selectionClass}`;
      
      const iconStyle = { width: `${finalSize}px`, height: `${finalSize}px` };

      return (
        <Marker key={node.id}
          longitude={node.longitude}
          latitude={node.latitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            // Ctrl/Cmd + Click for multi-select, regular click for single select
            if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
              toggleSiteSelection(node);
            } else {
              setSelectedSite(node);
            }
          }}
        >
          {allCache ?
            <FontAwesomeIcon icon={faDatabase} style={iconStyle} className={`map-pin cursor-pointer ${finalColor}`} />
            :
            <FontAwesomeIcon icon={faLocationDot} style={iconStyle} className={`map-pin cursor-pointer ${finalColor}`} />
          }
        </Marker>
      );
    });
  }, [Nodes, selectedSite, zoom, setSelectedSite, selectedSites]);

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
          <li className="flex flex-row items-center gap-2 mb-2">
            <FontAwesomeIcon icon={faDatabase} size="2x" className="text-green-500"/>
            OSDF-exclusive Site
          </li>
          {selectedSites && selectedSites.length > 0 && (
            <li className="flex flex-row items-center gap-2 border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
              <FontAwesomeIcon icon={faLocationDot} size="2x" className="text-red-500"/>
              {selectionLegendName}
            </li>
          )}
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


