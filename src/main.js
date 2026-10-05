/**
 * GlobeLocation Creator Studio — Main Application Entry
 * Full-featured interactive studio and deterministic headless render player
 */
import { store } from './state.js';
import { GlobeEngine } from './cesium/viewer.js';
import { FramingGuides } from './ui/framingGuides.js';
import { GroundPhotoOverlay } from './ui/groundPhotoOverlay.js';
import { StudioHeader } from './ui/header.js';
import { StudioSidebar } from './ui/sidebar.js';
import { StudioTimeline } from './ui/timeline.js';
import { ExportModal } from './ui/exportModal.js';
import { PRESETS } from './presets.js';
import { showToast } from './ui/toast.js';
import { exportVideo, captureSnapshot, renderStills } from './recorder/videoExporter.js';
import { VideoAgentEngine } from './agent/videoAgentEngine.js';
import { AIAgentModal } from './agent/aiAgentModal.js';

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
  let globeEngineInstance = null;
  globeEngineInstance = new GlobeEngine(cesiumContainer, (engine) => {
    // Sync initial scene
    engine.syncScene(store.scene);
    engine.seek(store.scene, 0);

    // Initialize Framing Guides & Ground Photo Overlay
    new FramingGuides(cesiumContainer, store);
    new GroundPhotoOverlay(cesiumContainer, store);

    // Initialize Export Modal & Autonomous Video Agent
    const exportModal = new ExportModal(store, engine);
    const videoAgent = new VideoAgentEngine(store, engine);
    const agentModal = new AIAgentModal(store, engine, videoAgent);

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
            engine.seek(store.scene, elapsed / duration);
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
        engine,
        () => exportModal.show('render'),
        () => exportModal.show('json'),
        () => exportModal.show('ae-jsx'),
        () => agentModal.show()
      );

      new StudioSidebar(sidebarMount, store, engine);
      timelineInstance = new StudioTimeline(timelineMount, store, engine);

      // Welcome Toast
      setTimeout(() => {
        showToast('Welcome to GlobeLocation Studio! Choose a template, or click AI Director ✨ to auto-create videos.', 'info', 4500);
      }, 600);
    }

    // Expose programmatic API on window for automated rendering / Puppeteer / testing
    window.__GLOBE_STUDIO__ = {
      store,
      globeEngine: engine,
      timeline: timelineInstance,
      agent: videoAgent,
      agentModal,
      openAgent: () => agentModal.show(),
      exportVideo: (options, onProgress) => exportVideo(engine, store.scene, options, onProgress),
      renderStills: (fractions) => renderStills(engine, store.scene, fractions),
      captureSnapshot: (filename) => captureSnapshot(engine, store.scene, filename),
      seek: (progress) => engine.seek(store.scene, progress),
      loadPreset: (id) => {
        const p = PRESETS.find((item) => item.id === id);
        if (p) {
          store.loadScene(p);
          engine.syncScene(store.scene);
          engine.seek(store.scene, 0);
        }
      },
    };
  });
});
