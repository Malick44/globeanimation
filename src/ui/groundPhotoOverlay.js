/**
 * Real Location Ground Photo Transition Overlay
 * Seamlessly transitions from 3D Cesium camera dive into real street/ground photography
 * during interactive timeline scrubbing and live playback
 */

export class GroundPhotoOverlay {
  constructor(cesiumContainer, store) {
    this.container = cesiumContainer;
    this.store = store;

    this.element = document.createElement('div');
    this.element.className = 'ground-photo-overlay';
    this.element.innerHTML = `
      <div class="ground-photo-media" id="ground-photo-media"></div>
      <div class="ground-photo-badge" id="ground-photo-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
        <span id="ground-photo-caption">Real Location Photography</span>
      </div>
    `;
    this.container.appendChild(this.element);

    this.store.subscribe((state, changeType) => {
      if (['playback', 'scene', 'scene-loaded', 'ground-photo', 'format'].includes(changeType)) {
        this.update();
      }
    });

    this.update();
  }

  update() {
    const scene = this.store.scene;
    const config = scene.groundPhoto;

    if (!config || !config.enabled || !config.url) {
      this.element.style.opacity = '0';
      this.element.style.pointerEvents = 'none';
      return;
    }

    const duration = scene.format?.durationSeconds || 8;
    const photoDuration = config.durationSeconds || 1.8;
    const transStart = Math.max(0, duration - photoDuration);
    const currentTime = this.store.playback?.currentTime || 0;

    const media = this.element.querySelector('#ground-photo-media');
    const badge = this.element.querySelector('#ground-photo-badge');
    const caption = this.element.querySelector('#ground-photo-caption');

    if (media && media.dataset.url !== config.url) {
      media.style.backgroundImage = `url("${config.url}")`;
      media.dataset.url = config.url;
    }

    if (caption) {
      caption.textContent = config.caption || 'Real Location Photography';
    }

    if (currentTime >= transStart) {
      const p = Math.min(1, Math.max(0, (currentTime - transStart) / photoDuration));
      const transitionType = config.transition || 'dissolve';

      if (transitionType === 'zoom-cut') {
        const scale = 1.15 - 0.15 * p;
        this.element.classList.remove('pip-mode');
        this.element.style.opacity = String(p);
        if (media) media.style.transform = `scale(${scale})`;
      } else if (transitionType === 'pip-card') {
        this.element.classList.add('pip-mode');
        this.element.style.opacity = String(p);
        if (media) media.style.transform = 'scale(1)';
      } else {
        // dissolve
        this.element.classList.remove('pip-mode');
        this.element.style.opacity = String(p);
        if (media) media.style.transform = 'scale(1)';
      }
      this.element.style.pointerEvents = 'auto';
    } else {
      this.element.style.opacity = '0';
      this.element.style.pointerEvents = 'none';
    }
  }
}
