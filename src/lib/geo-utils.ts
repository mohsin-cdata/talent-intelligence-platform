// Geographic Utilities for Location-based Matching
// Includes zip code distance calculation using Haversine formula

// US Zip Code coordinates (sample - in production, use a complete database)
// Format: { zipCode: { lat: number, lng: number, city: string, state: string } }
const ZIP_COORDINATES: Record<string, { lat: number; lng: number; city: string; state: string }> = {
  // Texas
  '78701': { lat: 30.2672, lng: -97.7431, city: 'Austin', state: 'TX' },
  '78702': { lat: 30.2621, lng: -97.7200, city: 'Austin', state: 'TX' },
  '78703': { lat: 30.2960, lng: -97.7635, city: 'Austin', state: 'TX' },
  '75201': { lat: 32.7876, lng: -96.7985, city: 'Dallas', state: 'TX' },
  '75202': { lat: 32.7810, lng: -96.7986, city: 'Dallas', state: 'TX' },
  '77001': { lat: 29.7528, lng: -95.3586, city: 'Houston', state: 'TX' },
  '77002': { lat: 29.7589, lng: -95.3614, city: 'Houston', state: 'TX' },
  '78201': { lat: 29.4669, lng: -98.5253, city: 'San Antonio', state: 'TX' },

  // California
  '94102': { lat: 37.7815, lng: -122.4117, city: 'San Francisco', state: 'CA' },
  '94103': { lat: 37.7726, lng: -122.4099, city: 'San Francisco', state: 'CA' },
  '94104': { lat: 37.7915, lng: -122.4018, city: 'San Francisco', state: 'CA' },
  '90001': { lat: 33.9425, lng: -118.2551, city: 'Los Angeles', state: 'CA' },
  '90210': { lat: 34.0901, lng: -118.4065, city: 'Beverly Hills', state: 'CA' },
  '92101': { lat: 32.7194, lng: -117.1628, city: 'San Diego', state: 'CA' },
  '95101': { lat: 37.3382, lng: -121.8863, city: 'San Jose', state: 'CA' },

  // Washington
  '98101': { lat: 47.6097, lng: -122.3331, city: 'Seattle', state: 'WA' },
  '98102': { lat: 47.6366, lng: -122.3214, city: 'Seattle', state: 'WA' },
  '98103': { lat: 47.6711, lng: -122.3426, city: 'Seattle', state: 'WA' },

  // New York
  '10001': { lat: 40.7484, lng: -73.9967, city: 'New York', state: 'NY' },
  '10002': { lat: 40.7157, lng: -73.9863, city: 'New York', state: 'NY' },
  '10003': { lat: 40.7317, lng: -73.9892, city: 'New York', state: 'NY' },
  '10004': { lat: 40.6988, lng: -74.0401, city: 'New York', state: 'NY' },

  // Illinois
  '60601': { lat: 41.8862, lng: -87.6186, city: 'Chicago', state: 'IL' },
  '60602': { lat: 41.8832, lng: -87.6288, city: 'Chicago', state: 'IL' },
  '60603': { lat: 41.8797, lng: -87.6256, city: 'Chicago', state: 'IL' },

  // Massachusetts
  '02101': { lat: 42.3588, lng: -71.0582, city: 'Boston', state: 'MA' },
  '02102': { lat: 42.3493, lng: -71.0478, city: 'Boston', state: 'MA' },
  '02108': { lat: 42.3576, lng: -71.0665, city: 'Boston', state: 'MA' },

  // Georgia
  '30301': { lat: 33.7629, lng: -84.4227, city: 'Atlanta', state: 'GA' },
  '30302': { lat: 33.7488, lng: -84.3880, city: 'Atlanta', state: 'GA' },
  '30303': { lat: 33.7540, lng: -84.3900, city: 'Atlanta', state: 'GA' },

  // Colorado
  '80201': { lat: 39.7392, lng: -104.9847, city: 'Denver', state: 'CO' },
  '80202': { lat: 39.7512, lng: -104.9963, city: 'Denver', state: 'CO' },
  '80203': { lat: 39.7312, lng: -104.9826, city: 'Denver', state: 'CO' },

  // Arizona
  '85001': { lat: 33.4484, lng: -112.0773, city: 'Phoenix', state: 'AZ' },
  '85002': { lat: 33.4373, lng: -112.0880, city: 'Phoenix', state: 'AZ' },
  '85003': { lat: 33.4495, lng: -112.0792, city: 'Phoenix', state: 'AZ' },

  // Oregon
  '97201': { lat: 45.5051, lng: -122.6903, city: 'Portland', state: 'OR' },
  '97202': { lat: 45.4818, lng: -122.6398, city: 'Portland', state: 'OR' },
  '97203': { lat: 45.5829, lng: -122.7548, city: 'Portland', state: 'OR' },

  // North Carolina
  '27601': { lat: 35.7796, lng: -78.6382, city: 'Raleigh', state: 'NC' },
  '27602': { lat: 35.7721, lng: -78.6386, city: 'Raleigh', state: 'NC' },
  '28201': { lat: 35.2271, lng: -80.8431, city: 'Charlotte', state: 'NC' },
};

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two zip codes
 * @returns Distance in miles, or null if zip codes not found
 */
