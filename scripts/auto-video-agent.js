#!/usr/bin/env node
/**
 * Headless CLI AI Video Agent for GlobeLocation
 * Usage:
 *   node scripts/auto-video-agent.js --prompt "Tokyo Shibuya crossing vertical reel" --output ./output/tokyo.webm
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

import { execSync } from 'child_process';

// Parse arguments
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}
const hasFlag = (flag) => args.includes(flag);

const prompt = getArg('--prompt', 'Cinematic dive into Tokyo Shibuya crossing at night with cyberpunk theme');
const formatOverride = getArg('--format', null);
const outputPath = getArg('--output', `./output/video_${Date.now()}.mp4`);
const serverUrl = getArg('--url', 'http://localhost:5173/');
const autoRender = !hasFlag('--no-render');
const videoFormat = outputPath.endsWith('.webm') || hasFlag('--webm') ? 'webm' : 'mp4';

console.log('====================================================');
console.log('🤖 GlobeLocation Autonomous AI Video Agent');
console.log('====================================================');
console.log(`🎬 Prompt: "${prompt}"`);
console.log(`📐 Aspect Ratio: ${formatOverride || 'Auto-detect'}`);
console.log(`📦 Video Format: ${videoFormat.toUpperCase()}`);
console.log(`💾 Target Output: ${outputPath}`);
console.log(`🌐 Server URL: ${serverUrl}`);
console.log('----------------------------------------------------');

async function run() {
  const outputDir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🚀 Launching headless browser agent...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[AGENT]')) {
      console.log('🤖', text);
    }
  });
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));

  console.log(`⏳ Connecting to GlobeLocation Studio at ${serverUrl}...`);
  await page.goto(serverUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

  // Wait for Globe Studio engine initialization
  await page.waitForFunction(() => !!window.__GLOBE_STUDIO__?.agent, { timeout: 25000 });
  console.log('✅ GlobeLocation Studio & Agent Engine initialized!');

  console.log('🧠 AI Director synthesizing 3D scene & camera trajectories...');
  const result = await page.evaluate(
    async (userPrompt, userOptions) => {
      const agent = window.__GLOBE_STUDIO__.agent;
      const res = await agent.createVideoFromPrompt(userPrompt, {
        autoRender: userOptions.autoRender,
        videoFormat: userOptions.videoFormat,
        formatOverride: userOptions.formatOverride,
        onProgress: (evt) => {
          console.log(`[AGENT] [${evt.step.toUpperCase()}] ${evt.message}`);
        },
      });

      if (userOptions.autoRender && res.video?.blob) {
        // Fast chunked ArrayBuffer to Base64 conversion
        const arrayBuffer = await res.video.blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 16384;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        return {
          success: true,
          base64: btoa(binary),
          byteLength: bytes.length,
          mimeType: res.video.mimeType,
          scene: res.scene,
        };
      }

      return { success: true, scene: res.scene };
    },
    prompt,
    { autoRender, formatOverride, videoFormat }
  );

  if (result.base64) {
    const base64Data = result.base64.includes(',') ? result.base64.split(',')[1] : result.base64;
    const buffer = Buffer.from(base64Data, 'base64');
    const resolvedOut = path.resolve(outputPath);

    // If browser produced native mp4 or user requested webm, save directly
    if (result.mimeType?.includes('mp4') || !resolvedOut.endsWith('.mp4')) {
      fs.writeFileSync(resolvedOut, buffer);
      console.log(`🎉 Native ${result.mimeType} video saved to: ${outputPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    } else {
      // If browser returned webm but user requested .mp4, transcode with ffmpeg
      const tempWebm = resolvedOut + '.tmp.webm';
      fs.writeFileSync(tempWebm, buffer);
      try {
        console.log('🔄 Converting to universal H.264/AAC MP4 via ffmpeg with faststart...');
        execSync(`ffmpeg -y -i "${tempWebm}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -c:a aac "${resolvedOut}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempWebm);
        const finalStat = fs.statSync(resolvedOut);
        console.log(`🎉 MP4 Video saved successfully to: ${outputPath} (${(finalStat.size / (1024 * 1024)).toFixed(2)} MB)`);
      } catch (err) {
        console.warn('ffmpeg transcode fallback; saving raw stream:', err.message);
        fs.renameSync(tempWebm, resolvedOut);
        console.log(`🎉 Video saved to: ${outputPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
      }
    }
  } else {
    console.log('✅ Scene successfully synthesized and loaded in Studio!');
  }

  await browser.close();
  console.log('🎬 Autonomous Video Agent task complete!');
}

run().catch((err) => {
  console.error('❌ Autonomous Video Agent failed:', err);
  process.exit(1);
});
