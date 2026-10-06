/**
 * Cesium Viewer Initialization & Visual Effects Manager
 */
import * as Cesium from 'cesium';
import { applyThemeImagery, applyDocumentaryImagery } from './imageryProviders.js';
import { createTerrariumTerrainProvider } from './terrainProvider.js';
import { OverlayManager } from './overlays.js';
import { sampleTwoPointCamera, sampleWaypointCamera, applyPoseToViewer } from './cameraAnimator.js';

export class GlobeEngine {
  constructor(containerElement, onReady) {
    this.container = containerElement;
    this.viewer = null;
    this.overlayManager = null;
    this.currentTheme = null;
    this.init(onReady);
  }

  async init(onReady) {
    // Disable Cesium Ion default warning banner
    Cesium.Ion.defaultAccessToken = '';

    this.viewer = new Cesium.Viewer(this.container, {
      baseLayer: false,
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: false,
      maximumRenderTimeChange: Infinity,
      orderIndependentTranslucency: true,
      contextOptions: {
        webgl: {
          preserveDrawingBuffer: true, // REQUIRED for canvas video recording & screenshots
          alpha: false,
        },
      },
    });

    const scene = this.viewer.scene;
    const globe = scene.globe;

    // High visual fidelity settings
    globe.enableLighting = true;
    globe.depthTestAgainstTerrain = false;
    scene.fog.enabled = true;
    scene.fog.density = 0.00015;
    scene.highDynamicRange = true;

    // Atmosphere
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.show = true;
    }

    // Set default imagery
    await applyThemeImagery(this.viewer, 'documentary');

    // Initialize Overlay Manager
    this.overlayManager = new OverlayManager(this.viewer);