export function calculateDistance(zip1: string, zip2: string): number | null {
  const coord1 = ZIP_COORDINATES[zip1];
  const coord2 = ZIP_COORDINATES[zip2];

  if (!coord1 || !coord2) {
    // If we don't have coordinates, try to estimate based on state
    return estimateDistanceByState(zip1, zip2);
  }

  return Math.round(haversineDistance(coord1.lat, coord1.lng, coord2.lat, coord2.lng));
}

/**
 * Estimate distance when exact coordinates aren't available
 */
function estimateDistanceByState(zip1: string, zip2: string): number | null {
  // Simple heuristic: if first 3 digits match, likely same metro area
  if (zip1.substring(0, 3) === zip2.substring(0, 3)) {
    return 15; // Assume ~15 miles within same zip3
  }

  // If first 2 digits match, same state region
  if (zip1.substring(0, 2) === zip2.substring(0, 2)) {
    return 75; // Assume ~75 miles within same region
  }

  // Different regions - return null (unknown)
  return null;
}

/**
 * Get zip code info
 */
export function getZipInfo(zipCode: string): {
  lat: number;
  lng: number;
  city: string;
  state: string;
} | null {
  return ZIP_COORDINATES[zipCode] || null;
}

/**
 * Find all zip codes within a radius of a target zip
 */
export function findZipsWithinRadius(
  targetZip: string,
  radiusMiles: number
): string[] {
  const target = ZIP_COORDINATES[targetZip];
  if (!target) return [];

  const nearbyZips: string[] = [];

  for (const [zip, coords] of Object.entries(ZIP_COORDINATES)) {
    if (zip === targetZip) continue;

    const distance = haversineDistance(target.lat, target.lng, coords.lat, coords.lng);
    if (distance <= radiusMiles) {
      nearbyZips.push(zip);
    }
  }

  return nearbyZips;
}

/**
 * Get city and state from zip code
 */
export function getCityStateFromZip(zipCode: string): { city: string; state: string } | null {
  const info = ZIP_COORDINATES[zipCode];
  if (!info) return null;
  return { city: info.city, state: info.state };
}

/**
 * Check if a location is within radius
 */
export function isWithinRadius(
  candidateZip: string,
  jobZip: string,
  radiusMiles: number
): boolean {
  const distance = calculateDistance(candidateZip, jobZip);
  if (distance === null) return false;
  return distance <= radiusMiles;
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number | null): string {
  if (miles === null) return 'Unknown';
  if (miles === 0) return 'Same location';
  if (miles < 1) return 'Less than 1 mile';
  return `${Math.round(miles)} miles`;
}
