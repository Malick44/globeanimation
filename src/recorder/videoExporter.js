/**
 * High-Resolution Video & Snapshot Renderer for GlobeLocation
 * Composites 3D Cesium WebGL canvas with real location landing photography,
 * animated typography, titles, and attribution
 */
import { ambience } from '../audio/ambience.js';

export function getSupportedMimeType(preferred = 'mp4') {
  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  const types = preferred === 'webm' ? [...webmTypes, ...mp4Types] : [...mp4Types, ...webmTypes];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/mp4';
}

/**
 * Render Ground Photo Transition on 2D Composite Canvas
 */
export function drawGroundPhotoOnCanvas(ctx, img, groundPhotoConfig, p, width, height) {
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const transition = groundPhotoConfig.transition || 'dissolve';

  ctx.save();

  if (transition === 'pip-card') {
    // Picture in picture card in bottom right or center
    const cardW = Math.min(width * 0.44, 680);
    const cardH = (cardW / img.naturalWidth) * img.naturalHeight;
    const pad = 36;
    const cardX = width - cardW - pad;
    const cardY = height - cardH - pad;

    ctx.globalAlpha = Math.min(1, p * 1.4);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 24;

    // Card frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.clip();
    ctx.drawImage(img, cardX, cardY, cardW, cardH);
    ctx.restore();

    // Caption
    if (groundPhotoConfig.caption) {
      ctx.fillStyle = 'rgba(7, 11, 20, 0.88)';
      ctx.beginPath();
      ctx.roundRect(cardX + 14, cardY + cardH - 42, cardW - 28, 30, 8);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px "Inter", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(groundPhotoConfig.caption, cardX + 26, cardY + cardH - 27);
    }
  } else {
    // Fullscreen dissolve or zoom-cut
    ctx.globalAlpha = Math.max(0, Math.min(1, p));

    // Cover math (preserve image aspect ratio without stretching)
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const screenRatio = width / height;
    let drawW, drawH, drawX, drawY;

    if (screenRatio > imgRatio) {
      drawW = width;
      drawH = width / imgRatio;
      drawX = 0;
      drawY = (height - drawH) / 2;
    } else {
      drawH = height;
      drawW = height * imgRatio;
      drawY = 0;
      drawX = (width - drawW) / 2;
    }

    if (transition === 'zoom-cut') {
      const scale = 1.14 - 0.14 * p;
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-width / 2, -height / 2);
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Caption Badge
    if (groundPhotoConfig.caption && p > 0.25) {
      const badgeAlpha = Math.min(1, (p - 0.25) / 0.75);
      ctx.globalAlpha = badgeAlpha;

      const badgeText = groundPhotoConfig.caption;
      ctx.font = '600 15px "Inter", sans-serif';
      const textMetrics = ctx.measureText(badgeText);
      const bW = textMetrics.width + 44;
      const bH = 40;
      const bX = width - bW - 36;
      const bY = height - bH - 36;

      ctx.fillStyle = 'rgba(7, 11, 20, 0.90)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, bH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bX + 18, bY + bH / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bX + 32, bY + bH / 2);
    }
  }

  ctx.restore();
}

/**
 * Draw animated typography and title cards on the 2D composite canvas
 */
