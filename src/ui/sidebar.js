/**
 * Creator Studio Left Sidebar / Inspector
 * Organizes Location, Templates, Style Themes, Overlays, and Motion controls
 */
import { TEMPLATES, buildCameraForTemplate } from '../templates.js';
import { VISUAL_THEMES } from '../state.js';
import { searchLocations, parseCoordinates } from '../search/geocoder.js';
import { parseRouteFile } from '../search/routeParser.js';
import { showToast } from './toast.js';

export class StudioSidebar {
  constructor(containerElement, store, globeEngine) {
    this.container = containerElement;
    this.store = store;
    this.globeEngine = globeEngine;

    this.activeTab = 'templates'; // 'templates' | 'location' | 'theme' | 'motion'
    this.searchDebounceTimer = null;
    this.currentSearchAbort = null;

    this.element = document.createElement('aside');
    this.element.className = 'studio-sidebar';
    this.container.appendChild(this.element);

    this.render();
    this.store.subscribe((state, changeType) => {
      if (['scene', 'scene-loaded', 'scene-reset', 'location'].includes(changeType)) {
        this.render();
      }
    });
  }

  render() {
    const scene = this.store.scene;

    this.element.innerHTML = `
      <!-- Tab Navigation -->
      <nav class="sidebar-tabs">
        <button class="tab-btn ${this.activeTab === 'templates' ? 'active' : ''}" data-tab="templates">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Templates</span>
        </button>
        <button class="tab-btn ${this.activeTab === 'location' ? 'active' : ''}" data-tab="location">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>Location</span>
        </button>
        <button class="tab-btn ${this.activeTab === 'theme' ? 'active' : ''}" data-tab="theme">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a7 7 0 0 0 0 14v6"></path>
          </svg>
          <span>Style</span>
        </button>
        <button class="tab-btn ${this.activeTab === 'motion' ? 'active' : ''}" data-tab="motion">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>Motion</span>
        </button>
      </nav>

      <!-- Tab Content Area -->
      <div class="sidebar-content">
        ${this.renderActiveTabContent()}
      </div>
    `;

    this.bindEvents();
  }

  renderActiveTabContent() {
    switch (this.activeTab) {
      case 'templates':
        return this.renderTemplatesTab();
      case 'location':
        return this.renderLocationTab();
      case 'theme':
        return this.renderThemeTab();
      case 'motion':
        return this.renderMotionTab();
      default:
        return '';
    }
  }

