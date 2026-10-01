/**
 * Video Render & Scene JSON / After Effects JSX Export Modal
 * Handles MP4/WebM video generation, After Effects .jsx camera tracking export,
 * scene definition file download/upload, and attribution manifest
 */
import { exportVideo } from '../recorder/videoExporter.js';
import {
  exportSceneAsJson,
  copySceneJsonToClipboard,
  readSceneFile,
  generateAfterEffectsJsx,
  exportAfterEffectsJsx,
} from '../recorder/sceneIo.js';
import { showToast } from './toast.js';

export class ExportModal {
  constructor(store, globeEngine) {
    this.store = store;
    this.globeEngine = globeEngine;
    this.activeTab = 'render'; // 'render' | 'ae-jsx' | 'json' | 'attribution'
    this.isRendering = false;
    this.renderProgress = 0;
    this.renderedResult = null;
    this.selectedFormat = 'mp4';

    this.element = document.createElement('div');
    this.element.className = 'studio-modal-backdrop hidden';
    document.body.appendChild(this.element);

    this.render();
  }

  show(defaultTab = 'render') {
    this.activeTab = defaultTab;
    this.isRendering = false;
    this.renderProgress = 0;
    this.renderedResult = null;
    this.element.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.element.classList.add('hidden');
  }

  render() {
    const scene = this.store.scene;
    const format = scene.format || {};
    const totalFrames = Math.round((format.durationSeconds || 8) * (format.fps || 30));

    this.element.innerHTML = `
      <div class="studio-modal-dialog">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-title-group">
            <h2 class="modal-title">Export & Production</h2>
            <span class="modal-subtitle">${scene.name || 'Untitled Video'}</span>
          </div>
          <button class="modal-close-btn" id="modal-close-x" title="Close">&times;</button>
        </div>

        <!-- Modal Navigation Tabs -->
        <div class="modal-tabs">
          <button class="modal-tab-btn ${this.activeTab === 'render' ? 'active' : ''}" data-tab="render">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            <span>Render Video</span>
          </button>
          <button class="modal-tab-btn ${this.activeTab === 'ae-jsx' ? 'active' : ''}" data-tab="ae-jsx">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>After Effects (.jsx)</span>
          </button>
          <button class="modal-tab-btn ${this.activeTab === 'json' ? 'active' : ''}" data-tab="json">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <span>Scene JSON</span>
          </button>
          <button class="modal-tab-btn ${this.activeTab === 'attribution' ? 'active' : ''}" data-tab="attribution">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Attribution & Rights</span>
          </button>
        </div>

        <!-- Modal Body Content -->
        <div class="modal-body">
          ${this.renderTabContent(scene, format, totalFrames)}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderTabContent(scene, format, totalFrames) {
    if (this.activeTab === 'render') {
      return `
        <div class="export-render-panel">
          <div class="specs-grid">
            <div class="spec-card">
              <span class="spec-label">Format / Ratio</span>
              <span class="spec-value font-mono">${format.aspectRatio} (${format.width}x${format.height})</span>
            </div>
            <div class="spec-card">
              <span class="spec-label">Duration & Frame Count</span>
              <span class="spec-value font-mono">${format.durationSeconds || 8}s • ${totalFrames} frames</span>
            </div>
            <div class="spec-card">
              <span class="spec-label">Motion Graphics & Audio</span>
              <span class="spec-value font-mono">3D Track Badge + Sound Design</span>
            </div>
            <div class="spec-card">
              <span class="spec-label">Target Bitrate</span>
              <span class="spec-value font-mono">16.0 Mbps (Broadcast High)</span>
            </div>
          </div>

          <div class="field-group mt-3">
            <label class="field-label">Video Format Container</label>
            <div class="format-choice-group">
              <label class="format-radio-card ${this.selectedFormat === 'mp4' ? 'active' : ''}">
                <input type="radio" name="export-format" value="mp4" ${this.selectedFormat === 'mp4' ? 'checked' : ''} />
                <div class="format-radio-text">
                  <span class="format-radio-title">MP4 Video (.mp4)</span>
                  <span class="format-radio-sub">H.264 / AAC • Universal (Instagram, TikTok, YouTube, QuickTime, Premiere, iOS)</span>
                </div>
              </label>
              <label class="format-radio-card ${this.selectedFormat === 'webm' ? 'active' : ''}">
                <input type="radio" name="export-format" value="webm" ${this.selectedFormat === 'webm' ? 'checked' : ''} />
                <div class="format-radio-text">
                  <span class="format-radio-title">WebM Video (.webm)</span>
                  <span class="format-radio-sub">VP9 / Opus • Modern open web format</span>
                </div>
              </label>
            </div>
          </div>

          ${
            this.isRendering
              ? `
            <div class="render-progress-card mt-4">
              <div class="progress-info-row">
                <span class="progress-status" id="render-status-text">Recording 3D Globe Animation...</span>
                <span class="progress-pct font-mono" id="render-pct-text">${this.renderProgress}%</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" id="modal-progress-bar" style="width: ${this.renderProgress}%;"></div>
              </div>
              <p class="progress-note">Please keep this browser window in focus while recording for maximum frame fidelity.</p>
            </div>
          `
              : this.renderedResult
                ? `
            <div class="render-complete-card mt-4">
              <div class="complete-icon">✓</div>
              <h3 class="complete-title">Video Rendered Successfully!</h3>
              <p class="complete-desc">Your video with 3D tracked badge, leader stalk, and supersonic entry sound has been exported at full ${format.width}x${format.height} resolution.</p>
              <div class="complete-actions">
                <button id="btn-re-download" class="primary-btn glow">Download Video Again</button>
                <button id="btn-render-new" class="secondary-btn">Render Another</button>
              </div>
            </div>
          `
                : `
            <div class="render-prompt-card mt-4">
              <div class="prompt-text">
                <h3>Ready to Render Video</h3>
                <p>The client-side engine will capture the 3D globe animation frame-by-frame, compositing After Effects-style 3D tracked badges, leader lines, ground pulse beacons, and supersonic atmospheric entry sound into an export-ready MP4/WebM video.</p>
              </div>
              <button id="btn-start-render" class="primary-btn glow large-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                <span>Start Video Render</span>
              </button>
            </div>
          `
          }
        </div>
      `;
    }

    if (this.activeTab === 'ae-jsx') {
      const jsxCode = generateAfterEffectsJsx(scene);
      return `
        <div class="json-panel">
          <p class="json-desc">Export 3D Camera tracking keyframes and 3D Null Objects for Adobe After Effects. Use <code>File &gt; Scripts &gt; Run Script File...</code> in After Effects to import the 3D camera trajectory and attach your custom motion graphics layers to the track points.</p>
          <div class="json-actions-bar">
            <button id="btn-download-jsx" class="primary-btn glow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download After Effects (.jsx)</span>
            </button>
            <button id="btn-copy-jsx" class="secondary-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy JSX Code</span>
            </button>
          </div>
          <pre class="json-code-box font-mono">${jsxCode}</pre>
        </div>
      `;
    }

    if (this.activeTab === 'json') {
      const jsonStr = JSON.stringify(scene, null, 2);
      return `
        <div class="json-panel">
          <p class="json-desc">Portable scene JSON format conforming to the standardized specification. Loadable into web, mobile, or cloud headless renderers.</p>
          <div class="json-actions-bar">
            <button id="btn-copy-json" class="secondary-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy to Clipboard</span>
            </button>
            <button id="btn-download-json" class="secondary-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download .scene.json</span>
            </button>
            <label class="secondary-btn file-upload-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Upload / Load File</span>
              <input type="file" id="file-upload-json" accept=".json" style="display: none;" />
            </label>
          </div>
          <pre class="json-code-box font-mono">${jsonStr}</pre>
        </div>
      `;
    }

    if (this.activeTab === 'attribution') {
      return `
        <div class="attribution-panel">
          <div class="attrib-section">
            <h4 class="attrib-title">Map Imagery Attribution</h4>
            <p class="attrib-body">
              <strong>Satellite Basemap:</strong> Powered by Esri. Sources: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, and the GIS User Community.<br>
              <strong>Vector / Street Basemap:</strong> © OpenStreetMap contributors under Open Database License (ODbL).
            </p>
          </div>

          <div class="attrib-section">
            <h4 class="attrib-title">Globe & Camera Engine</h4>
            <p class="attrib-body">
              Rendered via <strong>CesiumJS</strong> (Apache 2.0 License).<br>
              Deterministic scene camera and director architecture adapted for creator video production workflows.
            </p>
          </div>

          <div class="attrib-section">
            <h4 class="attrib-title">Production Licensing Guidelines</h4>
            <p class="attrib-body">
              This generator embeds required attribution credits automatically on exported video clips. For commercial television, OTT, or monetized enterprise broadcasts, ensure appropriate license terms with your commercial map imagery provider.
            </p>
          </div>
        </div>
      `;
    }

    return '';
  }

  bindEvents() {
    // Close modal
    this.element.querySelector('#modal-close-x')?.addEventListener('click', () => this.hide());
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.hide();
    });

    // Tab buttons
    this.element.querySelectorAll('.modal-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    // Format selection radios
    this.element.querySelectorAll('input[name="export-format"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.selectedFormat = e.target.value;
        this.render();
      });
    });

    // Start video render
    this.element.querySelector('#btn-start-render')?.addEventListener('click', async () => {
      this.isRendering = true;
      this.renderProgress = 0;
      this.render();

      try {
        const result = await exportVideo(
          this.globeEngine,
          this.store.scene,
          { format: this.selectedFormat },
          ({ percent, frame, totalFrames }) => {
            this.renderProgress = percent;
            const bar = this.element.querySelector('#modal-progress-bar');
            const pctText = this.element.querySelector('#render-pct-text');
            const statusText = this.element.querySelector('#render-status-text');

            if (bar) bar.style.width = `${percent}%`;
            if (pctText) pctText.textContent = `${percent}%`;
            if (statusText) statusText.textContent = `Capturing Frame ${frame}/${totalFrames}...`;
          }
        );

        this.isRendering = false;
        this.renderedResult = result;
        this.render();
        showToast('Video export completed & downloaded!', 'success');
      } catch (err) {
        console.error('Export failed:', err);
        this.isRendering = false;
        this.render();
        showToast('Export failed: ' + err.message, 'error');
      }
    });

    // Re-download button
    this.element.querySelector('#btn-re-download')?.addEventListener('click', () => {
      if (this.renderedResult) {
        const a = document.createElement('a');
        a.href = this.renderedResult.url;
        a.download = `video-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });

    // Render new button
    this.element.querySelector('#btn-render-new')?.addEventListener('click', () => {
      this.renderedResult = null;
      this.render();
    });

    // After Effects JSX Download & Copy
    this.element.querySelector('#btn-download-jsx')?.addEventListener('click', () => {
      exportAfterEffectsJsx(this.store.scene);
      showToast('Downloaded After Effects 3D Camera script (.jsx)', 'success');
    });

    this.element.querySelector('#btn-copy-jsx')?.addEventListener('click', async () => {
      const code = generateAfterEffectsJsx(this.store.scene);
      await navigator.clipboard.writeText(code);
      showToast('After Effects JSX copied to clipboard!', 'success');
    });

    // Copy JSON
    this.element.querySelector('#btn-copy-json')?.addEventListener('click', async () => {
      await copySceneJsonToClipboard(this.store.scene);
      showToast('Scene JSON copied to clipboard!', 'success');
    });

    // Download JSON
    this.element.querySelector('#btn-download-json')?.addEventListener('click', () => {
      exportSceneAsJson(this.store.scene);
      showToast('Downloaded .scene.json file', 'success');
    });

    // Upload JSON file
    const fileIn = this.element.querySelector('#file-upload-json');
    fileIn?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const parsed = await readSceneFile(file);
        this.store.loadScene(parsed);
        this.globeEngine.syncScene(this.store.scene);
        this.globeEngine.seek(this.store.scene, 0);
        showToast(`Loaded scene: ${parsed.name || file.name}`, 'success');
        this.render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}
