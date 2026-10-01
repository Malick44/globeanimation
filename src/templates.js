/**
 * MVP Video Template Engine for GlobeLocation
 * Defines the 6 creator-first templates specified in pr.md
 */

export const TEMPLATES = [
  {
    id: 'globe-to-place',
    name: 'Globe to Place',
    badge: 'Popular',
    icon: 'public',
    idealDuration: 8,
    minDuration: 5,
    maxDuration: 12,
    description: 'Cinematic descent from global space orbit down to your exact street or landmark with title reveal.',
    inputsNeeded: 'One location, city, landmark, or coordinates',
  },
  {
    id: 'place-reveal',
    name: 'Place Reveal',
    badge: 'Aerial',
    icon: 'camera',
    idealDuration: 6,
    minDuration: 3,
    maxDuration: 8,
    description: 'Dynamic 3D aerial orbit pan and zoom around your destination, capturing depth and geography.',
    inputsNeeded: 'One landmark or destination',
  },
  {
    id: 'route-flyover',
    name: 'Route Flyover',
    badge: 'Motion',
    icon: 'route',
    idealDuration: 12,
    minDuration: 6,
    maxDuration: 20,
    description: 'Fly along roads, trails, rivers, or flight paths with glowing 3D trajectory ribbons and waypoint callouts.',
    inputsNeeded: 'Start & destination points, or multi-stop trail',
  },
  {
    id: 'multi-stop',
    name: 'Multi-Stop Story',
    badge: 'Sequence',
    icon: 'timeline',
    idealDuration: 14,
    minDuration: 8,
    maxDuration: 25,
    description: 'Sequential chapter-by-chapter journey connecting 2 to 10 points of interest across the globe.',
    inputsNeeded: '2 to 10 connected locations',
  },
  {
    id: 'region-explainer',
    name: 'Region Explainer',
    badge: 'Context',
    icon: 'map',
    idealDuration: 8,
    minDuration: 4,
    maxDuration: 12,
    description: 'High-altitude regional fly-in highlighting territory boundaries, geographic context, and key facts.',
    inputsNeeded: 'Country, state, territory, or district',
  },
  {
    id: 'before-after',
    name: 'Before / After Context',
    badge: 'Comparison',
    icon: 'compare',
    idealDuration: 8,
    minDuration: 5,
    maxDuration: 12,
    description: 'Seamless two-phase transition comparing broad macro context to fine micro detail.',
    inputsNeeded: 'Macro viewpoint and detail viewpoint',
  },
];

/**
 * Configure camera start and end poses based on template and location
 */
export function buildCameraForTemplate(templateId, location, currentCamera = {}) {
  const lat = Number(location.latitude) || 37.7749;
  const lon = Number(location.longitude) || -122.4194;
  const targetAlt = Number(location.height) || 2200;

  switch (templateId) {
    case 'globe-to-place':
      return {
        start: {
          longitude: lon + 25,
          latitude: Math.min(80, Math.max(-80, lat - 15)),
          height: 16500000,
          heading: 0,
          pitch: -85,
          roll: 0,
        },
        end: {
          longitude: lon,
          latitude: lat,
          height: targetAlt,
          heading: 20,
          pitch: -38,
          roll: 0,
        },
        easing: 'cubicInOut',
        waypoints: [],
      };

    case 'place-reveal':
      return {
        start: {
          longitude: lon - 0.015,
          latitude: lat - 0.012,
          height: targetAlt * 1.8,
          heading: -35,
          pitch: -25,
          roll: 0,
        },
        end: {
          longitude: lon + 0.012,
          latitude: lat + 0.010,
          height: targetAlt,
          heading: 55,
          pitch: -38,
          roll: 0,
        },
        easing: 'cubicInOut',
        orbitAngle: 90,
        waypoints: [],
      };

    case 'route-flyover': {
      // Default sample 3-point route around location if no waypoints exist
      const waypoints = currentCamera.waypoints && currentCamera.waypoints.length >= 2
        ? currentCamera.waypoints
        : [
            { longitude: lon - 0.04, latitude: lat - 0.03, height: targetAlt * 1.5, name: 'Start' },
            { longitude: lon - 0.01, latitude: lat - 0.01, height: targetAlt * 1.2, name: 'Waystation' },
            { longitude: lon, latitude: lat, height: targetAlt, name: location.name || 'Destination' },
          ];

      const first = waypoints[0];
      const last = waypoints[waypoints.length - 1];

      return {
        start: {
          longitude: first.longitude,
          latitude: first.latitude,
          height: first.height || targetAlt * 1.4,
          heading: 45,
          pitch: -28,
          roll: 0,
        },
        end: {
          longitude: last.longitude,
          latitude: last.latitude,
          height: last.height || targetAlt,
          heading: 65,
          pitch: -34,
          roll: 0,
        },
        easing: 'linear',
        waypoints,
      };
    }

    case 'multi-stop': {
      const stops = currentCamera.waypoints && currentCamera.waypoints.length >= 2
        ? currentCamera.waypoints
        : [
            { longitude: lon - 0.08, latitude: lat + 0.02, height: targetAlt * 1.3, name: 'Stop 1' },
            { longitude: lon, latitude: lat, height: targetAlt, name: 'Stop 2: ' + (location.name || 'Center') },
            { longitude: lon + 0.06, latitude: lat - 0.03, height: targetAlt * 1.2, name: 'Stop 3' },
          ];

      return {
        start: {
          longitude: stops[0].longitude,
          latitude: stops[0].latitude,
          height: stops[0].height || targetAlt * 1.5,
          heading: 90,
          pitch: -30,
          roll: 0,
        },
        end: {
          longitude: stops[stops.length - 1].longitude,
          latitude: stops[stops.length - 1].latitude,
          height: stops[stops.length - 1].height || targetAlt,
          heading: 110,
          pitch: -35,
          roll: 0,
        },
        easing: 'cubicInOut',
        waypoints: stops,
      };
    }

    case 'region-explainer':
      return {
        start: {
          longitude: lon,
          latitude: lat,
          height: 3500000,
          heading: 0,
          pitch: -80,
          roll: 0,
        },
        end: {
          longitude: lon,
          latitude: lat,
          height: 450000,
          heading: 10,
          pitch: -55,
          roll: 0,
        },
        easing: 'cubicInOut',
        waypoints: [],
      };

    case 'before-after':
      return {
        start: {
          longitude: lon - 0.06,
          latitude: lat - 0.04,
          height: targetAlt * 4,
          heading: 0,
          pitch: -65,
          roll: 0,
        },
        end: {
          longitude: lon,
          latitude: lat,
          height: targetAlt * 0.8,
          heading: 35,
          pitch: -30,
          roll: 0,
        },
        easing: 'cubicInOut',
        waypoints: [],
      };

    default:
      return currentCamera;
  }
}
