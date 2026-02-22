// Geo utilities for distance calculation

/**
 * Convert degrees to radians
 */
function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate the distance between two points using the Haversine formula.
 * Returns distance in kilometers.
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format distance for display
 * @param km - Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Sort terminals by distance from a given location
 */
export type WithCoordinates = {
  lat?: number;
  lon?: number;
};

export function sortByDistance<T extends WithCoordinates>(
  items: T[],
  location: { lat: number; lon: number }
): T[] {
  return [...items].sort((a, b) => {
    // Items without coordinates go to the end
    if (!a.lat || !a.lon) return 1;
    if (!b.lat || !b.lon) return -1;

    const distA = haversineDistance(location.lat, location.lon, a.lat, a.lon);
    const distB = haversineDistance(location.lat, location.lon, b.lat, b.lon);

    return distA - distB;
  });
}

/**
 * Add distance to items
 */
export function withDistance<T extends WithCoordinates>(
  items: T[],
  location: { lat: number; lon: number }
): (T & { distance?: number })[] {
  return items.map((item) => {
    if (!item.lat || !item.lon) {
      return { ...item, distance: undefined };
    }
    return {
      ...item,
      distance: haversineDistance(location.lat, location.lon, item.lat, item.lon),
    };
  });
}