export function drawOverlaysOnCanvas(ctx, scene, currentTime, width, height) {
  const timeline = scene.timeline || [];

  for (const event of timeline) {
    if (event.action === 'showTitle') {
      const startTime = Number(event.at) || 0;
      const duration = 4.5;
      const elapsed = currentTime - startTime;

      if (elapsed >= 0 && elapsed <= duration) {
        // Compute fade in and fade out
        let opacity = 1;
        if (elapsed < 0.6) {
          opacity = elapsed / 0.6;
        } else if (elapsed > duration - 0.8) {
          opacity = (duration - elapsed) / 0.8;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

        const position = event.position || 'lower-third';
        const titleText = event.text || scene.name || '';
        const subtext = event.subtext || scene.location?.description || '';

        const isVertical = height > width;
        const baseScale = isVertical ? 0.85 : 1.0;

        if (position === 'lower-third') {
          const cardX = width * 0.08;
          const cardY = height * 0.78;
          const cardW = Math.min(width * 0.84, 760 * baseScale);
          const cardH = 110 * baseScale;

          // Glassmorphic card backing
          ctx.fillStyle = 'rgba(7, 10, 16, 0.75)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 16);
          ctx.fill();
          ctx.stroke();

          // Left amber accent strip
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, 6, cardH, [16, 0, 0, 16]);
          ctx.fill();

          // Main Title
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.round(28 * baseScale)}px "Outfit", sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(titleText, cardX + 26 * baseScale, cardY + 22 * baseScale);

          // Subtext
          if (subtext) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = `500 ${Math.round(16 * baseScale)}px "Inter", sans-serif`;
            ctx.fillText(subtext, cardX + 26 * baseScale, cardY + 62 * baseScale);
          }
        } else if (position === 'top-banner') {
          const cardW = Math.min(width * 0.86, 680 * baseScale);
          const cardH = 90 * baseScale;
          const cardX = (width - cardW) / 2;
          const cardY = height * 0.08;

          ctx.fillStyle = 'rgba(7, 10, 16, 0.8)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 14);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.round(24 * baseScale)}px "Outfit", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(titleText, width / 2, cardY + 18 * baseScale);

          if (subtext) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = `400 ${Math.round(14 * baseScale)}px "Inter", sans-serif`;
            ctx.fillText(subtext, width / 2, cardY + 52 * baseScale);
          }
          ctx.textAlign = 'left';
        } else if (position === 'center') {
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${Math.round(44 * baseScale)}px "Outfit", sans-serif`;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 24;
          const cardY = height * 0.45;
          ctx.fillText(titleText, width / 2, cardY);

          if (subtext) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = `500 ${Math.round(20 * baseScale)}px "Inter", sans-serif`;
            ctx.fillText(subtext, width / 2, cardY + 52 * baseScale);
          }
        }

        ctx.restore();
      }
    }
  }

  // Subtle attribution watermark (Bottom-right)
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  const attrW = 240;
  const attrH = 26;
  const attrX = width - attrW - 16;
  const attrY = height - attrH - 16;
  ctx.beginPath();
  ctx.roundRect(attrX, attrY, attrW, attrH, 6);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GlobeLocation • Imagery © Esri, OSM', attrX + attrW / 2, attrY + attrH / 2);
  ctx.restore();
}

/**
 * Capture High-Res Static Snapshot (PNG)
 */
export function captureSnapshot(globeEngine, scene, filename = 'location-snapshot.png') {
  const viewer = globeEngine?.viewer;
  if (!viewer) return;

  viewer.scene.render();
  const sourceCanvas = globeEngine.getCanvas();
  if (!sourceCanvas) return;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = scene.format.width || 1920;
  exportCanvas.height = scene.format.height || 1080;
  const ctx = exportCanvas.getContext('2d');

  // Fill dark background
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // Draw scaled source canvas
  ctx.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

  // Draw overlays
  drawOverlaysOnCanvas(ctx, scene, scene.format.durationSeconds * 0.7, exportCanvas.width, exportCanvas.height);

  // Export
  exportCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Render and Record Video with Real-Time Frame Interpolation
 */
export async function exportVideo(globeEngine, scene, options = {}, onProgress = () => {}) {
  const viewer = globeEngine?.viewer;
  if (!viewer) throw new Error('Globe engine not available');

  const width = scene.format.width || 1920;
  const height = scene.format.height || 1080;
  const fps = scene.format.fps || 30;
  const durationSeconds = scene.format.durationSeconds || 8;
  const totalFrames = Math.round(durationSeconds * fps);

  // Preload real ground photo if enabled
  let groundImg = null;
  if (scene.groundPhoto?.enabled && scene.groundPhoto?.url) {
    try {
      groundImg = new Image();
      groundImg.crossOrigin = 'anonymous';
      groundImg.src = scene.groundPhoto.url;
      await new Promise((resolve) => {
        groundImg.onload = resolve;
        groundImg.onerror = () => {
          console.warn('Ground photo image failed to load during export');
          groundImg = null;
          resolve();
        };
        setTimeout(resolve, 3000);
      });
    } catch (e) {
      console.warn('Could not load ground photo for export:', e);
    }
  }

  // Offscreen compositing canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Stream setup
  const stream = canvas.captureStream(fps);

  // Audio setup
  let audioTrack = null;
  if (scene.audio?.enabled) {
    try {
      ambience.start(scene.audio.volume || 0.6);
      if (scene.template === 'globe-to-place' || (scene.camera?.start?.height || 0) > 50000) {
        ambience.triggerWhoosh(Math.min(5, durationSeconds * 0.65));
      }
      audioTrack = ambience.getAudioTrack();
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch (e) {
      console.warn('Audio synthesis disabled for recording:', e);
    }
  }

  const preferredFormat = options.format || options.videoFormat || 'mp4';
  const mimeType = getSupportedMimeType(preferredFormat);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 16000000, // High quality 16 Mbps
  });

  const recordedChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  const recordingPromise = new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      if (audioTrack) {
        ambience.stop();
      }
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      resolve({ blob, url, mimeType, size: blob.size });
    };
    mediaRecorder.onerror = (e) => {
      if (audioTrack) ambience.stop();
      reject(e.error || new Error('MediaRecorder error'));
    };
  });

  mediaRecorder.start();

  const sourceCanvas = globeEngine.getCanvas();
  const frameIntervalMs = 1000 / fps;

  try {
    for (let frame = 0; frame <= totalFrames; frame++) {
      const progress = frame / totalFrames;
      const currentTime = progress * durationSeconds;

      // Update camera pose
      globeEngine.seek(scene, progress);

      // Force synchronous Cesium frame render
      viewer.scene.render();

      // Clear composite canvas
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, width, height);

      // Draw Cesium WebGL canvas onto 2D canvas with cover aspect ratio
      if (sourceCanvas) {
        const srcW = sourceCanvas.width;
        const srcH = sourceCanvas.height;
        const targetAspect = width / height;
        const srcAspect = srcW / srcH;

        if (srcAspect > targetAspect) {
          // Source is wider, crop sides
          const cropW = srcH * targetAspect;
          const cropX = (srcW - cropW) / 2;
          ctx.drawImage(sourceCanvas, cropX, 0, cropW, srcH, 0, 0, width, height);
        } else {
          // Source is taller, crop top/bottom
          const cropH = srcW / targetAspect;
          const cropY = (srcH - cropH) / 2;
          ctx.drawImage(sourceCanvas, 0, cropY, srcW, cropH, 0, 0, width, height);
        }
      }

      // Draw Real Location Ground Photo Transition if within transition window
      if (groundImg && scene.groundPhoto?.enabled) {
        const photoDuration = scene.groundPhoto.durationSeconds || 1.8;
        const transStart = Math.max(0, durationSeconds - photoDuration);
        if (currentTime >= transStart) {
          const p = Math.min(1, Math.max(0, (currentTime - transStart) / photoDuration));
          drawGroundPhotoOnCanvas(ctx, groundImg, scene.groundPhoto, p, width, height);
        }
      }

      // Draw custom motion graphics & title overlays
      drawOverlaysOnCanvas(ctx, scene, currentTime, width, height);

      // Notify progress callback
      const percent = Math.min(100, Math.round((frame / totalFrames) * 100));
      onProgress({ percent, frame, totalFrames, currentTime });

      // Small delay to allow MediaRecorder frame capture
      await new Promise((r) => setTimeout(r, frameIntervalMs * 0.4));
    }

    // Finish recording
    mediaRecorder.stop();
    const result = await recordingPromise;

    // Trigger automatic download
    const safeName = (scene.name || 'location-video').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${safeName}-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return result;
  } catch (err) {
    mediaRecorder.stop();
    throw err;
  }
}
