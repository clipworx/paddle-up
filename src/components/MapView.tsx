"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  className: "",
});

type Props = {
  lat: number;
  lng: number;
  label: string;
};

export default function MapView({ lat, lng, label }: Props) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 220 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          zoomControl
          dragging
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={[lat, lng]} icon={pinIcon}>
            <Popup>{label}</Popup>
          </Marker>
        </MapContainer>
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
      >
        Get directions ↗
      </a>
    </div>
  );
}
