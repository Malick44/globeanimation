/**
 * Cesium Viewer Initialization & Visual Effects Manager
 */
import * as Cesium from 'cesium';
import { applyThemeImagery } from './imageryProviders.js';
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

  init(onReady) {
    // Disable Cesium Ion default warning banner
    Cesium.Ion.defaultAccessToken = '';

    this.viewer = new Cesium.Viewer(this.container, {
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
    applyThemeImagery(this.viewer, 'documentary');

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

  applyTheme(themeKey) {
    if (!this.viewer || this.viewer.isDestroyed() || this.currentTheme === themeKey) return;
    this.currentTheme = themeKey;

    const scene = this.viewer.scene;
    const globe = scene.globe;

    applyThemeImagery(this.viewer, themeKey);

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

  syncScene(scene) {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    this.applyTheme(scene.theme);
    this.overlayManager.sync(scene);
  }

  seek(scene, progress) {
    if (!this.viewer || this.viewer.isDestroyed()) return;

    const cameraConfig = scene.camera;
    const waypoints = cameraConfig.waypoints;

    let pose = null;
    if (waypoints && waypoints.length >= 2) {
      pose = sampleWaypointCamera(waypoints, progress, cameraConfig.easing);
    } else {
      pose = sampleTwoPointCamera(
        cameraConfig.start,
        cameraConfig.end,
        progress,
        cameraConfig.easing
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
