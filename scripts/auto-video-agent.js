#!/usr/bin/env node
/**
 * Headless CLI AI Video Agent for GlobeLocation
 * Usage:
 *   node scripts/auto-video-agent.js --prompt "Tokyo Shibuya crossing vertical reel" --output ./output/tokyo.webm
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

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
const outputPath = getArg('--output', `./output/video_${Date.now()}.webm`);
const serverUrl = getArg('--url', 'http://localhost:5173/');
const autoRender = !hasFlag('--no-render');

console.log('====================================================');
console.log('🤖 GlobeLocation Autonomous AI Video Agent');
console.log('====================================================');
console.log(`🎬 Prompt: "${prompt}"`);
console.log(`📐 Format Override: ${formatOverride || 'Auto-detect'}`);
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
        return { success: true, base64: btoa(binary), byteLength: bytes.length, scene: res.scene };
      }

      return { success: true, scene: res.scene };
    },
    prompt,
    { autoRender, formatOverride }
  );

  if (result.base64) {
    const base64Data = result.base64.includes(',') ? result.base64.split(',')[1] : result.base64;
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(path.resolve(outputPath), buffer);
    console.log(`🎉 Video saved successfully to: ${outputPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
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