  renderTemplatesTab() {
    const currentTemplate = this.store.scene.template;

    return `
      <div class="panel-section">
        <div class="section-header">
          <h3 class="section-title">Video Templates</h3>
          <span class="section-hint">Select a cinematic storytelling pattern</span>
        </div>

        <div class="template-grid">
          ${TEMPLATES.map((tmpl) => {
            const isSelected = tmpl.id === currentTemplate;
            return `
              <div class="template-card ${isSelected ? 'selected' : ''}" data-template-id="${tmpl.id}">
                <div class="card-top">
                  <span class="tmpl-badge">${tmpl.badge}</span>
                  <span class="tmpl-duration">${tmpl.idealDuration}s</span>
                </div>
                <h4 class="tmpl-title">${tmpl.name}</h4>
                <p class="tmpl-desc">${tmpl.description}</p>
                <div class="tmpl-footer">
                  <span class="tmpl-inputs">📌 ${tmpl.inputsNeeded}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderLocationTab() {
    const scene = this.store.scene;
    const loc = scene.location || {};
    const mainPin = scene.overlays?.find((o) => o.type === 'pin') || {};
    const waypoints = scene.camera?.waypoints || [];

    return `
      <div class="panel-section">
        <div class="section-header">
          <h3 class="section-title">Location Search</h3>
          <span class="section-hint">Search places, landmarks, or paste coordinates</span>
        </div>

        <div class="search-input-wrap">
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              id="geo-search-input"
              class="studio-input"
              placeholder="e.g. Kyoto, Japan or 35.6895, 139.6917"
              value=""
              autocomplete="off"
            />
          </div>
          <div id="search-suggestions" class="search-suggestions-dropdown hidden"></div>
        </div>

        <!-- Target Destination Form -->
        <div class="field-group mt-3">
          <label class="field-label">Place Name</label>
          <input type="text" id="input-place-name" class="studio-input" value="${loc.name || ''}" placeholder="Place Name" />
        </div>

        <div class="field-group">
          <label class="field-label">Subtitle / Region</label>
          <input type="text" id="input-place-desc" class="studio-input" value="${loc.description || ''}" placeholder="Region, Country or Context" />
        </div>

        <!-- Coordinates Grid -->
        <div class="coords-grid">
          <div class="coord-item">
            <label class="coord-label">Latitude</label>
            <input type="number" step="0.0001" id="input-lat" class="studio-input font-mono" value="${(Number(loc.latitude) || 0).toFixed(4)}" />
          </div>
          <div class="coord-item">
            <label class="coord-label">Longitude</label>
            <input type="number" step="0.0001" id="input-lon" class="studio-input font-mono" value="${(Number(loc.longitude) || 0).toFixed(4)}" />
          </div>
          <div class="coord-item">
            <label class="coord-label">Altitude (m)</label>
            <input type="number" step="100" id="input-alt" class="studio-input font-mono" value="${Math.round(Number(loc.height) || 2200)}" />
          </div>
        </div>

        <!-- 3D Pin Style -->
        <div class="section-divider"></div>
        <div class="section-header">
          <h4 class="sub-title">3D Pin Overlay</h4>
        </div>

        <div class="pin-controls-row">
          <label class="field-label">Pin Accent</label>
          <div class="color-palette">
            ${['#f59e0b', '#06b6d4', '#10b981', '#ef4444', '#a855f7', '#ffffff']
              .map(
                (color) => `
              <button class="color-dot ${mainPin.color === color ? 'active' : ''}" data-color="${color}" style="background: ${color};"></button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Waypoints & Route Flyover Controls -->
        <div class="section-divider"></div>
        <div class="section-header">
          <div class="flex-between">
            <h4 class="sub-title">Route Flyover (${waypoints.length} waypoints)</h4>
            <label class="route-upload-label" title="Import GPX or GeoJSON Route">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Import GPX / GeoJSON</span>
              <input type="file" id="file-route-upload" accept=".gpx,.geojson,.json" style="display: none;" />
            </label>
          </div>
          <span class="section-hint">Import trails, drives, or flights, or choose an inspiration preset</span>
        </div>

        ${
          waypoints.length > 0
            ? `
          <div class="waypoint-list">
            ${waypoints
              .map(
                (wp, idx) => `
              <div class="waypoint-item">
                <span class="wp-num">${idx + 1}</span>
                <span class="wp-name" title="${wp.name || ''}">${wp.name || `Waypoint ${idx + 1}`}</span>
                <span class="wp-coords font-mono">${(wp.latitude || 0).toFixed(3)}°, ${(wp.longitude || 0).toFixed(3)}°</span>
                <button class="wp-del-btn" data-wp-idx="${idx}" title="Delete waypoint">&times;</button>
              </div>
            `
              )
              .join('')}
          </div>
          <button id="btn-clear-route" class="secondary-btn btn-sm mt-2">Clear Route</button>
        `
            : `
          <div class="empty-route-box">
            <p class="empty-route-tip">No route loaded. Upload a <code>.gpx</code> / <code>.geojson</code> file or try the <strong>Mount Everest Expedition</strong> or <strong>Paris & Seine</strong> presets.</p>
          </div>
        `
        }
      </div>
    `;
  }

  renderThemeTab() {
    const scene = this.store.scene;
    const currentTheme = scene.theme || 'documentary';

    return `
      <div class="panel-section">
        <div class="section-header">
          <h3 class="section-title">Visual Themes</h3>
          <span class="section-hint">Select globe cartography & atmosphere grading</span>
        </div>

        <div class="theme-list">
          ${Object.entries(VISUAL_THEMES)
            .map(([key, val]) => {
              const isSelected = key === currentTheme;
              return `
              <div class="theme-card ${isSelected ? 'selected' : ''}" data-theme-key="${key}">
                <div class="theme-indicator" style="background: ${val.accentColor};"></div>
                <div class="theme-info">
                  <h4 class="theme-name">${val.name}</h4>
                  <p class="theme-desc">${val.description}</p>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>

        <!-- Audio Ambience Settings -->
        <div class="section-divider"></div>
        <div class="section-header">
          <h3 class="section-title">Audio Ambience</h3>
          <span class="section-hint">Procedural atmospheric drone for exported video</span>
        </div>

        <div class="audio-control-card">
          <div class="toggle-row">
            <span class="toggle-label">Enable Cinematic Drone</span>
            <input type="checkbox" id="check-audio-enabled" ${scene.audio?.enabled ? 'checked' : ''} class="studio-switch" />
          </div>
          <div class="slider-group mt-2">
            <div class="slider-header">
              <label class="field-label">Drone Volume</label>
              <span class="slider-val" id="audio-vol-val">${Math.round((scene.audio?.volume || 0.6) * 100)}%</span>
            </div>
            <input type="range" id="slider-audio-vol" min="0.1" max="1" step="0.05" value="${scene.audio?.volume || 0.6}" class="studio-slider" />
          </div>
        </div>
      </div>
    `;
  }

  renderMotionTab() {
    const scene = this.store.scene;
    const camera = scene.camera || {};
    const titleEvent = scene.timeline?.find((t) => t.action === 'showTitle') || {};

    return `
      <div class="panel-section">
        <div class="section-header">
          <h3 class="section-title">Camera & Motion</h3>
          <span class="section-hint">Fine-tune trajectory interpolation and easing</span>
        </div>

        <div class="field-group">
          <label class="field-label">Camera Easing</label>
          <select id="select-easing" class="studio-select">
            <option value="cubicInOut" ${camera.easing === 'cubicInOut' ? 'selected' : ''}>Smooth Ease In & Out (Cubic)</option>
            <option value="linear" ${camera.easing === 'linear' ? 'selected' : ''}>Steady Drone (Linear Velocity)</option>
            <option value="exponential" ${camera.easing === 'exponential' ? 'selected' : ''}>Dramatic Dive (Exponential)</option>
            <option value="slowIn" ${camera.easing === 'slowIn' ? 'selected' : ''}>Gentle Start (Slow In)</option>
            <option value="slowOut" ${camera.easing === 'slowOut' ? 'selected' : ''}>Gentle Deceleration (Slow Out)</option>
          </select>
        </div>

        <!-- Title Card Overlays -->
        <div class="section-divider"></div>
        <div class="section-header">
          <h3 class="section-title">Title Reveal Card</h3>
          <span class="section-hint">Animated motion graphics card for explainer videos</span>
        </div>

        <div class="field-group">
          <label class="field-label">Headline Text</label>
          <input type="text" id="input-title-text" class="studio-input" value="${titleEvent.text || scene.name || ''}" placeholder="Main Headline" />
        </div>

        <div class="field-group">
          <label class="field-label">Subline Text</label>
          <input type="text" id="input-subtext" class="studio-input" value="${titleEvent.subtext || ''}" placeholder="Secondary Explainer / Geography" />
        </div>

        <div class="field-group">
          <label class="field-label">Card Position</label>
          <div class="btn-group-row">
            ${['lower-third', 'center', 'top-banner']
              .map(
                (pos) => `
              <button class="opt-btn ${titleEvent.position === pos ? 'active' : ''}" data-position="${pos}">
                ${pos.replace('-', ' ').toUpperCase()}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="slider-group">
          <div class="slider-header">
            <label class="field-label">Reveal Timestamp</label>
            <span class="slider-val" id="title-time-val">${Number(titleEvent.at || 4.5).toFixed(1)}s</span>
          </div>
          <input
            type="range"
            id="slider-title-time"
            min="0.5"
            max="${scene.format?.durationSeconds || 8}"
            step="0.1"
            value="${titleEvent.at || 4.5}"
            class="studio-slider"
          />
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Tab switching
    this.element.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    // Template selection
    this.element.querySelectorAll('.template-card').forEach((card) => {
      card.addEventListener('click', () => {
        const templateId = card.dataset.templateId;
        const newCamera = buildCameraForTemplate(templateId, this.store.scene.location, this.store.scene.camera);
        const tmplObj = TEMPLATES.find((t) => t.id === templateId);

        this.store.updateScene({
          template: templateId,
          camera: newCamera,
          format: {
            ...this.store.scene.format,
            durationSeconds: tmplObj?.idealDuration || this.store.scene.format.durationSeconds,
          },
        });

        this.globeEngine.syncScene(this.store.scene);
        this.globeEngine.seek(this.store.scene, 0);
        showToast(`Applied ${tmplObj?.name || templateId} template`, 'success');
      });
    });

    // Theme selection
    this.element.querySelectorAll('.theme-card').forEach((card) => {
      card.addEventListener('click', () => {
        const themeKey = card.dataset.themeKey;
        this.store.updateScene({ theme: themeKey });
        this.globeEngine.applyTheme(themeKey);
        showToast(`Theme switched to ${VISUAL_THEMES[themeKey]?.name}`, 'info');
      });
    });

    // Audio controls
    const audioCheck = this.element.querySelector('#check-audio-enabled');
    audioCheck?.addEventListener('change', (e) => {
      this.store.updateScene({
        audio: { ...this.store.scene.audio, enabled: e.target.checked },
      });
    });

    const audioVol = this.element.querySelector('#slider-audio-vol');
    audioVol?.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.store.updateScene({
        audio: { ...this.store.scene.audio, volume: vol },
      });
      const lbl = this.element.querySelector('#audio-vol-val');
      if (lbl) lbl.textContent = `${Math.round(vol * 100)}%`;
    });

    // Geocoder Search Input with debouncing
    const searchInput = this.element.querySelector('#geo-search-input');
    const suggestionsBox = this.element.querySelector('#search-suggestions');

    if (searchInput && suggestionsBox) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchDebounceTimer);
        const query = e.target.value.trim();

        if (query.length < 2) {
          suggestionsBox.classList.add('hidden');
          return;
        }

        this.searchDebounceTimer = setTimeout(async () => {
          if (this.currentSearchAbort) this.currentSearchAbort.abort();
          this.currentSearchAbort = new AbortController();

          try {
            const results = await searchLocations(query, { signal: this.currentSearchAbort.signal });
            if (results.length > 0) {
              suggestionsBox.innerHTML = results
                .map(
                  (res, idx) => `
                <div class="suggestion-item" data-idx="${idx}">
                  <span class="sugg-name">${res.name}</span>
                  <span class="sugg-desc">${res.description}</span>
                </div>
              `
                )
                .join('');
              suggestionsBox.classList.remove('hidden');

              // Click handler on suggestions
              suggestionsBox.querySelectorAll('.suggestion-item').forEach((item) => {
                item.addEventListener('click', () => {
                  const selected = results[Number(item.dataset.idx)];
                  if (selected) {
                    this.applySelectedLocation(selected);
                    suggestionsBox.classList.add('hidden');
                    searchInput.value = selected.name;
                  }
                });
              });
            } else {
              suggestionsBox.innerHTML = '<div class="suggestion-empty">No matching places found</div>';
              suggestionsBox.classList.remove('hidden');
            }
          } catch (err) {
            console.error(err);
          }
        }, 300);
      });
    }

    // Place Name & Description edit
    this.element.querySelector('#input-place-name')?.addEventListener('change', (e) => {
      this.store.updateLocation({ name: e.target.value });
      this.globeEngine.syncScene(this.store.scene);
    });

    this.element.querySelector('#input-place-desc')?.addEventListener('change', (e) => {
      this.store.updateLocation({ description: e.target.value });
    });

    // Manual Lat / Lon / Alt inputs
    const latIn = this.element.querySelector('#input-lat');
    const lonIn = this.element.querySelector('#input-lon');
    const altIn = this.element.querySelector('#input-alt');

    const handleCoordsChange = () => {
      const lat = parseFloat(latIn?.value) || 0;
      const lon = parseFloat(lonIn?.value) || 0;
      const alt = parseFloat(altIn?.value) || 2000;

      this.store.updateLocation({ latitude: lat, longitude: lon, height: alt });
      const newCamera = buildCameraForTemplate(this.store.scene.template, { latitude: lat, longitude: lon, height: alt });
      this.store.updateCamera(newCamera);
      this.globeEngine.syncScene(this.store.scene);
      this.globeEngine.seek(this.store.scene, 0);
    };

    latIn?.addEventListener('change', handleCoordsChange);
    lonIn?.addEventListener('change', handleCoordsChange);
    altIn?.addEventListener('change', handleCoordsChange);

    // Pin Color Palette
    this.element.querySelectorAll('.color-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const color = dot.dataset.color;
        const mainPin = this.store.scene.overlays.find((o) => o.type === 'pin');
        if (mainPin) {
          mainPin.color = color;
          this.store.notify('overlays');
          this.globeEngine.syncScene(this.store.scene);
          this.render();
        }
      });
    });

    // Easing Selector
    this.element.querySelector('#select-easing')?.addEventListener('change', (e) => {
      this.store.updateCamera({ easing: e.target.value });
      showToast(`Motion easing: ${e.target.value}`, 'info');
    });

    // Title Card Events
    this.element.querySelector('#input-title-text')?.addEventListener('input', (e) => {
      const titleEvt = this.store.scene.timeline.find((t) => t.action === 'showTitle');
      if (titleEvt) titleEvt.text = e.target.value;
    });

    this.element.querySelector('#input-subtext')?.addEventListener('input', (e) => {
      const titleEvt = this.store.scene.timeline.find((t) => t.action === 'showTitle');
      if (titleEvt) titleEvt.subtext = e.target.value;
    });

    this.element.querySelectorAll('.opt-btn[data-position]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pos = btn.dataset.position;
        const titleEvt = this.store.scene.timeline.find((t) => t.action === 'showTitle');
        if (titleEvt) titleEvt.position = pos;
        this.render();
      });
    });

    this.element.querySelector('#slider-title-time')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      const titleEvt = this.store.scene.timeline.find((t) => t.action === 'showTitle');
      if (titleEvt) titleEvt.at = val;
      const lbl = this.element.querySelector('#title-time-val');
      if (lbl) lbl.textContent = `${val.toFixed(1)}s`;
    });

    // GPX / GeoJSON Route Upload
    const routeFileInput = this.element.querySelector('#file-route-upload');
    routeFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const waypoints = await parseRouteFile(file);
        const first = waypoints[0];
        const last = waypoints[waypoints.length - 1];

        this.store.updateScene({
          template: 'route-flyover',
          camera: {
            ...this.store.scene.camera,
            start: {
              longitude: first.longitude,
              latitude: first.latitude,
              height: first.height || 2000,
              heading: 45,
              pitch: -28,
              roll: 0,
            },
            end: {
              longitude: last.longitude,
              latitude: last.latitude,
              height: last.height || 1800,
              heading: 65,
              pitch: -32,
              roll: 0,
            },
            easing: 'linear',
            waypoints,
          },
          location: {
            ...this.store.scene.location,
            name: file.name.replace(/\.[^/.]+$/, ''),
            latitude: first.latitude,
            longitude: first.longitude,
          },
        });

        this.globeEngine.syncScene(this.store.scene);
        this.globeEngine.seek(this.store.scene, 0);
        showToast(`Imported ${waypoints.length} route trackpoints from ${file.name}`, 'success');
        this.render();
      } catch (err) {
        showToast(`Route import failed: ${err.message}`, 'error');
      }
    });

    // Clear Route
    this.element.querySelector('#btn-clear-route')?.addEventListener('click', () => {
      this.store.updateCamera({ waypoints: [] });
      this.globeEngine.syncScene(this.store.scene);
      showToast('Route cleared', 'info');
      this.render();
    });

    // Delete single waypoint
    this.element.querySelectorAll('.wp-del-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.wpIdx, 10);
        const wps = [...(this.store.scene.camera.waypoints || [])];
        if (idx >= 0 && idx < wps.length) {
          wps.splice(idx, 1);
          this.store.updateCamera({ waypoints: wps });
          this.globeEngine.syncScene(this.store.scene);
          this.render();
        }
      });
    });
  }

  applySelectedLocation(loc) {
    this.store.updateLocation(loc);
    const newCamera = buildCameraForTemplate(this.store.scene.template, loc, this.store.scene.camera);
    this.store.updateCamera(newCamera);
    this.globeEngine.syncScene(this.store.scene);
    this.globeEngine.seek(this.store.scene, 0);
    showToast(`Navigated to ${loc.name}`, 'success');
  }
}
