/**
 * High-Resolution Video & Snapshot Renderer for GlobeLocation
 * Composites 3D Cesium WebGL canvas with real location landing photography,
 * animated typography, titles, and attribution
 */
import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  QUALITY_VERY_HIGH,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from 'mediabunny';
import { renderAmbienceOffline } from '../audio/ambience.js';
import { loadBadgeFonts } from '../cesium/overlays.js';

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
          const titleSize = Math.round(42 * baseScale);
          const subSize = Math.round(22 * baseScale);
          const padX = 34 * baseScale;
          const cardX = width * 0.06;
          const cardH = (subtext ? 132 : 92) * baseScale;
          const cardY = height * 0.94 - cardH;

          // Size the card to its text
          ctx.font = `800 ${titleSize}px "Outfit", sans-serif`;
          const titleW = ctx.measureText(titleText).width;
          ctx.font = `500 ${subSize}px "Inter", sans-serif`;
          const subW = subtext ? ctx.measureText(subtext).width : 0;
          const cardW = Math.min(width * 0.88, Math.max(titleW, subW) + padX * 2);

          // Glassmorphic card backing
          const bg = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
          bg.addColorStop(0, 'rgba(22, 28, 42, 0.88)');
          bg.addColorStop(1, 'rgba(8, 11, 20, 0.88)');
          ctx.fillStyle = bg;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 18);
          ctx.fill();
          ctx.stroke();

          // Left amber accent strip
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, 7, cardH, [18, 0, 0, 18]);
          ctx.fill();

          // Main Title
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${titleSize}px "Outfit", sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(titleText, cardX + padX, cardY + 24 * baseScale, cardW - padX * 1.5);

          // Subtext
          if (subtext) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = `500 ${subSize}px "Inter", sans-serif`;
            ctx.fillText(subtext, cardX + padX, cardY + 82 * baseScale, cardW - padX * 1.5);
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
 * Wait until Cesium has streamed every imagery/terrain tile for the current camera pose,
 * so frames never show low-res tiles popping in. Capped so a stalled tile server cannot hang the export.
 */
async function settleTiles(viewer, maxWaitMs = 8000) {
  const scene = viewer.scene;
  const isSettled = () => scene.globe.tilesLoaded && viewer.dataSourceDisplay.ready;
  const deadline = performance.now() + maxWaitMs;

  // Tile selection for a new camera pose only happens during render, so a single render can report
  // stale "loaded" state; require the globe to stay settled across consecutive renders
  let stableRenders = 0;
  while (stableRenders < 3) {
    viewer.scene.render();
    stableRenders = isSettled() ? stableRenders + 1 : 0;
    if (performance.now() > deadline) {
      console.warn("Tile streaming timed out; rendering frame with tiles loaded so far");
      return false;
    }
    if (stableRenders < 3) await new Promise((r) => setTimeout(r, 16));
  }
  return true;
}

/**
 * Pick the first codec pair this browser can actually encode for the requested container
 */
async function chooseCodecs(container, width, height, fps) {
  const videoCandidates = container === 'webm' ? ['vp9', 'vp8', 'av1'] : ['avc', 'hevc', 'av1', 'vp9'];
  const audioCandidates = container === 'webm' ? ['opus'] : ['aac', 'opus'];
  const videoCodec = await getFirstEncodableVideoCodec(videoCandidates, { width, height, frameRate: fps, quality: QUALITY_VERY_HIGH });
  const audioCodec = await getFirstEncodableAudioCodec(audioCandidates, { numberOfChannels: 2, sampleRate: 48000 });
  return { videoCodec, audioCodec };
}

/**
 * Render and encode video deterministically, frame by frame.
 *
 * Each frame is rendered offline (waiting for tiles to finish loading) and handed to WebCodecs with an exact
 * timestamp of frame / fps, so playback is perfectly smooth and the clip length always matches the scene duration
 * no matter how slowly individual frames render (e.g. in headless/software GL).
 */
export async function exportVideo(globeEngine, scene, options = {}, onProgress = () => {}) {
  const viewer = globeEngine?.viewer;
  if (!viewer) throw new Error('Globe engine not available');
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export requires WebCodecs (VideoEncoder), which this browser does not support');
  }

  // Encoders require even dimensions
  const width = Math.round((scene.format.width || 1920) / 2) * 2;
  const height = Math.round((scene.format.height || 1080) / 2) * 2;
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

  const container = (options.format || options.videoFormat || 'mp4') === 'webm' ? 'webm' : 'mp4';
  const { videoCodec, audioCodec } = await chooseCodecs(container, width, height, fps);
  if (!videoCodec) throw new Error(`No ${container.toUpperCase()} video encoder available in this browser`);

  const output = new Output({
    format: container === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 1,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource = null;
  if (scene.audio?.enabled && audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: 192000 });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  // Audio is synthesized offline to exactly the clip length, so it stays in sync with the frame-accurate video
  if (audioSource) {
    try {
      const isDive = scene.template === 'globe-to-place' || (scene.camera?.start?.height || 0) > 50000;
      const audioBuffer = await renderAmbienceOffline({
        durationSeconds,
        volume: scene.audio.volume || 0.6,
        whooshDuration: isDive ? Math.min(5, durationSeconds * 0.65) : 0,
      });
      await audioSource.add(audioBuffer);
    } catch (e) {
      console.warn('Audio synthesis disabled for recording:', e);
    }
    audioSource.close();
  }

  const sourceCanvas = globeEngine.getCanvas();

  // Freeze the Cesium clock so sun lighting doesn't drift while slow frames render
  const wasAnimating = viewer.clock.shouldAnimate;
  viewer.clock.shouldAnimate = false;

  // Render the globe at (at least) the export resolution so the frame and pin badges aren't upscaled
  const prevResolutionScale = viewer.resolutionScale;
  if (sourceCanvas?.width && sourceCanvas?.height) {
    const coverScale = Math.max(width / sourceCanvas.width, height / sourceCanvas.height);
    if (coverScale > 1) viewer.resolutionScale = prevResolutionScale * coverScale;
  }

  try {
    // Redraw pin badges with their web fonts loaded, then warm up on the opening pose so the first frame
    // already has its tiles and the badge texture uploaded
    await loadBadgeFonts();
    globeEngine.overlayManager?.sync(scene);
    globeEngine.seek(scene, 0);
    await settleTiles(viewer);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }

    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = totalFrames > 1 ? frame / (totalFrames - 1) : 1;
      const currentTime = frame / fps;

      // Update camera pose and render once every tile for this pose has arrived
      globeEngine.seek(scene, progress);
      await settleTiles(viewer);

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

      // Encode with an exact, evenly spaced timestamp
      await videoSource.add(currentTime, 1 / fps);

      const done = frame + 1;
      onProgress({ percent: Math.round((done / totalFrames) * 100), frame: done, totalFrames, currentTime });
    }

    videoSource.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    viewer.clock.shouldAnimate = wasAnimating;
    viewer.resolutionScale = prevResolutionScale;
  }

  const mimeType = await output.getMimeType();
  const blob = new Blob([output.target.buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const result = { blob, url, mimeType, size: blob.size };

  // Trigger automatic download
  const safeName = (scene.name || 'location-video').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-${Date.now()}.${container}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return result;
}
