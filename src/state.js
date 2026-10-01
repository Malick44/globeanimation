/**
 * Central State Store for GlobeLocation Creator Studio
 * Reactive state with subscriber pattern for seamless UI updates
 */

export const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080, label: '16:9 (Landscape / YouTube)', icon: 'crop_16_9' },
  '9:16': { width: 1080, height: 1920, label: '9:16 (Vertical / Shorts / Reels)', icon: 'crop_portrait' },
  '1:1': { width: 1080, height: 1080, label: '1:1 (Square / Instagram)', icon: 'crop_square' },
};

export const VISUAL_THEMES = {
  'documentary': {
    name: 'Clean Documentary',
    description: 'High-clarity satellite imagery with daytime atmosphere and crisp typography.',
    imagery: 'esri',
    atmosphere: true,
    lighting: true,
    textColor: '#ffffff',
    accentColor: '#06b6d4',
  },
  'satellite-cinematic': {
    name: 'Satellite Cinematic',
    description: 'Dramatic low-sun terminator, high-altitude bloom, and deep space atmosphere.',
    imagery: 'esri',
    atmosphere: true,
    lighting: true,
    bloom: true,
    textColor: '#ffffff',
    accentColor: '#f59e0b',
  },
  'minimal-vector': {
    name: 'Minimal Vector / Map',
    description: 'Crisp OpenStreetMap cartography with clean architectural styling.',
    imagery: 'osm',
    atmosphere: false,
    lighting: false,
    textColor: '#f8fafc',
    accentColor: '#38bdf8',
  },
  'dark-data': {
    name: 'Dark Data / Explainer',
    description: 'Dark midnight aesthetic with glowing neon data paths and radiant beacons.',
    imagery: 'dark',
    atmosphere: true,
    lighting: true,
    bloom: true,
    textColor: '#e0e7ff',
    accentColor: '#a855f7',
  },
};

export const DEFAULT_SCENE = {
  version: 1,
  name: 'Fairfield Location Intro',
  format: {
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 8,
  },
  template: 'globe-to-place',
  theme: 'documentary',
  camera: {
    start: {
      longitude: -20,
      latitude: 25,
      height: 18000000,
      heading: 0,
      pitch: -80,
      roll: 0,
    },
    end: {
      longitude: -122.039,
      latitude: 38.249,
      height: 2400,
      heading: 15,
      pitch: -38,
      roll: 0,
    },
    easing: 'cubicInOut',
    orbitAngle: 45,
    waypoints: [],
  },
  location: {
    name: 'Fairfield, California',
    description: 'Solano County, Northern California',
    latitude: 38.249,
    longitude: -122.039,
    height: 2400,
  },
  overlays: [
    {
      id: 'pin-main',
      type: 'pin',
      latitude: 38.249,
      longitude: -122.039,
      height: 0,
      label: 'Fairfield, California',
      sublabel: 'Solano County',
      color: '#f59e0b',
      icon: 'location_on',
      pulse: true,
    },
  ],
  timeline: [
    {
      id: 'event-1',
      at: 4.8,
      action: 'showTitle',
      text: 'Fairfield, California',
      subtext: 'Gateway to Suisun Valley & Northern California',
      position: 'lower-third',
    },
  ],
  audio: {
    enabled: true,
    type: 'cinematic-drone',
    volume: 0.7,
  },
  guides: {
    show: false,
    titleSafe: true,
    actionSafe: true,
    ruleOfThirds: true,
    crosshair: true,
  },
};

class Store {
  constructor() {
    this.scene = JSON.parse(JSON.stringify(DEFAULT_SCENE));
    this.playback = {
      isPlaying: false,
      currentTime: 0,
      progress: 0,
      isScrubbing: false,
      loop: true,
    };
    this.exporting = {
      isExporting: false,
      progress: 0,
      status: 'Ready',
      blobUrl: null,
      fileSize: 0,
    };
    this.listeners = new Set();
  }

  get state() {
    return {
      scene: this.scene,
      playback: this.playback,
      exporting: this.exporting,
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeType = 'update') {
    for (const listener of this.listeners) {
      try {
        listener(this.state, changeType);
      } catch (err) {
        console.error('Store subscriber error:', err);
      }
    }
  }

  updateScene(partial, notify = true) {
    this.scene = { ...this.scene, ...partial };
    if (notify) this.notify('scene');
  }

  updateFormat(aspectRatio) {
    const preset = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['16:9'];
    this.scene.format.aspectRatio = aspectRatio;
    this.scene.format.width = preset.width;
    this.scene.format.height = preset.height;
    this.notify('format');
  }

  updateCamera(partial) {
    this.scene.camera = { ...this.scene.camera, ...partial };
    this.notify('camera');
  }

  updateLocation(location) {
    this.scene.location = { ...this.scene.location, ...location };
    // Also update main pin
    const mainPin = this.scene.overlays.find((o) => o.type === 'pin');
    if (mainPin) {
      mainPin.latitude = location.latitude;
      mainPin.longitude = location.longitude;
      if (location.name) mainPin.label = location.name;
    }
    // Also update title event
    const titleEvent = this.scene.timeline.find((t) => t.action === 'showTitle');
    if (titleEvent && location.name) {
      titleEvent.text = location.name;
      if (location.description) titleEvent.subtext = location.description;
    }
    this.notify('location');
  }

  setPlayback(partial) {
    this.playback = { ...this.playback, ...partial };
    this.notify('playback');
  }

  setExporting(partial) {
    this.exporting = { ...this.exporting, ...partial };
    this.notify('exporting');
  }

  loadScene(sceneJson) {
    try {
      const parsed = typeof sceneJson === 'string' ? JSON.parse(sceneJson) : sceneJson;
      // Merge with defaults for safety
      this.scene = {
        ...DEFAULT_SCENE,
        ...parsed,
        format: { ...DEFAULT_SCENE.format, ...(parsed.format || {}) },
        camera: { ...DEFAULT_SCENE.camera, ...(parsed.camera || {}) },
        overlays: parsed.overlays || DEFAULT_SCENE.overlays,
        timeline: parsed.timeline || DEFAULT_SCENE.timeline,
      };
      this.playback.currentTime = 0;
      this.playback.progress = 0;
      this.playback.isPlaying = false;
      this.notify('scene-loaded');
      return true;
    } catch (err) {
      console.error('Failed to load scene:', err);
      return false;
    }
  }

  resetScene() {
    this.scene = JSON.parse(JSON.stringify(DEFAULT_SCENE));
    this.playback.currentTime = 0;
    this.playback.progress = 0;
    this.playback.isPlaying = false;
    this.notify('scene-reset');
  }
}

export const store = new Store();
