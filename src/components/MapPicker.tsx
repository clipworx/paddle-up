"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default centre: Metro Manila
const DEFAULT_LAT = 14.5995;
const DEFAULT_LNG = 120.9842;
const DEFAULT_ZOOM = 14;

const pinIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  className: "",
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const didFly = useRef(false);
  useEffect(() => {
    if (!didFly.current) {
      map.setView([lat, lng], DEFAULT_ZOOM, { animate: false });
      didFly.current = true;
    }
  }, [map, lat, lng]);
  return null;
}

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

export default function MapPicker({ lat, lng, onChange }: Props) {
  const hasPin = lat !== null && lng !== null;
  const centerLat = hasPin ? lat : DEFAULT_LAT;
  const centerLng = hasPin ? lng : DEFAULT_LNG;

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 300 }}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ClickHandler onPick={onChange} />
          {hasPin && (
            <>
              <FlyTo lat={lat} lng={lng} />
              <Marker
                position={[lat, lng]}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend(e) {
                    const m = e.target as L.Marker;
                    const p = m.getLatLng();
                    onChange(p.lat, p.lng);
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>
      {hasPin ? (
        <p className="text-[11px] text-muted">
          Pin at {lat.toFixed(6)}, {lng.toFixed(6)} — click map or drag pin to reposition.
        </p>
      ) : (
        <p className="text-[11px] text-muted">Click on the map to place a pin.</p>
      )}
    </div>
  );
}
