/**
 * 3D Overlays, Pins & Route Renderer for Cesium Viewer
 * Renders After Effects-style 3D tracked callout badges, glowing leader stalks,
 * ground pulse rings, and 3D route trajectory ribbons.
 */
import * as Cesium from 'cesium';

/**
 * Generate an After Effects-style 3D Tracked HUD Callout Badge
 */
export function create3DTrackBadgeCanvas({
  label = 'TARGET LOCATION',
  sublabel = '',
  latitude = 0,
  longitude = 0,
  height = 0,
  color = '#f59e0b',
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');

  const x = 16;
  const y = 14;
  const w = 508;
  const h = 156;
  const r = 12;

  // Ambient Drop Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;

  // Glassmorphic Panel Backing
  ctx.fillStyle = 'rgba(7, 11, 20, 0.90)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // Glowing Neon Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();

  // Sci-fi / After Effects HUD Corner Brackets ⌜ ⌝ ⌞ ⌟
  const bLen = 16;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(x - 2, y + bLen);
  ctx.lineTo(x - 2, y - 2);
  ctx.lineTo(x + bLen, y - 2);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(x + w + 2 - bLen, y - 2);
  ctx.lineTo(x + w + 2, y - 2);
  ctx.lineTo(x + w + 2, y + bLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(x - 2, y + h - bLen);
  ctx.lineTo(x - 2, y + h + 2);
  ctx.lineTo(x + bLen, y + h + 2);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(x + w + 2 - bLen, y + h + 2);
  ctx.lineTo(x + w + 2, y + h + 2);
  ctx.lineTo(x + w + 2, y + h - bLen);
  ctx.stroke();

  // Header Row: Status Indicator & GPS Lock
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(x + 24, y + 25, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#64748b';
  ctx.font = '700 11px "Inter", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('TRACK 01 // 3D CAMERA LOCK', x + 36, y + 25);

  // Target Reticle Icon on Right
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  const rx = x + w - 28;
  const ry = y + 25;
  ctx.beginPath();
  ctx.arc(rx, ry, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rx - 12, ry);
  ctx.lineTo(rx + 12, ry);
  ctx.moveTo(rx, ry - 12);
  ctx.lineTo(rx, ry + 12);
  ctx.stroke();

  // Main Headline: Location / City Name
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px "Outfit", "Inter", sans-serif';
  ctx.textBaseline = 'top';
  const cleanTitle = String(label).toUpperCase();
  ctx.fillText(cleanTitle, x + 24, y + 44, w - 48);

  // Subtitle / Region
  const latStr = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  const sub = sublabel || `${latStr}, ${lonStr}`;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 13px "Inter", sans-serif';
  ctx.fillText(sub, x + 24, y + 80, w - 48);

  // Divider Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 106);
  ctx.lineTo(x + w - 20, y + 106);
  ctx.stroke();

  // Telemetry Footer: Lat/Lon & Elevation
  ctx.fillStyle = color;
  ctx.font = '600 12px "Inter", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(`GEO: ${latStr}  ${lonStr}`, x + 24, y + 130);

  const elevText = `ALT: ${Math.round(height || 0)}M`;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 12px "Inter", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(elevText, x + w - 24, y + 130);
  ctx.textAlign = 'left';

  // Bottom Anchor Pointer notch (connects directly to vertical leader stalk)
  ctx.fillStyle = color;
  ctx.beginPath();
  const midX = x + w / 2;
  const botY = y + h;
  ctx.moveTo(midX - 10, botY);
  ctx.lineTo(midX + 10, botY);
  ctx.lineTo(midX, botY + 12);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

export class OverlayManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.entities = [];
    this.routeEntity = null;
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
    const groundAlt = Number(pinData.height) || 0;
    const color = pinData.color || '#f59e0b';
    const label = pinData.label || 'Target Location';
    const sublabel = pinData.sublabel || '';

    // Stalk elevates the HUD badge above terrain/skyline
    const stalkHeight = pinData.stalkHeight || (groundAlt + 140);

    // 1. Vertical Glowing Leader Stalk (After Effects 3D Track Point style)
    const stalkPositions = [
      Cesium.Cartesian3.fromDegrees(lon, lat, groundAlt),
      Cesium.Cartesian3.fromDegrees(lon, lat, stalkHeight),
    ];

    const stalkEntity = this.viewer.entities.add({
      polyline: {
        positions: stalkPositions,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.35,
          taperPower: 0.6,
          color: Cesium.Color.fromCssColorString(color),
        }),
        depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          taperPower: 0.6,
          color: Cesium.Color.fromCssColorString(color).withAlpha(0.6),
        }),
      },
    });
    this.entities.push(stalkEntity);

    // 2. Ground Pulse Beacon & Target Bullseye
    const groundBeacon = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, groundAlt),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      ellipse: {
        semiMinorAxis: 180.0,
        semiMajorAxis: 180.0,
        height: groundAlt,
        material: Cesium.Color.fromCssColorString(color).withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.85),
        outlineWidth: 2,
      },
    });
    this.entities.push(groundBeacon);

    // 3. 3D Tracked HUD Badge Billboard at the top of the stalk
    const badgeCanvas = create3DTrackBadgeCanvas({
      label,
      sublabel,
      latitude: lat,
      longitude: lon,
      height: groundAlt,
      color,
    });

    const badgePosition = Cesium.Cartesian3.fromDegrees(lon, lat, stalkHeight);
    const badgeEntity = this.viewer.entities.add({
      position: badgePosition,
      billboard: {
        image: badgeCanvas,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.62,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(500, 0.75, 12000000, 0.35),
      },
    });
    this.entities.push(badgeEntity);
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