    // Initial world view
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-20, 25, 18000000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-80),
        roll: 0,
      },
    });

    if (onReady) onReady(this);
  }

  applyTheme(themeKey, imageryKey = null) {
    const key = `${themeKey}|${imageryKey || ''}`;
    if (!this.viewer || this.viewer.isDestroyed() || this.currentTheme === key) return;
    this.currentTheme = key;

    const scene = this.viewer.scene;
    const globe = scene.globe;

    // A scene's `imagery` (open sources for documentaries) overrides the theme's imagery;
    // imageryReady resolves to its credit once the layers are on the globe
    this.imageryReady = imageryKey
      ? applyDocumentaryImagery(this.viewer, imageryKey, this.look || {})
      : applyThemeImagery(this.viewer, themeKey).then(() => null);

    if (themeKey === 'dark-data') {
      globe.enableLighting = true;
      scene.backgroundColor = Cesium.Color.fromCssColorString('#030712');
      if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
      scene.fog.density = 0.0003;
    } else if (themeKey === 'minimal-vector') {
      globe.enableLighting = false;
      scene.backgroundColor = Cesium.Color.fromCssColorString('#0f172a');
      if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
      scene.fog.density = 0.00005;
    } else if (themeKey === 'satellite-cinematic') {
      globe.enableLighting = true;
      scene.backgroundColor = Cesium.Color.BLACK;
      if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
      scene.fog.density = 0.0002;
    } else {
      // Documentary
      globe.enableLighting = true;
      scene.backgroundColor = Cesium.Color.BLACK;
      if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
      scene.fog.density = 0.00015;
    }
  }

  /**
   * A documentary look: {terrain: {exaggeration} | false, hillshade: {...} | false, nightLights,
   * sharpness (maximum screen-space error, lower is sharper), atmosphere: {hueShift, saturationShift,
   * brightnessShift, lightIntensity}, fog: density, stars: false}. Applied before the imagery so the
   * imagery stack can include the hillshade and night layers.
   */
  applyLook(look = {}) {
    const viewer = this.viewer;
    const scene = viewer.scene;
    const globe = scene.globe;
    this.look = look;
    if (look.terrain) {
      if (!this.terrainOn) {
        viewer.terrainProvider = createTerrariumTerrainProvider();
        this.terrainOn = true;
      }
      scene.verticalExaggeration = look.terrain.exaggeration ?? 1.0;
    } else if (this.terrainOn) {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      scene.verticalExaggeration = 1.0;
      this.terrainOn = false;
    }
    globe.maximumScreenSpaceError = look.sharpness ?? 2;
    // A render sweeps across many tiles: keep them (the default cache of 100 re-fetches tiles every few
    // frames on a wide oblique view) and fetch in parallel
    globe.tileCacheSize = 3000;
    globe.preloadAncestors = true;
    Cesium.RequestScheduler.maximumRequestsPerServer = 48;
    Cesium.RequestScheduler.maximumRequests = 200;
    // web-mercator imagery stops at 85 degrees: the poles show the base colour, so make it ice
    globe.baseColor = Cesium.Color.fromCssColorString(look.baseColor || '#d9dfe2');
    globe.showGroundAtmosphere = look.groundAtmosphere ?? true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    const a = look.atmosphere || {};
    for (const target of [scene.atmosphere, scene.skyAtmosphere]) {
      if (!target) continue;
      target.hueShift = a.hueShift ?? 0;
      target.saturationShift = a.saturationShift ?? 0;
      target.brightnessShift = a.brightnessShift ?? 0;
    }
    if (a.lightIntensity !== undefined) globe.atmosphereLightIntensity = a.lightIntensity;
    if (look.fog !== undefined) {
      scene.fog.enabled = true;
      scene.fog.density = look.fog;
      scene.fog.minimumBrightness = 0.08;
    }
    if (scene.skyBox) scene.skyBox.show = look.stars ?? true;
    if (scene.sun) scene.sun.show = look.sun ?? false;
    if (scene.moon) scene.moon.show = false;
    scene.postProcessStages.fxaa.enabled = true;
  }

  syncScene(scene) {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    if (scene.look) {
      this.look = scene.look;
      this.currentTheme = null; // the look's layers change with it: re-apply the imagery
    }
    this.applyTheme(scene.theme, scene.imagery);
    // after the theme, so the look's fog and lighting win over the theme's
    if (scene.look) this.applyLook(scene.look);
    // A fixed time of day keeps the sun lighting the same whenever the scene is rendered
    if (scene.time) {
      // Pin the clock: left to itself it can step to the system time, and the render then shows
      // whatever the sun is doing at the moment it runs. seek() re-applies it on every pose
      const clock = this.viewer.clock;
      this.fixedTime = Cesium.JulianDate.fromIso8601(scene.time);
      clock.clockStep = Cesium.ClockStep.TICK_DEPENDENT;
      clock.multiplier = 0;
      clock.shouldAnimate = false;
      clock.startTime = Cesium.JulianDate.clone(this.fixedTime);
      clock.stopTime = Cesium.JulianDate.clone(this.fixedTime);
      clock.clockRange = Cesium.ClockRange.CLAMPED;
      clock.currentTime = Cesium.JulianDate.clone(this.fixedTime);
    } else {
      this.fixedTime = null;
    }
    if (typeof scene.lighting === 'boolean') {
      this.viewer.scene.globe.enableLighting = scene.lighting;
    }
    // A clean plate is the globe alone: pins, routes and titles are drawn later by the caller
    if (scene.cleanPlate) {
      // forget the last scene too, or the font-load resync would bring its pins back
      this.overlayManager.lastScene = null;
      this.overlayManager.clear();
    } else {
      this.overlayManager.sync(scene);
    }
  }

  seek(scene, progress) {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    if (this.fixedTime) this.viewer.clock.currentTime = Cesium.JulianDate.clone(this.fixedTime);

    const cameraConfig = scene.camera;
    const waypoints = cameraConfig.waypoints;
    const frames = cameraConfig.frames;

    let pose = null;
    if (frames && frames.length) {
      // Poses planned by the caller, one per exported frame: [lon, lat, height, heading, pitch, roll]
      const [longitude, latitude, height, heading, pitch, roll] =
        frames[Math.min(frames.length - 1, Math.round(progress * (frames.length - 1)))];
      pose = { longitude, latitude, height, heading, pitch, roll };
    } else if (waypoints && waypoints.length >= 2) {
      pose = sampleWaypointCamera(waypoints, progress, cameraConfig.easing);
    } else {
      pose = sampleTwoPointCamera(
        cameraConfig.start,
        cameraConfig.end,
        progress,
        cameraConfig.easing,
        cameraConfig.lookAt
      );
    }

    if (pose) {
      applyPoseToViewer(this.viewer, pose);
    }
  }

  getCanvas() {
    return this.viewer?.canvas;
  }

  destroy() {
    if (this.overlayManager) this.overlayManager.clear();
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }
  }
}
