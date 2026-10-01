/**
 * Framing Guides & Aspect Ratio Letterbox / Pillarbox Component
 */

export class FramingGuides {
  constructor(containerElement, store) {
    this.container = containerElement;
    this.store = store;
    this.element = document.createElement('div');
    this.element.className = 'framing-guides-overlay';
    this.container.appendChild(this.element);

    this.render();
    this.store.subscribe((state, changeType) => {
      if (['format', 'scene', 'scene-loaded', 'scene-reset'].includes(changeType)) {
        this.render();
      }
    });

    window.addEventListener('resize', () => this.render());
  }

  render() {
    const scene = this.store.scene;
    const aspectRatio = scene.format?.aspectRatio || '16:9';
    const showGuides = scene.guides?.show || false;

    const contW = this.container.clientWidth;
    const contH = this.container.clientHeight;

    // Calculate aspect ratio target box
    let targetRatio = 16 / 9;
    if (aspectRatio === '9:16') targetRatio = 9 / 16;
    else if (aspectRatio === '1:1') targetRatio = 1 / 1;

    let boxW = contW;
    let boxH = contH;
    const currentRatio = contW / contH;

    if (currentRatio > targetRatio) {
      // Container is wider than target: pillarbox (black bars left and right)
      boxH = contH;
      boxW = contH * targetRatio;
    } else {
      // Container is taller than target: letterbox (black bars top and bottom)
      boxW = contW;
      boxH = contW / targetRatio;
    }

    const offsetX = (contW - boxW) / 2;
    const offsetY = (contH - boxH) / 2;

    this.element.innerHTML = `
      <!-- Crop Masks (Letterbox/Pillarbox) -->
      <div class="crop-mask mask-top" style="top: 0; left: 0; width: 100%; height: ${offsetY}px;"></div>
      <div class="crop-mask mask-bottom" style="bottom: 0; left: 0; width: 100%; height: ${offsetY}px;"></div>
      <div class="crop-mask mask-left" style="top: ${offsetY}px; left: 0; width: ${offsetX}px; height: ${boxH}px;"></div>
      <div class="crop-mask mask-right" style="top: ${offsetY}px; right: 0; width: ${offsetX}px; height: ${boxH}px;"></div>

      <!-- Active Frame Border -->
      <div class="active-frame-border" style="
        position: absolute;
        left: ${offsetX}px;
        top: ${offsetY}px;
        width: ${boxW}px;
        height: ${boxH}px;
        border: 1px solid rgba(245, 158, 11, 0.4);
        box-shadow: 0 0 24px rgba(0, 0, 0, 0.4);
        pointer-events: none;
      ">
        ${
          showGuides
            ? `
          <!-- Rule of Thirds Lines -->
          <div class="guide-grid thirds-v1" style="position: absolute; left: 33.33%; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.15);"></div>
          <div class="guide-grid thirds-v2" style="position: absolute; left: 66.66%; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.15);"></div>
          <div class="guide-grid thirds-h1" style="position: absolute; top: 33.33%; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.15);"></div>
          <div class="guide-grid thirds-h2" style="position: absolute; top: 66.66%; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.15);"></div>

          <!-- Action Safe (90%) -->
          <div class="guide-box action-safe" style="
            position: absolute;
            top: 5%;
            left: 5%;
            width: 90%;
            height: 90%;
            border: 1px dashed rgba(6, 182, 212, 0.35);
          ">
            <span style="position: absolute; top: 4px; left: 6px; font-size: 10px; font-family: 'JetBrains Mono', monospace; color: rgba(6, 182, 212, 0.6);">ACTION SAFE 90%</span>
          </div>

          <!-- Title Safe (80%) -->
          <div class="guide-box title-safe" style="
            position: absolute;
            top: 10%;
            left: 10%;
            width: 80%;
            height: 80%;
            border: 1px dashed rgba(245, 158, 11, 0.45);
          ">
            <span style="position: absolute; top: 4px; left: 6px; font-size: 10px; font-family: 'JetBrains Mono', monospace; color: rgba(245, 158, 11, 0.7);">TITLE SAFE 80%</span>
          </div>

          <!-- Center Crosshair -->
          <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; pointer-events: none;">
            <div style="position: absolute; left: 7px; top: 0; width: 2px; height: 16px; background: rgba(255,255,255,0.5);"></div>
            <div style="position: absolute; top: 7px; left: 0; height: 2px; width: 16px; background: rgba(255,255,255,0.5);"></div>
          </div>
        `
            : ''
        }

        <!-- Aspect Ratio Tag -->
        <div style="
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #f59e0b;
        ">
          ${aspectRatio} • ${scene.format.width}x${scene.format.height}
        </div>
      </div>
    `;
  }
}
