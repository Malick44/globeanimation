/**
 * 3D Overlays, Pins & Route Renderer for Cesium Viewer
 * Renders After Effects-style 3D tracked callout badges, glowing leader stalks,
 * ground pulse rings, and 3D route trajectory ribbons.
 */
import * as Cesium from 'cesium';

const BADGE_PIXEL_RATIO = 3; // Badge is drawn at 3x and shown at 1/3 scale so text stays crisp in 1080p+ exports
const BADGE_FONTS = ['800 30px "Outfit"', '500 15px "Inter"', '600 12px "JetBrains Mono"'];

/**
 * Resolve once the web fonts used by the badge are loaded (canvas text silently falls back otherwise)
 */
export function loadBadgeFonts() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return Promise.all(BADGE_FONTS.map((f) => document.fonts.load(f).catch(() => {}))).then(() => {});
}

function formatCoords(latitude, longitude) {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}  ·  ${lon}`;
}

/**
 * Generate the location callout badge: glass card with pin icon, title, subtitle and coordinates,
 * plus a pointer notch at the bottom that meets the leader stalk.
 */
export function create3DTrackBadgeCanvas({
  label = 'TARGET LOCATION',
  sublabel = '',
  latitude = 0,
  longitude = 0,
  color = '#f59e0b',
}) {
  const title = String(label).toUpperCase();
  const coords = formatCoords(latitude, longitude);

  const titleFont = '800 30px "Outfit", "Inter", sans-serif';
  const subFont = '500 15px "Inter", sans-serif';
  const coordFont = '600 12px "JetBrains Mono", ui-monospace, monospace';

  // Measure text to size the card to its content
  const measure = document.createElement('canvas').getContext('2d');
  const textWidth = (font, text, spacing = 0) => {
    measure.font = font;
    return measure.measureText(text).width + spacing * text.length;
  };

  const pad = 20;
  const iconSize = 44;
  const gap = 16;
  const shadow = 24;
  const notch = 12;
  const contentW = Math.max(
    textWidth(titleFont, title, 1.5),
    sublabel ? textWidth(subFont, sublabel) : 0,
    textWidth(coordFont, coords, 0.5)
  );
  const cardW = Math.min(560, Math.max(280, Math.ceil(pad + iconSize + gap + contentW + pad)));
  const cardH = sublabel ? 104 : 84;
  const logicalW = cardW + shadow * 2;
  const logicalH = cardH + notch + shadow * 2;

  const canvas = document.createElement('canvas');
  canvas.width = logicalW * BADGE_PIXEL_RATIO;
  canvas.height = logicalH * BADGE_PIXEL_RATIO;
  const ctx = canvas.getContext('2d');
  ctx.scale(BADGE_PIXEL_RATIO, BADGE_PIXEL_RATIO);

  const x = shadow;
  const y = shadow;
  const r = 18;

  // Card body + notch as one shape so the shadow and fill are seamless
  const cardPath = new Path2D();
  cardPath.roundRect(x, y, cardW, cardH, r);
  const midX = x + cardW / 2;
  cardPath.moveTo(midX - notch, y + cardH - 1);
  cardPath.lineTo(midX, y + cardH + notch);
  cardPath.lineTo(midX + notch, y + cardH - 1);
  cardPath.closePath();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  const bg = ctx.createLinearGradient(0, y, 0, y + cardH);
  bg.addColorStop(0, 'rgba(22, 28, 42, 0.94)');
  bg.addColorStop(1, 'rgba(8, 11, 20, 0.94)');
  ctx.fillStyle = bg;
  ctx.fill(cardPath);
  ctx.restore();

  // Hairline border tinted with the accent color
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 0.75, y + 0.75, cardW - 1.5, cardH - 1.5, r - 1);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Pointer notch in solid accent color
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(midX - notch + 2, y + cardH);
  ctx.lineTo(midX, y + cardH + notch);
  ctx.lineTo(midX + notch - 2, y + cardH);
  ctx.closePath();
  ctx.fill();

  // Accent icon disc with a map-pin glyph
  const iconX = x + pad;
  const iconY = y + (cardH - iconSize) / 2;
  const cx = iconX + iconSize / 2;
  const cy = iconY + iconSize / 2;
  const disc = ctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, iconSize / 2);
  disc.addColorStop(0, '#ffffff33');
  disc.addColorStop(1, color);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, iconSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = disc;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 9, Math.PI, 0);
  ctx.bezierCurveTo(cx + 9, cy + 3, cx + 3, cy + 8, cx, cy + 13);
  ctx.bezierCurveTo(cx - 3, cy + 8, cx - 9, cy + 3, cx - 9, cy - 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 3.6, 0, Math.PI * 2);
  ctx.fill();

  // Text block
  const textX = iconX + iconSize + gap;
  const maxTextW = cardW - (textX - x) - pad;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#ffffff';
  ctx.font = titleFont;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
  ctx.fillText(title, textX, y + (sublabel ? 44 : 46), maxTextW);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  if (sublabel) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = subFont;
    ctx.fillText(sublabel, textX, y + 68, maxTextW);
  }

  ctx.fillStyle = color;
  ctx.font = coordFont;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.5px';
  ctx.fillText(coords, textX, y + (sublabel ? 90 : 68), maxTextW);

  // Logical anchor geometry so the billboard can line the notch tip up with the stalk
  canvas.badgeTipOffsetY = shadow; // transparent shadow margin below the notch tip, in logical px
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
    this.lastScene = scene;

    // Badges are drawn to canvas once; redraw them when the web fonts finish loading
    if (!this.fontsReady) {
      this.fontsReady = true;
      loadBadgeFonts().then(() => {
        if (this.lastScene && !this.viewer.isDestroyed()) this.sync(this.lastScene);
      });
    }

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
      color,
    });

    const badgePosition = Cesium.Cartesian3.fromDegrees(lon, lat, stalkHeight);
    const badgeEntity = this.viewer.entities.add({
      position: badgePosition,
      billboard: {
        image: badgeCanvas,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        // Drop the transparent shadow margin so the notch tip sits on the stalk top
        pixelOffset: new Cesium.Cartesian2(0, badgeCanvas.badgeTipOffsetY),
        scale: 1 / BADGE_PIXEL_RATIO,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 20000000, 0.8),
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
