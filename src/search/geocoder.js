/**
 * Geocoding & Coordinate Resolver for GlobeLocation
 * Integrates OpenStreetMap Nominatim with caching, debouncing, and direct coordinate parsing
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const cache = new Map();

/**
 * Check if input string is raw coordinates (e.g. "37.7749, -122.4194" or "37.7749 -122.4194")
 */
export function parseCoordinates(query) {
  if (!query || typeof query !== 'string') return null;
  const trimmed = query.trim();
  // Regex to match "lat, lon" or "lat lon"
  const match = trimmed.match(/^([-+]?[0-9]*\.?[0-9]+)[,\s]+([-+]?[0-9]*\.?[0-9]+)$/);
  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);

  if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    return {
      name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
      description: 'Coordinates',
      latitude: lat,
      longitude: lon,
      height: 2500,
    };
  }
  return null;
}

/**
 * Search locations via Nominatim with debounce & abort support
 */
export async function searchLocations(query, { signal } = {}) {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 2) return [];

  // Check if raw coordinates
  const coords = parseCoordinates(trimmed);
  if (coords) return [coords];

  if (cache.has(trimmed)) {
    return cache.get(trimmed);
  }

  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(trimmed)}&addressdetails=1&limit=6`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal,
    });

    if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);

    const data = await res.json();
    const results = data.map((item) => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const parts = (item.display_name || '').split(',').map((s) => s.trim());
      const primaryName = parts[0] || 'Unknown Place';
      const secondaryDesc = parts.slice(1, 4).join(', ');

      // Estimate appropriate altitude based on place type
      let defaultAltitude = 2500;
      if (item.type === 'country' || item.class === 'boundary') defaultAltitude = 800000;
      else if (item.type === 'state' || item.type === 'region') defaultAltitude = 250000;
      else if (item.type === 'city' || item.type === 'administrative') defaultAltitude = 12000;
      else if (item.type === 'suburb' || item.type === 'neighbourhood') defaultAltitude = 4000;
      else if (item.type === 'mountain' || item.type === 'peak') defaultAltitude = 5000;

      return {
        name: primaryName,
        description: secondaryDesc || item.display_name,
        latitude: lat,
        longitude: lon,
        height: defaultAltitude,
        boundingBox: item.boundingbox,
      };
    });

    cache.set(trimmed, results);
    return results;
  } catch (err) {
    if (err.name === 'AbortError') return [];
    console.warn('Geocoding search failed:', err);
    return [];
  }
}
