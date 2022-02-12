import React, { useEffect, useRef, ReactElement } from "react";


export default function Map(){
  
  const ref = useRef();

  useEffect(() => {
    const uluru = { lat: 39.63517934689119, lng: -97.0739061397193 };
    // The map, centered at Uluru
    const map = new google.maps.Map(document.getElementById("map"), {
      zoom: 4,
      center: uluru,
    });
    // The marker, positioned at Uluru
    const marker = new google.maps.Marker({
      position: uluru,
      map: map,
    });
    return map;
  });
  
  
  return (
    <div ref={ref} id="map"></div>
  )


}


