/**
 * Cinematic Bottom Timeline Controller & Scrubber Component
 * Supports 60fps real-time camera playback, scrubbing, loop toggle, and keyframe markers
 */
import { ambience } from '../audio/ambience.js';

export class StudioTimeline {
  constructor(containerElement, store, globeEngine) {
    this.container = containerElement;
    this.store = store;
    this.globeEngine = globeEngine;

    this.rafId = null;
    this.lastFrameTime = 0;

    this.element = document.createElement('div');
    this.element.className = 'studio-timeline-dock';
    this.container.appendChild(this.element);

    this.render();
    this.bindEvents();
    this.bindKeyboard();

    this.store.subscribe((state, changeType) => {
      if (['scene', 'scene-loaded', 'scene-reset', 'format'].includes(changeType)) {
        this.updateLabels();
      }
    });
  }

  render() {
    const scene = this.store.scene;
    const duration = scene.format?.durationSeconds || 8;
    const fps = scene.format?.fps || 30;

    this.element.innerHTML = `
      <div class="timeline-bar">
        <!-- Play / Pause Button -->
        <button id="btn-play-pause" class="tl-btn play-btn" title="Play / Pause (Space)">
          <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <svg class="pause-icon hidden" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>

        <!-- Time Readout -->
        <div class="time-readout font-mono">
          <span id="readout-current">0.0s</span>
          <span class="readout-sep">/</span>
          <span id="readout-duration">${duration.toFixed(1)}s</span>
        </div>

        <!-- Scrubber Track & Markers -->
        <div class="scrubber-track-wrap">
          <div class="timeline-markers-container" id="timeline-markers">
            ${this.renderMarkers()}
          </div>
          <div class="scrubber-track" id="scrubber-track">
            <div class="scrubber-progress" id="scrubber-progress" style="width: 0%;"></div>
            <div class="scrubber-head" id="scrubber-head" style="left: 0%;"></div>
          </div>
        </div>

        <!-- Duration Quick Stepper -->
        <div class="duration-controls">
          <span class="tl-label">Duration:</span>
          <select id="select-duration" class="tl-select font-mono">
            ${[4, 6, 8, 10, 12, 15, 20].map((d) => `<option value="${d}" ${d === duration ? 'selected' : ''}>${d}s</option>`).join('')}
          </select>
        </div>

        <!-- FPS Selector -->
        <div class="fps-controls">
          <span class="tl-label">FPS:</span>
          <select id="select-fps" class="tl-select font-mono">
            <option value="24" ${fps === 24 ? 'selected' : ''}>24</option>
            <option value="30" ${fps === 30 ? 'selected' : ''}>30</option>
            <option value="60" ${fps === 60 ? 'selected' : ''}>60</option>
          </select>
        </div>

        <!-- Loop Toggle -->
        <button id="btn-loop" class="tl-btn ${this.store.playback.loop ? 'active' : ''}" title="Toggle Seamless Loop">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          </svg>
        </button>
      </div>
    `;
  }

  renderMarkers() {
    const scene = this.store.scene;
    const duration = scene.format?.durationSeconds || 8;
    const timeline = scene.timeline || [];

    return timeline
      .map((ev) => {
        const at = Math.max(0, Math.min(duration, Number(ev.at) || 0));
        const pct = (at / duration) * 100;
        return `
        <div class="timeline-marker" style="left: ${pct}%;" title="${ev.action}: ${ev.text || ''} (${at.toFixed(1)}s)">
          <div class="marker-dot"></div>
        </div>
      `;
      })
      .join('');
  }

  updateLabels() {
    const scene = this.store.scene;
    const durLbl = this.element.querySelector('#readout-duration');
    if (durLbl) durLbl.textContent = `${(scene.format?.durationSeconds || 8).toFixed(1)}s`;

    const markersCont = this.element.querySelector('#timeline-markers');
    if (markersCont) markersCont.innerHTML = this.renderMarkers();

    const durSelect = this.element.querySelector('#select-duration');
    if (durSelect) durSelect.value = String(scene.format?.durationSeconds || 8);
  }

