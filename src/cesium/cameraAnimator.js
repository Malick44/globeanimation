/**
 * Camera Motion & Pose Interpolation Engine
 * Cinematic easing, logarithmic altitude interpolation, waypoint spline smoothing, and banking
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
export function sampleTwoPointCamera(start, end, progress, easingKey = 'cubicInOut', lookAt = null) {
  const tRaw = Math.max(0, Math.min(1, Number(progress) || 0));
  const easeFn = EASING_FUNCTIONS[easingKey] || EASING_FUNCTIONS.cubicInOut;
  const t = easeFn(tRaw);

  const lat = start.latitude + (end.latitude - start.latitude) * t;
  const lon = interpolateLongitude(start.longitude, end.longitude, t);
  const height = interpolateHeight(start.height, end.height, t);
  const heading = interpolateAngle(start.heading || 0, end.heading || 0, t);

  // For orbital space-to-city zoom-ins, stay top-down in space and tilt up near destination for dramatic skyline reveal
  const startPitch = start.pitch ?? -35;
  const endPitch = end.pitch ?? -35;
  const pitchProgress = startPitch < -65 ? Math.pow(t, 2.6) : t;
  const pitch = startPitch + (endPitch - startPitch) * pitchProgress;
  const roll = interpolateAngle(start.roll || 0, end.roll || 0, t);

  // Keep a fixed point of interest (e.g. the destination pin) centered: derive the camera ground position
  // from the interpolated height/heading/pitch instead of lerping lat/lon independently of the tilt
  if (lookAt) {
    const pitchRad = Math.abs(pitch) * (Math.PI / 180);
    const headingRad = heading * (Math.PI / 180);
    const groundDist = Math.max(0, height - (lookAt.height || 0)) / Math.max(0.1, Math.tan(pitchRad));
    const latOffset = (groundDist * Math.cos(headingRad)) / 111139;
    const lonOffset = (groundDist * Math.sin(headingRad)) / (111139 * Math.cos(lookAt.latitude * (Math.PI / 180)));
    return {
      longitude: lookAt.longitude - lonOffset,
      latitude: lookAt.latitude - latOffset,
      height,
      heading,
      pitch,
      roll,
    };
  }

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
 * Sample camera pose across multiple waypoints with smooth heading transitions & banking
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
      pitch: -30,
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

  // Current segment tangent heading
  const dx0 = p1.longitude - p0.longitude;
  const dy0 = p1.latitude - p0.latitude;
  const heading0 = ((Math.atan2(dx0, dy0) * 180) / Math.PI + 360) % 360;

  // Next segment tangent heading for gentle look-ahead
  let heading1 = heading0;
  if (segIndex + 2 < waypoints.length) {
    const p2 = waypoints[segIndex + 2];
    const dx1 = p2.longitude - p1.longitude;
    const dy1 = p2.latitude - p1.latitude;
    heading1 = ((Math.atan2(dx1, dy1) * 180) / Math.PI + 360) % 360;
  }

  // Smoothly blend heading as we approach next waypoint
  const blend = Math.pow(segProgress, 2);
  const smoothedHeading = interpolateAngle(heading0, heading1, blend * 0.45);

  // Turn banking roll (FPV drone / aircraft banking effect)
  const turnDelta = ((((heading1 - heading0 + 540) % 360) + 360) % 360) - 180;
  const roll = Math.max(-10, Math.min(10, turnDelta * 0.12 * Math.sin(segProgress * Math.PI)));

  const lat = p0.latitude + (p1.latitude - p0.latitude) * segProgress;
  const lon = interpolateLongitude(p0.longitude, p1.longitude, segProgress);
  const height = interpolateHeight(p0.height || 2000, p1.height || 2000, segProgress);

  return {
    longitude: lon,
    latitude: lat,
    height,
    heading: smoothedHeading,
    pitch: -28,
    roll,
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
