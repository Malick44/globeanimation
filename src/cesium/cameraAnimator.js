/**
 * Camera Motion & Pose Interpolation Engine
 * Cinematic easing, logarithmic altitude interpolation, and multi-waypoint path sampling
 */
import * as Cesium from 'cesium';

export const EASING_FUNCTIONS = {
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  linear: (t) => t,
  exponential: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  slowIn: (t) => t * t * t,
  slowOut: (t) => 1 - Math.pow(1 - t, 3),
};

/**
 * Short-arc angle interpolation (degrees)
 */
export function interpolateAngle(a, b, t) {
  const diff = ((((b - a + 540) % 360) + 360) % 360) - 180;
  return a + diff * t;
}

/**
 * Short-arc longitude normalization (-180 to 180)
 */
export function interpolateLongitude(a, b, t) {
  const raw = interpolateAngle(a, b, t);
  return ((((raw + 180) % 360) + 360) % 360) - 180;
}

/**
 * Logarithmic height interpolation for cinematic atmospheric dive
 */
export function interpolateHeight(fromH, toH, t) {
  const safeFrom = Math.max(10, fromH);
  const safeTo = Math.max(10, toH);
  const logFrom = Math.log(safeFrom);
  const logTo = Math.log(safeTo);
  return Math.exp(logFrom + (logTo - logFrom) * t);
}

/**
 * Sample camera pose at progress t (0 to 1) for two points
 */
export function sampleTwoPointCamera(start, end, progress, easingKey = 'cubicInOut') {
  const tRaw = Math.max(0, Math.min(1, Number(progress) || 0));
  const easeFn = EASING_FUNCTIONS[easingKey] || EASING_FUNCTIONS.cubicInOut;
  const t = easeFn(tRaw);

  const lat = start.latitude + (end.latitude - start.latitude) * t;
  const lon = interpolateLongitude(start.longitude, end.longitude, t);
  const height = interpolateHeight(start.height, end.height, t);
  const heading = interpolateAngle(start.heading || 0, end.heading || 0, t);
  const pitch = (start.pitch || -35) + ((end.pitch || -35) - (start.pitch || -35)) * t;
  const roll = interpolateAngle(start.roll || 0, end.roll || 0, t);

  return {
    longitude: lon,
    latitude: lat,
    height,
    heading,
    pitch,
    roll,
  };
}

/**
 * Sample camera pose across multiple waypoints
 */
export function sampleWaypointCamera(waypoints, progress, easingKey = 'linear') {
  if (!waypoints || waypoints.length === 0) return null;
  if (waypoints.length === 1) {
    const wp = waypoints[0];
    return {
      longitude: wp.longitude,
      latitude: wp.latitude,
      height: wp.height || 2000,
      heading: 0,
      pitch: -35,
      roll: 0,
    };
  }

  const tRaw = Math.max(0, Math.min(1, Number(progress) || 0));
  const easeFn = EASING_FUNCTIONS[easingKey] || EASING_FUNCTIONS.linear;
  const t = easeFn(tRaw);

  const numSegments = waypoints.length - 1;
  const scaled = t * numSegments;
  const segIndex = Math.min(Math.floor(scaled), numSegments - 1);
  const segProgress = scaled - segIndex;

  const p0 = waypoints[segIndex];
  const p1 = waypoints[segIndex + 1];

  // Calculate heading towards next waypoint
  const dx = p1.longitude - p0.longitude;
  const dy = p1.latitude - p0.latitude;
  const computedHeading = (Math.atan2(dx, dy) * 180) / Math.PI;

  const lat = p0.latitude + (p1.latitude - p0.latitude) * segProgress;
  const lon = interpolateLongitude(p0.longitude, p1.longitude, segProgress);
  const height = interpolateHeight(p0.height || 2000, p1.height || 2000, segProgress);

  return {
    longitude: lon,
    latitude: lat,
    height,
    heading: computedHeading,
    pitch: -30,
    roll: 0,
  };
}

/**
 * Apply pose directly to Cesium Viewer camera
 */
export function applyPoseToViewer(viewer, pose) {
  if (!viewer || viewer.isDestroyed() || !pose) return;

  const destination = Cesium.Cartesian3.fromDegrees(
    pose.longitude,
    pose.latitude,
    pose.height
  );

  viewer.camera.setView({
    destination,
    orientation: {
      heading: Cesium.Math.toRadians(pose.heading || 0),
      pitch: Cesium.Math.toRadians(pose.pitch || -35),
      roll: Cesium.Math.toRadians(pose.roll || 0),
    },
  });
}
