"use client";

import { useState, useEffect } from "react";

type Location = {
  lat: number;
  lon: number;
};

type UseCustomerLocationResult = {
  location: Location | null;
  error: string | null;
  loading: boolean;
  requestLocation: () => void;
};

export function useCustomerLocation(): UseCustomerLocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location permission denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information unavailable");
            break;
          case err.TIMEOUT:
            setError("Location request timed out");
            break;
          default:
            setError("Failed to get location");
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  };

  // Auto-request location on mount (optional)
  useEffect(() => {
    // Uncomment to auto-request on mount
    // requestLocation();
  }, []);

  return {
    location,
    error,
    loading,
    requestLocation,
  };
}
