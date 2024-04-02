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
import { useSelector, useDispatch } from 'react-redux'
import { update } from '../redux/siteDisplay'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot, faExpand } from "@fortawesome/free-solid-svg-icons";

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

export default function NodeMap() {

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
  const [popupInfo, setPopupInfo] = useState(null);
  const pins = useMemo(() => {
    return markers.map((node) => {
      return (
        <Marker key={node.geo.region + "." + node.geo.city}
          longitude={node.geo.ll[1]}
          latitude={node.geo.ll[0]}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPopupInfo(node);
          }}
        >
          <FontAwesomeIcon icon={faLocationDot} size="2x" className="text-sky-500" />
        </Marker>
      )
    });
  }, []);

  // <MapMover />
  return (
    <>
      <div className="lg:min-h-[30em] min-h-[20em] w-full h-full rounded-xl drop-shadow-md">
        <Map
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          mapStyle="mapbox://styles/djw8605/cluhrtvp201az01pd8tomenyv"
          initialViewState={initialViewState}

        >
          <FullscreenControl position="top-left" />
          <NavigationControl position="top-left" />
          {pins}
          {popupInfo && (
            <Popup
              anchor="top"
              longitude={popupInfo.geo.ll[1]}
              latitude={popupInfo.geo.ll[0]}
              onClose={() => setPopupInfo(null)}
            >
              <div className="">
                <strong>{popupInfo.geo.city}, {popupInfo.geo.region}</strong>
                <br />
                {popupInfo.hostnames.map((hostname) => {
                  return (
                    <>
                      {hostname}
                      <br />
                    </>
                  );
                })
                }
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </>
  )
}


