/**
 * Top Navigation & Studio Header Component
 */
import { PRESETS } from '../presets.js';
import { ASPECT_RATIOS } from '../state.js';
import { showToast } from './toast.js';
import { captureSnapshot } from '../recorder/videoExporter.js';

export class StudioHeader {
  constructor(containerElement, store, globeEngine, onOpenExport, onOpenJson) {
    this.container = containerElement;
    this.store = store;
    this.globeEngine = globeEngine;
    this.onOpenExport = onOpenExport;
    this.onOpenJson = onOpenJson;

    this.element = document.createElement('header');
    this.element.className = 'studio-header';
    this.container.appendChild(this.element);

    this.render();
    this.store.subscribe((state, changeType) => {
      if (['format', 'scene', 'scene-loaded'].includes(changeType)) {
        this.updateActiveFormat();
      }
    });
  }

  render() {
    const scene = this.store.scene;
    const currentAspect = scene.format?.aspectRatio || '16:9';

    this.element.innerHTML = `
      <div class="header-left">
        <div class="brand-logo">
          <div class="logo-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-title">GlobeLocation</span>
            <span class="brand-badge">STUDIO</span>
          </div>
        </div>

        <!-- Preset Quick Bar -->
        <div class="preset-selector-group">
          <span class="selector-label">Inspirations:</span>
          <select id="preset-dropdown" class="preset-select">
            <option value="" disabled selected>Select a Curated Location...</option>
            ${PRESETS.map((p) => `<option value="${p.id}">${p.thumbnail} ${p.name} (${p.category})</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="header-center">
        <!-- Aspect Ratio Controls -->
        <div class="aspect-switch-group">
          ${Object.entries(ASPECT_RATIOS)
            .map(
              ([key, val]) => `
            <button class="aspect-btn ${key === currentAspect ? 'active' : ''}" data-aspect="${key}" title="${val.label}">
              <span class="aspect-icon">${key === '16:9' ? '▬' : key === '9:16' ? '▮' : '■'}</span>
              <span>${key}</span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="header-right">
        <!-- Toggle Guides -->
        <button id="btn-toggle-guides" class="tool-btn ${scene.guides?.show ? 'active' : ''}" title="Toggle Framing Guides & Safe Areas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
          </svg>
          <span>Guides</span>
        </button>

        <!-- Snapshot Button -->
        <button id="btn-snapshot" class="tool-btn" title="Capture High-Res PNG Still Frame">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <span>Snapshot</span>
        </button>

        <!-- Scene JSON Button -->
        <button id="btn-scene-json" class="tool-btn" title="Import / Export Scene JSON Definition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span>Scene JSON</span>
        </button>

        <!-- Render & Export Primary Button -->
        <button id="btn-render-video" class="primary-btn glow" title="Render MP4/WebM Video Clip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <span>Render Video</span>
        </button>
      </div>
    `;

    this.bindEvents();
  }

  updateActiveFormat() {
    const currentAspect = this.store.scene.format?.aspectRatio || '16:9';
    this.element.querySelectorAll('.aspect-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.aspect === currentAspect);
    });
    const guidesBtn = this.element.querySelector('#btn-toggle-guides');
    if (guidesBtn) {
      guidesBtn.classList.toggle('active', !!this.store.scene.guides?.show);
    }
  }

  bindEvents() {
    // Preset dropdown
    const presetSelect = this.element.querySelector('#preset-dropdown');
    presetSelect?.addEventListener('change', (e) => {
      const presetId = e.target.value;
      const preset = PRESETS.find((p) => p.id === presetId);
      if (preset) {
        this.store.loadScene(preset);
        this.globeEngine.syncScene(this.store.scene);
        this.globeEngine.seek(this.store.scene, 0);
        showToast(`Loaded preset: ${preset.name}`, 'success');
      }
    });

    // Aspect buttons
    this.element.querySelectorAll('.aspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const aspect = btn.dataset.aspect;
        this.store.updateFormat(aspect);
        this.updateActiveFormat();
        showToast(`Framing set to ${aspect}`, 'info');
      });
    });

    // Toggle guides
    this.element.querySelector('#btn-toggle-guides')?.addEventListener('click', () => {
      const current = this.store.scene.guides?.show || false;
      this.store.updateScene({
        guides: { ...this.store.scene.guides, show: !current },
      });
      this.updateActiveFormat();
    });

    // Snapshot button
    this.element.querySelector('#btn-snapshot')?.addEventListener('click', () => {
      const safeName = (this.store.scene.name || 'location-snapshot')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      captureSnapshot(this.globeEngine, this.store.scene, `${safeName}.png`);
      showToast('High-Res PNG Snapshot downloaded!', 'success');
    });

    // Scene JSON button
    this.element.querySelector('#btn-scene-json')?.addEventListener('click', () => {
      if (this.onOpenJson) this.onOpenJson();
    });

    // Render video button
    this.element.querySelector('#btn-render-video')?.addEventListener('click', () => {
      if (this.onOpenExport) this.onOpenExport();
    });
  }
}
