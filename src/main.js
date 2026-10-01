/**
 * GlobeLocation Creator Studio — Main Application Entry
 * Full-featured interactive studio and deterministic headless render player
 */
import { store } from './state.js';
import { GlobeEngine } from './cesium/viewer.js';
import { FramingGuides } from './ui/framingGuides.js';
import { StudioHeader } from './ui/header.js';
import { StudioSidebar } from './ui/sidebar.js';
import { StudioTimeline } from './ui/timeline.js';
import { ExportModal } from './ui/exportModal.js';
import { PRESETS } from './presets.js';
import { showToast } from './ui/toast.js';
import { exportVideo, captureSnapshot } from './recorder/videoExporter.js';

window.addEventListener('DOMContentLoaded', () => {
  const cesiumContainer = document.getElementById('cesium-container');
  const headerMount = document.getElementById('header-mount');
  const sidebarMount = document.getElementById('sidebar-mount');
  const timelineMount = document.getElementById('timeline-mount');

  // Check URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isRenderMode = urlParams.has('render') || urlParams.has('clean');
  const presetParam = urlParams.get('preset');
  const sceneParam = urlParams.get('scene');

  // Load custom scene if passed in query param
  if (sceneParam) {
    try {
      const decoded = decodeURIComponent(sceneParam);
      const parsed = JSON.parse(decoded);
      store.loadScene(parsed);
    } catch (e) {
      console.warn('Could not parse scene from URL param:', e);
    }
  } else if (presetParam) {
    const foundPreset = PRESETS.find((p) => p.id === presetParam);
    if (foundPreset) {
      store.loadScene(foundPreset);
    }
  }

  // Initialize Cesium Globe Engine
  const globeEngine = new GlobeEngine(cesiumContainer, () => {
    // Sync initial scene
    globeEngine.syncScene(store.scene);
    globeEngine.seek(store.scene, 0);

    // Initialize Framing Guides
    new FramingGuides(cesiumContainer, store);

    // Initialize Export Modal
    const exportModal = new ExportModal(store, globeEngine);

    let timelineInstance = null;

    // In clean/render mode, hide GUI chrome for headless screen recorders & OBS
    if (isRenderMode) {
      document.body.classList.add('render-mode');
      if (headerMount) headerMount.style.display = 'none';
      if (sidebarMount) sidebarMount.style.display = 'none';
      if (timelineMount) timelineMount.style.display = 'none';

      // Auto-play if requested
      if (urlParams.get('autoplay') === '1') {
        let startTime = performance.now();
        const duration = store.scene.format.durationSeconds || 8;
        const tick = (now) => {
          const elapsed = (now - startTime) / 1000;
          if (elapsed <= duration) {
            globeEngine.seek(store.scene, elapsed / duration);
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }
    } else {
      // Normal Full Studio Mode
      new StudioHeader(
        headerMount,
        store,
        globeEngine,
        () => exportModal.show('render'),
        () => exportModal.show('json')
      );

      new StudioSidebar(sidebarMount, store, globeEngine);
      timelineInstance = new StudioTimeline(timelineMount, store, globeEngine);

      // Welcome Toast
      setTimeout(() => {
        showToast('Welcome to GlobeLocation Studio! Choose a template or inspiration.', 'info', 4000);
      }, 600);
    }

    // Expose programmatic API on window for automated rendering / Puppeteer / testing
    window.__GLOBE_STUDIO__ = {
      store,
      globeEngine,
      timeline: timelineInstance,
      exportVideo: (options, onProgress) => exportVideo(globeEngine, store.scene, options, onProgress),
      captureSnapshot: (filename) => captureSnapshot(globeEngine, store.scene, filename),
      seek: (progress) => globeEngine.seek(store.scene, progress),
      loadPreset: (id) => {
        const p = PRESETS.find((item) => item.id === id);
        if (p) {
          store.loadScene(p);
          globeEngine.syncScene(store.scene);
          globeEngine.seek(store.scene, 0);
        }
      },
    };
  });
});
