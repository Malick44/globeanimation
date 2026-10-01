/**
 * 3D Overlays, Pins & Route Renderer for Cesium Viewer
 * Renders glowing pins, pulse rings, and 3D route trajectory lines
 */
import * as Cesium from 'cesium';

/**
 * Generate a crisp high-DPI canvas icon for a location pin
 */
export function createPinCanvas(color = '#f59e0b', label = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const cx = 64;
  const cy = 48;
  const r = 26;

  // Outer ambient glow
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 45);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 45, 0, Math.PI * 2);
  ctx.fill();

  // Pin teardrop body
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 0.2, false);
  ctx.lineTo(cx, 110);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // White inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Dark core dot
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  return canvas;
}

export class OverlayManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.entities = [];
    this.routeEntity = null;
    this.pulseTime = 0;
  }

  clear() {
    for (const ent of this.entities) {
      this.viewer.entities.remove(ent);
    }
    this.entities = [];
    if (this.routeEntity) {
      this.viewer.entities.remove(this.routeEntity);
      this.routeEntity = null;
    }
  }

  sync(scene) {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    this.clear();

    const overlays = scene.overlays || [];
    for (const item of overlays) {
      if (item.type === 'pin') {
        this.addPin(item);
      }
    }

    // If route or multi-stop, draw route line
    const waypoints = scene.camera?.waypoints || [];
    if (waypoints.length >= 2) {
      this.addRouteLine(waypoints, scene.theme);
    }
  }

  addPin(pinData) {
    const lat = Number(pinData.latitude);
    const lon = Number(pinData.longitude);
    const alt = Number(pinData.height) || 0;
    const color = pinData.color || '#f59e0b';

    const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
    const canvas = createPinCanvas(color, pinData.label);

    const pinEntity = this.viewer.entities.add({
      position,
      billboard: {
        image: canvas,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.65,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: pinData.label
        ? {
            text: pinData.label,
            font: '600 13px "Inter", sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.9)'),
            outlineWidth: 4,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 10),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }
        : undefined,
    });

    this.entities.push(pinEntity);
  }

  addRouteLine(waypoints, themeKey = 'documentary') {
    const positions = waypoints.map((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, (wp.height || 1000) * 0.4)
    );

    const lineColor = themeKey === 'dark-data'
      ? Cesium.Color.fromCssColorString('#06b6d4')
      : Cesium.Color.fromCssColorString('#f59e0b');

    this.routeEntity = this.viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          taperPower: 0.6,
          color: lineColor,
        }),
        clampToGround: false,
      },
    });
  }
}
