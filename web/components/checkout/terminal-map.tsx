"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Clock } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import type { Terminal } from "@/hooks/use-terminals";
import { cn } from "@/lib/utils";

// Fix for default marker icons in Leaflet with bundlers
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

type Props = {
  terminals: Terminal[];
  selectedTerminalId?: string;
  onSelect: (terminal: Terminal) => void;
  customerLocation?: { lat: number; lon: number } | null;
  className?: string;
};

// Component to fit bounds to terminals
function FitBounds({ terminals }: { terminals: Terminal[] }) {
  const map = useMap();

  useEffect(() => {
    if (terminals.length === 0) return;

    const validTerminals = terminals.filter((t) => t.lat && t.lon);
    if (validTerminals.length === 0) return;

    const bounds = L.latLngBounds(
      validTerminals.map((t) => [t.lat!, t.lon!])
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, terminals]);

  return null;
}

// Component to handle map center updates
function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 13);
  }, [map, center]);

  return null;
}

export function TerminalMap({
  terminals,
  selectedTerminalId,
  onSelect,
  customerLocation,
  className,
}: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate map center
  const mapCenter: [number, number] = (() => {
    if (customerLocation) {
      return [customerLocation.lat, customerLocation.lon];
    }
    if (terminals.length > 0 && terminals[0].lat && terminals[0].lon) {
      return [terminals[0].lat, terminals[0].lon];
    }
    // Default to Estonia center
    return [59.0, 26.0];
  })();

  // Filter terminals with valid coordinates
  const validTerminals = terminals.filter((t) => t.lat && t.lon);

  if (!isMounted) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-border/20 rounded-lg", className)}>
        <span className="text-foreground/50">Loading map...</span>
      </div>
    );
  }

  if (validTerminals.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-border/20 rounded-lg", className)}>
        <span className="text-foreground/50">No terminals with coordinates available</span>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden", className)}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {customerLocation && (
          <Marker
            position={[customerLocation.lat, customerLocation.lon]}
            icon={L.divIcon({
              className: "customer-marker",
              html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          >
            <Popup>Your location</Popup>
          </Marker>
        )}

        {validTerminals.map((terminal) => (
          <Marker
            key={terminal.id}
            position={[terminal.lat!, terminal.lon!]}
            icon={terminal.id === selectedTerminalId ? selectedIcon : defaultIcon}
            eventHandlers={{
              click: () => onSelect(terminal),
            }}
          >
            <Popup>
              <TerminalPopup
                terminal={terminal}
                isSelected={terminal.id === selectedTerminalId}
                onSelect={() => onSelect(terminal)}
              />
            </Popup>
          </Marker>
        ))}

        <FitBounds terminals={validTerminals} />
      </MapContainer>
    </div>
  );
}

type TerminalPopupProps = {
  terminal: Terminal;
  isSelected: boolean;
  onSelect: () => void;
};

function TerminalPopup({ terminal, isSelected, onSelect }: TerminalPopupProps) {
  return (
    <div className="min-w-[200px]">
      <h4 className="font-semibold text-sm">{terminal.name}</h4>
      <div className="mt-1 flex items-start gap-1 text-xs text-gray-600">
        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
        <span>{terminal.address}</span>
      </div>
      {terminal.hours && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>{terminal.hours}</span>
        </div>
      )}
      {terminal.distance !== undefined && (
        <div className="mt-1 text-xs font-medium text-blue-600">
          {formatDistance(terminal.distance)} away
        </div>
      )}
      <button
        onClick={onSelect}
        className={cn(
          "mt-2 w-full rounded px-2 py-1 text-xs font-medium transition-colors",
          isSelected
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        )}
      >
        {isSelected ? "Selected" : "Select this terminal"}
      </button>
    </div>
  );
}
