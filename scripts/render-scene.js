#!/usr/bin/env node
/**
 * Render a scene JSON headlessly, with no prompt step: the caller has already decided every place and move.
 *
 *   node scripts/render-scene.js --scene scene.json --out clip.mp4 [--track clip.track.json]
 *   node scripts/render-scene.js --scene scene.json --stills 0,0.5,1 --stills-dir ./preview
 *
 * Writes the MP4 (H.264, no audio unless the scene enables it) and, when the scene has a `track`, the
 * per-frame screen positions of its points and lines (see projectTrack in src/recorder/videoExporter.js).
 * The last line on stdout is a JSON report: {out, track, frames, stalledFrames, imageryCredit, seconds}.
 * Set "cleanPlate": true in the scene for the globe alone (no pins, titles or watermark), "imagery":
 * "usgs" | "naturalearth" for public-domain imagery, and "time" (ISO 8601) to fix the sun.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (flag, dflt = null) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : dflt;
};
const scenePath = arg('--scene');
const outPath = arg('--out');
const trackPath = arg('--track', outPath ? outPath.replace(/\.[a-z0-9]+$/i, '') + '.track.json' : null);
const stills = arg('--stills');
const stillsDir = arg('--stills-dir', '.');
const port = Number(arg('--port', '5199'));
if (!scenePath || (!outPath && !stills)) {
  console.error('usage: render-scene.js --scene scene.json (--out clip.mp4 | --stills 0,0.5,1 [--stills-dir dir])');
  process.exit(2);
}
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const log = (m) => console.error(m);

async function main() {
  const t0 = Date.now();
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const server = await createServer({ root, logLevel: 'error', server: { port, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (err) => log(`page error: ${err.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.__GLOBE_STUDIO__?.globeEngine?.viewer, { timeout: 60000 });
    const credit = await page.evaluate(async (s) => {
      const g = window.__GLOBE_STUDIO__;
      g.store.loadScene(s);
      g.globeEngine.syncScene(g.store.scene);
      return (await g.globeEngine.imageryReady) || null;
    }, scene);
    log(`scene loaded (${scene.format?.durationSeconds}s), imagery: ${credit || scene.theme}`);

    if (stills) {
      fs.mkdirSync(stillsDir, { recursive: true });
      const fractions = stills.split(',').map(Number);
      const res = await page.evaluate((f) => window.__GLOBE_STUDIO__.renderStills(f), fractions);
      const files = res.map((r, i) => {
        const f = path.join(stillsDir, `still_${String(i).padStart(2, '0')}.png`);
        fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
        return { file: f, progress: r.progress, settled: r.settled, track: r.track };
      });
      console.log(JSON.stringify({ stills: files, imageryCredit: credit, seconds: (Date.now() - t0) / 1000 }));
      return;
    }

    await page.exposeFunction('__renderProgress', (p) => {
      if (p.frame % 30 === 0 || p.frame === p.totalFrames) log(`  frame ${p.frame}/${p.totalFrames}`);
    });
    const res = await page.evaluate(async () => {
      const r = await window.__GLOBE_STUDIO__.exportVideo({ format: 'mp4', download: false }, (p) => window.__renderProgress(p));
      const bytes = new Uint8Array(await r.blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 16384) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 16384));
      return { base64: btoa(bin), mimeType: r.mimeType, stalledFrames: r.stalledFrames, totalFrames: r.totalFrames, track: r.track };
    });
    const out = path.resolve(outPath);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const buf = Buffer.from(res.base64, 'base64');
    if (res.mimeType.includes('mp4')) {
      fs.writeFileSync(out, buf);
    } else {
      const tmp = out + '.tmp.webm';
      fs.writeFileSync(tmp, buf);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', out]);
      fs.unlinkSync(tmp);
    }
    if (res.track) fs.writeFileSync(path.resolve(trackPath), JSON.stringify(res.track));
    console.log(JSON.stringify({
      out, track: res.track ? path.resolve(trackPath) : null, frames: res.totalFrames,
      stalledFrames: res.stalledFrames, imageryCredit: credit, seconds: (Date.now() - t0) / 1000,
    }));
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
}

main().catch((err) => {
  console.error(`render-scene failed: ${err.stack || err}`);
  process.exit(1);
});
