/**
 * GPX & GeoJSON Route Parser for GlobeLocation
 * Enables importing hiking trails, flight paths, driving routes from Strava, AllTrails, Google Earth, and Garmin
 */

export function subsamplePoints(points, maxCount = 30) {
  if (!points || points.length <= maxCount) return points;
  const step = (points.length - 1) / (maxCount - 1);
  const result = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.min(Math.round(i * step), points.length - 1);
    result.push(points[idx]);
  }
  return result;
}

export function parseGpx(gpxText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, 'application/xml');
  const errorNode = xml.querySelector('parsererror');
  if (errorNode) throw new Error('Invalid GPX XML format');

  const points = [];
  // Search for trackpoints first, then route points, then waypoints
  let trackpoints = xml.querySelectorAll('trkpt');
  if (!trackpoints || trackpoints.length === 0) {
    trackpoints = xml.querySelectorAll('rtept');
  }
  if (!trackpoints || trackpoints.length === 0) {
    trackpoints = xml.querySelectorAll('wpt');
  }

  trackpoints.forEach((pt, index) => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const eleNode = pt.querySelector('ele');
    const nameNode = pt.querySelector('name');
    const ele = eleNode ? parseFloat(eleNode.textContent) : 1500;
    const name = nameNode ? nameNode.textContent : `Waypoint ${index + 1}`;

    if (!isNaN(lat) && !isNaN(lon)) {
      points.push({
        latitude: lat,
        longitude: lon,
        height: isNaN(ele) ? 1500 : ele + 400, // add camera clearance altitude
        name,
      });
    }
  });

  return subsamplePoints(points, 35);
}

export function parseGeoJson(geoJsonText) {
  const data = typeof geoJsonText === 'string' ? JSON.parse(geoJsonText) : geoJsonText;
  const rawCoords = [];

  function extractCoords(geom) {
    if (!geom) return;
    if (geom.type === 'LineString') {
      rawCoords.push(...geom.coordinates);
    } else if (geom.type === 'MultiLineString') {
      geom.coordinates.forEach((line) => rawCoords.push(...line));
    } else if (geom.type === 'Point') {
      rawCoords.push(geom.coordinates);
    }
  }

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    data.features.forEach((f) => extractCoords(f.geometry));
  } else if (data.type === 'Feature') {
    extractCoords(data.geometry);
  } else if (data.coordinates) {
    extractCoords(data);
  }

  const points = rawCoords.map((coord, index) => {
    const lon = parseFloat(coord[0]);
    const lat = parseFloat(coord[1]);
    const ele = coord.length > 2 ? parseFloat(coord[2]) : 1500;
    return {
      latitude: lat,
      longitude: lon,
      height: isNaN(ele) ? 1500 : ele + 400,
      name: `Point ${index + 1}`,
    };
  });

  return subsamplePoints(points, 35);
}

export async function parseRouteFile(file) {
  const text = await file.text();
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.gpx')) {
    const waypoints = parseGpx(text);
    if (!waypoints.length) throw new Error('No trackpoints found in GPX file');
    return waypoints;
  }

  if (lowerName.endsWith('.geojson') || lowerName.endsWith('.json')) {
    const waypoints = parseGeoJson(text);
    if (!waypoints.length) throw new Error('No coordinates found in GeoJSON file');
    return waypoints;
  }

  // Attempt GPX first then GeoJSON
  try {
    return parseGpx(text);
  } catch {
    return parseGeoJson(text);
  }
}
