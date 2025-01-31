import NodeMap from "../components/nodeMap";
import {useState} from "react";



export default function MapPage() {
  const [selectedSite, setSelectedSite] = useState(null);

  return (
    <>
      <div className="w-screen h-screen">
        <NodeMap setSelectedSite={setSelectedSite} selectedSite={selectedSite} usePopup={true}>

        </NodeMap>
      </div>
    </>
  )
}