  bindEvents() {
    const playBtn = this.element.querySelector('#btn-play-pause');
    const playIcon = this.element.querySelector('.play-icon');
    const pauseIcon = this.element.querySelector('.pause-icon');

    const togglePlay = () => {
      if (this.store.playback.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    };

    playBtn?.addEventListener('click', togglePlay);

    // Loop toggle
    const loopBtn = this.element.querySelector('#btn-loop');
    loopBtn?.addEventListener('click', () => {
      const loop = !this.store.playback.loop;
      this.store.setPlayback({ loop });
      loopBtn.classList.toggle('active', loop);
    });

    // Duration selector
    const durSelect = this.element.querySelector('#select-duration');
    durSelect?.addEventListener('change', (e) => {
      const dur = parseFloat(e.target.value);
      this.store.updateScene({
        format: { ...this.store.scene.format, durationSeconds: dur },
      });
      this.updateLabels();
    });

    // FPS selector
    const fpsSelect = this.element.querySelector('#select-fps');
    fpsSelect?.addEventListener('change', (e) => {
      const fps = parseInt(e.target.value, 10);
      this.store.updateScene({
        format: { ...this.store.scene.format, fps },
      });
    });

    // Scrubber click & drag
    const trackWrap = this.element.querySelector('.scrubber-track-wrap');
    let isDragging = false;

    const handleScrub = (e) => {
      const rect = trackWrap.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

      const duration = this.store.scene.format?.durationSeconds || 8;
      const currentTime = pct * duration;

      this.store.setPlayback({
        currentTime,
        progress: pct,
        isScrubbing: true,
      });

      this.updateUI(pct, currentTime);
      this.globeEngine.seek(this.store.scene, pct);
    };

    trackWrap?.addEventListener('mousedown', (e) => {
      isDragging = true;
      if (this.store.playback.isPlaying) this.pause();
      handleScrub(e);

      const onMouseMove = (ev) => {
        if (isDragging) handleScrub(ev);
      };

      const onMouseUp = () => {
        isDragging = false;
        this.store.setPlayback({ isScrubbing: false });
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Touch events for mobile/tablet
    trackWrap?.addEventListener('touchstart', (e) => {
      isDragging = true;
      if (this.store.playback.isPlaying) this.pause();
      handleScrub(e);
    });
    trackWrap?.addEventListener('touchmove', (e) => {
      if (isDragging) handleScrub(e);
    });
    trackWrap?.addEventListener('touchend', () => {
      isDragging = false;
      this.store.setPlayback({ isScrubbing: false });
    });
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.store.playback.isPlaying) this.pause();
        else this.play();
      }
    });
  }

  play() {
    this.store.setPlayback({ isPlaying: true });
    this.element.querySelector('.play-icon')?.classList.add('hidden');
    this.element.querySelector('.pause-icon')?.classList.remove('hidden');

    const duration = this.store.scene.format?.durationSeconds || 8;

    if (this.store.scene.audio?.enabled) {
      ambience.start(this.store.scene.audio.volume || 0.6);
      if (this.store.scene.template === 'globe-to-place' || (this.store.scene.camera?.start?.height || 0) > 50000) {
        ambience.triggerWhoosh(Math.min(5, duration * 0.65));
      }
    }

    this.lastFrameTime = performance.now();

    const loop = (now) => {
      if (!this.store.playback.isPlaying) return;

      const delta = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      let currentTime = this.store.playback.currentTime + delta;

      if (currentTime >= duration) {
        if (this.store.playback.loop) {
          currentTime = 0;
          if (this.store.scene.audio?.enabled && (this.store.scene.template === 'globe-to-place' || (this.store.scene.camera?.start?.height || 0) > 50000)) {
            ambience.triggerWhoosh(Math.min(5, duration * 0.65));
          }
        } else {
          currentTime = duration;
          this.pause();
          return;
        }
      }

      const progress = currentTime / duration;
      this.store.setPlayback({ currentTime, progress });

      this.updateUI(progress, currentTime);
      this.globeEngine.seek(this.store.scene, progress);

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  pause() {
    this.store.setPlayback({ isPlaying: false });
    this.element.querySelector('.play-icon')?.classList.remove('hidden');
    this.element.querySelector('.pause-icon')?.classList.add('hidden');

    ambience.stop();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  updateUI(progress, currentTime) {
    const pct = (progress * 100).toFixed(2);
    const progressBar = this.element.querySelector('#scrubber-progress');
    const head = this.element.querySelector('#scrubber-head');
    const curLbl = this.element.querySelector('#readout-current');

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (head) head.style.left = `${pct}%`;
    if (curLbl) curLbl.textContent = `${currentTime.toFixed(1)}s`;

    // Also update viewport motion graphics overlay if present
    this.updateViewportOverlay(currentTime);
  }

  updateViewportOverlay(currentTime) {
    let overlayElem = document.getElementById('viewport-motion-title');
    if (!overlayElem) {
      overlayElem = document.createElement('div');
      overlayElem.id = 'viewport-motion-title';
      overlayElem.className = 'viewport-motion-title';
      document.body.appendChild(overlayElem);
    }

    const timeline = this.store.scene.timeline || [];
    const activeEvent = timeline.find((t) => {
      if (t.action !== 'showTitle') return false;
      const at = Number(t.at) || 0;
      return currentTime >= at && currentTime <= at + 4.5;
    });

    if (activeEvent) {
      const position = activeEvent.position || 'lower-third';
      overlayElem.className = `viewport-motion-title pos-${position} visible`;
      overlayElem.innerHTML = `
        <div class="motion-card">
          <div class="motion-accent"></div>
          <div class="motion-content">
            <h2 class="motion-heading">${activeEvent.text || this.store.scene.name || ''}</h2>
            ${activeEvent.subtext ? `<p class="motion-subheading">${activeEvent.subtext}</p>` : ''}
          </div>
        </div>
      `;
    } else {
      overlayElem.className = 'viewport-motion-title hidden';
    }
  }
}
