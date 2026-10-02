/**
 * Autonomous AI Video Director Agent Engine for GlobeLocation
 * Analyzes natural language prompts, resolves geospatial coordinates,
 * choreographs 3D camera trajectories, designs visual styling & overlays,
 * and automatically produces / exports finished location videos.
 */
import { searchLocations, parseCoordinates } from '../search/geocoder.js';
import { buildCameraForTemplate, computeCameraPositionLookingAt } from '../templates.js';
import { exportVideo } from '../recorder/videoExporter.js';

// Curated geospatial landmark database for fast high-fidelity matching
const CURATED_LANDMARKS = [
  {
    keywords: ['tokyo', 'shibuya', 'japan', 'shinjuku'],
    name: 'Tokyo',
    description: 'Shibuya Crossing & Downtown • Japan',
    latitude: 35.6595,
    longitude: 139.7004,
    height: 380,
    heading: 42,
    pitch: -38,
    theme: 'dark-cyber',
    pinColor: '#06b6d4',
    idealTemplate: 'globe-to-place',
    photoUrl: null,
  },
  {
    keywords: ['new york', 'nyc', 'manhattan', 'world trade', 'one world trade', 'wall street'],
    name: 'New York City',
    description: 'Lower Manhattan & Financial District • USA',
    latitude: 40.7128,
    longitude: -74.006,
    height: 480,
    heading: 28,
    pitch: -34,
    theme: 'warm-sunset',
    pinColor: '#f59e0b',
    idealTemplate: 'globe-to-place',
    photoUrl: '/photos/nyc_ground.jpg',
    photoCaption: 'Ground Photography • Lower Manhattan',
  },
  {
    keywords: ['dubai', 'burj khalifa', 'uae', 'emirates', 'marina', 'downtown dubai'],
    name: 'Dubai',
    description: 'Burj Khalifa & Downtown • United Arab Emirates',
    latitude: 25.1972,
    longitude: 55.2744,
    height: 750,
    heading: 310,
    pitch: -28,
    theme: 'dark-cyber',
    pinColor: '#f59e0b',
    idealTemplate: 'globe-to-place',
    photoUrl: '/photos/dubai_ground.jpg',
    photoCaption: 'Ground Photography • Downtown Dubai',
  },
  {
    keywords: ['paris', 'eiffel', 'france', 'seine', 'louvre'],
    name: 'Paris',
    description: 'Eiffel Tower & Champ de Mars • France',
    latitude: 48.8584,
    longitude: 2.2945,
    height: 420,
    heading: 65,
    pitch: -32,
    theme: 'warm-sunset',
    pinColor: '#f59e0b',
    idealTemplate: 'place-reveal',
    photoUrl: null,
  },
  {
    keywords: ['rome', 'colosseum', 'italy', 'roma', 'colosseo'],
    name: 'Rome',
    description: 'The Colosseum & Roman Forum • Italy',
    latitude: 41.8902,
    longitude: 12.4922,
    height: 350,
    heading: 30,
    pitch: -36,
    theme: 'satellite',
    pinColor: '#f59e0b',
    idealTemplate: 'place-reveal',
    photoUrl: null,
  },
  {
    keywords: ['everest', 'himalayas', 'nepal', 'mountain'],
    name: 'Mount Everest',
    description: 'Khumbu Region & Sagarmatha • Himalayas, Nepal',
    latitude: 27.9881,
    longitude: 86.925,
    height: 9800,
    heading: 145,
    pitch: -24,
    theme: 'vector-blueprint',
    pinColor: '#06b6d4',
    idealTemplate: 'route-flyover',
    photoUrl: null,
  },
  {
    keywords: ['san francisco', 'golden gate', 'california', 'bay area'],
    name: 'San Francisco',
    description: 'Golden Gate Bridge & Marin Headlands • USA',
    latitude: 37.8199,
    longitude: -122.4783,
    height: 450,
    heading: 210,
    pitch: -30,
    theme: 'warm-sunset',
    pinColor: '#ef4444',
    idealTemplate: 'place-reveal',
    photoUrl: null,
  },
  {
    keywords: ['london', 'big ben', 'uk', 'england', 'thames'],
    name: 'London',
    description: 'Palace of Westminster & River Thames • United Kingdom',
    latitude: 51.5007,
    longitude: -0.1246,
    height: 320,
    heading: 80,
    pitch: -35,
    theme: 'satellite',
    pinColor: '#06b6d4',
    idealTemplate: 'globe-to-place',
    photoUrl: null,
  },
  {
    keywords: ['fuji', 'mount fuji', 'japan peak', 'volcano'],
    name: 'Mount Fuji',
    description: 'Honshu Island & Five Lakes • Japan',
    latitude: 35.3606,
    longitude: 138.7274,
    height: 4600,
    heading: 120,
    pitch: -26,
    theme: 'warm-sunset',
    pinColor: '#ef4444',
    idealTemplate: 'place-reveal',
    photoUrl: null,
  },
  {
    keywords: ['sydney', 'opera house', 'australia', 'harbour bridge'],
    name: 'Sydney',
    description: 'Sydney Opera House & Harbour • Australia',
    latitude: -33.8568,
    longitude: 151.2153,
    height: 360,
    heading: 185,
    pitch: -32,
    theme: 'satellite',
    pinColor: '#06b6d4',
    idealTemplate: 'place-reveal',
    photoUrl: null,
  },
  {
    keywords: ['cairo', 'pyramids', 'giza', 'egypt', 'sphinx'],
    name: 'Giza Necropolis',
    description: 'Great Pyramids of Giza & Sphinx • Egypt',
    latitude: 29.9792,
    longitude: 31.1342,
    height: 600,
    heading: 55,
    pitch: -35,
    theme: 'warm-sunset',
    pinColor: '#f59e0b',
    idealTemplate: 'place-reveal',
    photoUrl: null,
  },
  {
    keywords: ['rio', 'rio de janeiro', 'copacabana', 'christ the redeemer', 'brazil'],
    name: 'Rio de Janeiro',
    description: 'Christ the Redeemer & Guanabara Bay • Brazil',
    latitude: -22.9519,
    longitude: -43.2105,
    height: 850,
    heading: 95,
    pitch: -30,
    theme: 'warm-sunset',
    pinColor: '#10b981',
    idealTemplate: 'globe-to-place',
    photoUrl: null,
  },
];

export class VideoAgentEngine {
  constructor(store, globeEngine) {
    this.store = store;
    this.globeEngine = globeEngine;
  }

  /**
   * Main entry point to create a video from a prompt
   * @param {string} prompt - User natural language prompt
   * @param {Object} options - { autoRender: boolean, formatOverride: string, onProgress: Function }
   */
  async createVideoFromPrompt(prompt, options = {}) {
    const onProgress = options.onProgress || (() => {});

    onProgress({
      step: 'analyzing',
      message: `Analyzing prompt semantics: "${prompt.slice(0, 48)}${prompt.length > 48 ? '...' : ''}"`,
      progress: 0.1,
    });

    // 1. Parse prompt intent
    const parsedIntent = this.parsePromptIntent(prompt, options);

    onProgress({
      step: 'geocoding',
      message: `Resolving geospatial location for "${parsedIntent.targetQuery}"...`,
      progress: 0.3,
    });

    // 2. Resolve destination coordinates & telemetry
    const locationData = await this.resolveLocation(parsedIntent.targetQuery);

    onProgress({
      step: 'choreography',
      message: `Synthesizing 3D camera trajectory (${parsedIntent.template}) for ${locationData.name}...`,
      progress: 0.5,
    });

    // 3. Synthesize complete Scene definition
    const generatedScene = this.synthesizeScene(parsedIntent, locationData);

    onProgress({
      step: 'styling',
      message: `Applying visual theme (${generatedScene.theme}) & HUD motion overlays...`,
      progress: 0.7,
    });

    // 4. Load scene into store and sync with 3D Cesium engine
    this.store.loadScene(generatedScene);
    this.globeEngine.syncScene(this.store.scene);
    this.globeEngine.seek(this.store.scene, 0);

    onProgress({
      step: 'synthesizing',
      message: `3D Scene ready: ${generatedScene.name} (${generatedScene.format.durationSeconds}s @ ${generatedScene.format.aspectRatio})`,
      progress: 0.85,
    });

    // 5. If autoRender is requested, trigger video exporter
    if (options.autoRender) {
      const videoFormat = options.videoFormat || (parsedIntent.preferWebm ? 'webm' : 'mp4');
      onProgress({
        step: 'rendering',
        message: `Auto-rendering ${this.store.scene.format.fps || 30}FPS ${videoFormat.toUpperCase()} video clip with compositing...`,
        progress: 0.9,
      });

      const videoResult = await exportVideo(this.globeEngine, this.store.scene, { format: videoFormat }, (renderProgress) => {
        const frameNum = renderProgress.frame ?? 0;
        const total = renderProgress.totalFrames ?? 1;
        const pct = renderProgress.percent ?? Math.round((frameNum / total) * 100);
        onProgress({
          step: 'rendering',
          message: `Rendering frame ${frameNum} / ${total} (${pct}%)`,
          progress: 0.9 + (pct / 100) * 0.09,
          renderStats: renderProgress,
        });
      });

      onProgress({
        step: 'completed',
        message: `Video successfully rendered and exported! (${(videoResult.size / (1024 * 1024)).toFixed(2)} MB)`,
        progress: 1.0,
        result: videoResult,
        scene: generatedScene,
      });

      return {
        scene: generatedScene,
        video: videoResult,
      };
    }

    onProgress({
      step: 'completed',
      message: `Scene generated and ready in viewport. Press Space to play preview!`,
      progress: 1.0,
      scene: generatedScene,
    });

    return {
      scene: generatedScene,
      video: null,
    };
  }

  /**
   * Parse prompt into structured director parameters
   */
  parsePromptIntent(prompt, options = {}) {
    const text = prompt.toLowerCase();

    // 1. Aspect Ratio Detection
    let aspectRatio = '16:9';
    if (options.formatOverride) {
      aspectRatio = options.formatOverride;
    } else if (
      text.includes('9:16') ||
      text.includes('tiktok') ||
      text.includes('reel') ||
      text.includes('shorts') ||
      text.includes('vertical') ||
      text.includes('portrait')
    ) {
      aspectRatio = '9:16';
    } else if (text.includes('1:1') || text.includes('square') || text.includes('instagram post')) {
      aspectRatio = '1:1';
    }

    // 2. Duration Detection
    let durationSeconds = 8;
    const durMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b/);
    if (durMatch) {
      durationSeconds = Math.max(3, Math.min(20, parseFloat(durMatch[1])));
    } else if (text.includes('fast') || text.includes('quick') || text.includes('short')) {
      durationSeconds = 5;
    } else if (text.includes('slow') || text.includes('epic') || text.includes('cinematic tour')) {
      durationSeconds = 12;
    }

    // 3. Motion Template
    let template = 'globe-to-place';
    if (text.includes('orbit') || text.includes('reveal') || text.includes('circle') || text.includes('spin')) {
      template = 'place-reveal';
    } else if (text.includes('route') || text.includes('trail') || text.includes('flyover') || text.includes('path')) {
      template = 'route-flyover';
    } else if (text.includes('region') || text.includes('country') || text.includes('state')) {
      template = 'region-explainer';
    } else if (text.includes('dive') || text.includes('plunge') || text.includes('space') || text.includes('sky')) {
      template = 'globe-to-place';
    }

    // 4. Visual Theme
    let theme = 'satellite';
    if (text.includes('cyber') || text.includes('neon') || text.includes('night') || text.includes('matrix')) {
      theme = 'dark-cyber';
    } else if (text.includes('warm') || text.includes('sunset') || text.includes('golden') || text.includes('luxury')) {
      theme = 'warm-sunset';
    } else if (text.includes('blueprint') || text.includes('cad') || text.includes('vector') || text.includes('tech')) {
      theme = 'vector-blueprint';
    } else if (text.includes('nature') || text.includes('forest') || text.includes('green') || text.includes('emerald')) {
      theme = 'emerald-matrix';
    }

    // 5. Pin & Accent Color
    let pinColor = '#f59e0b'; // Amber default
    if (theme === 'dark-cyber') pinColor = '#06b6d4'; // Cyan
    if (theme === 'emerald-matrix') pinColor = '#10b981'; // Emerald
    if (text.includes('red') || text.includes('crimson')) pinColor = '#ef4444';
    if (text.includes('purple') || text.includes('violet')) pinColor = '#a855f7';
    if (text.includes('cyan') || text.includes('blue')) pinColor = '#06b6d4';
    if (text.includes('gold') || text.includes('yellow')) pinColor = '#f59e0b';

    // 6. Landing Frame Photo
    let includeGroundPhoto =
      text.includes('photo') ||
      text.includes('image') ||
      text.includes('picture') ||
      text.includes('street') ||
      text.includes('ground') ||
      text.includes('real location') ||
      text.includes('landing') ||
      text.includes('arrival');

    let photoTransition = 'dissolve';
    if (text.includes('zoom cut') || text.includes('match cut') || text.includes('zoom-cut')) {
      photoTransition = 'zoom-cut';
      includeGroundPhoto = true;
    } else if (text.includes('pip') || text.includes('card') || text.includes('inset')) {
      photoTransition = 'pip-card';
      includeGroundPhoto = true;
    }

    // 7. Extract Target Query
    // Remove formatting words from prompt to get clean location query
    let targetQuery = prompt
      .replace(/\b(create|make|generate|produce|a|an|the|video|reel|tiktok|shorts|clip|cinematic|epic)\b/gi, ' ')
      .replace(/\b(vertical|horizontal|widescreen|square|9:16|16:9|1:1)\b/gi, ' ')
      .replace(/\b(\d+\s*s|\d+\s*sec|\d+\s*seconds?)\b/gi, ' ')
      .replace(/\b(fast|quick|slow|orbit|reveal|flyover|dive|plunge|with|theme|gold|neon|cyberpunk|pin|photo|landing|arrival)\b/gi, ' ')
      .replace(/\b(into|showing|of|around|to|at)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!targetQuery || targetQuery.length < 2) {
      targetQuery = 'New York City';
    }

    return {
      targetQuery,
      aspectRatio,
      durationSeconds,
      template,
      theme,
      pinColor,
      includeGroundPhoto,
      photoTransition,
      rawPrompt: prompt,
    };
  }

  /**
   * Resolve location using curated landmarks or geocoder
   */
  async resolveLocation(query) {
    const q = query.toLowerCase().trim();

    // Check curated landmark database first
    const matchedLandmark = CURATED_LANDMARKS.find((lm) => {
      return lm.keywords.some((kw) => q.includes(kw) || kw.includes(q));
    });

    if (matchedLandmark) {
      return {
        ...matchedLandmark,
        source: 'curated',
      };
    }

    // Check raw coordinates
    const parsedCoords = parseCoordinates(query);
    if (parsedCoords) {
      return {
        name: parsedCoords.name,
        description: 'Custom Coordinates',
        latitude: parsedCoords.latitude,
        longitude: parsedCoords.longitude,
        height: 500,
        heading: 25,
        pitch: -34,
        source: 'coordinates',
      };
    }

    // Fall back to Nominatim live geocoding
    try {
      const results = await searchLocations(query);
      if (results && results.length > 0) {
        const top = results[0];
        return {
          name: top.name,
          description: top.description || 'Target Destination',
          latitude: top.latitude,
          longitude: top.longitude,
          height: Math.max(350, top.height || 1200),
          heading: 25,
          pitch: -34,
          source: 'nominatim',
        };
      }
    } catch (err) {
      console.warn('Live geocoding error:', err);
    }

    // Fallback default (Tokyo)
    return {
      name: query.length > 0 ? query : 'Metropolis',
      description: 'Global Landmark',
      latitude: 35.6895,
      longitude: 139.6917,
      height: 450,
      heading: 25,
      pitch: -34,
      source: 'fallback',
    };
  }

  /**
   * Synthesize full Scene JSON from parsed intent and location
   */
  synthesizeScene(intent, loc) {
    const templateId = intent.template || loc.idealTemplate || 'globe-to-place';
    const targetAlt = loc.height || 450;
    const heading = loc.heading || 25;
    const pitch = loc.pitch || -34;
    const stalkHeight = Math.max(260, targetAlt * 0.7);

    // Build camera poses
    let cameraConfig;
    if (templateId === 'place-reveal') {
      const lookAtEnd = computeCameraPositionLookingAt(loc.latitude, loc.longitude, targetAlt, heading, pitch);
      const lookAtStart = computeCameraPositionLookingAt(loc.latitude, loc.longitude, targetAlt * 3.2, heading - 75, pitch + 8);
      cameraConfig = {
        start: lookAtStart,
        end: lookAtEnd,
        easing: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        waypoints: [],
      };
    } else {
      // Globe to Place / Dive — finish far enough back that the whole pin (beacon, stalk & badge) fits in frame
      const lookAtEnd = computeCameraPositionLookingAt(loc.latitude, loc.longitude, Math.max(targetAlt, stalkHeight * 2.4), heading, pitch);
      // Start straight above the destination so it (and its pin) is centered from the very first frame,
      // then tilt into the oblique skyline shot as we descend
      cameraConfig = {
        start: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          height: 6500000, // 6500km orbital view of the globe
          heading,
          pitch: -89,
          roll: 0,
        },
        end: lookAtEnd,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        // Aim at the middle of the pin stalk so both the ground beacon and the HUD badge stay in frame
        lookAt: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          height: stalkHeight * 0.5,
        },
        waypoints: [],
      };
    }

    // Format specification
    const format = {
      aspectRatio: intent.aspectRatio,
      width: intent.aspectRatio === '9:16' ? 1080 : intent.aspectRatio === '1:1' ? 1080 : 1920,
      height: intent.aspectRatio === '9:16' ? 1920 : 1080,
      fps: 30,
      durationSeconds: intent.durationSeconds,
    };

    // 3D Overlays (HUD Pin)
    const pinColor = intent.pinColor || loc.pinColor || '#f59e0b';
    const overlays = [
      {
        id: 'pin-' + Date.now(),
        type: 'pin',
        latitude: loc.latitude,
        longitude: loc.longitude,
        height: 0,
        label: loc.name,
        sublabel: loc.description,
        color: pinColor,
        icon: 'location_on',
        pulse: true,
        stalkHeight,
      },
    ];

    // Timeline Events
    const titleAt = Math.max(1.0, intent.durationSeconds * 0.35);
    const timeline = [
      {
        id: 'title-evt-' + Date.now(),
        at: titleAt,
        action: 'showTitle',
        text: loc.name.toUpperCase(),
        subtext: `${loc.latitude.toFixed(4)}°, ${loc.longitude.toFixed(4)}° • ${loc.description}`,
        position: intent.aspectRatio === '9:16' ? 'center' : 'lower-third',
      },
    ];

    // Landing Frame (Ground Photography)
    let groundPhoto = {
      enabled: false,
      url: null,
      fileName: '',
      transition: intent.photoTransition || 'dissolve',
      durationSeconds: 1.8,
      caption: `Ground Photography • ${loc.name}`,
    };

    if (intent.includeGroundPhoto || loc.photoUrl) {
      groundPhoto = {
        enabled: true,
        url: loc.photoUrl || (loc.name.toLowerCase().includes('dubai') ? '/photos/dubai_ground.jpg' : '/photos/nyc_ground.jpg'),
        fileName: loc.photoUrl ? loc.photoUrl.split('/').pop() : 'ground_photo.jpg',
        transition: intent.photoTransition || 'dissolve',
        durationSeconds: Math.min(2.2, intent.durationSeconds * 0.3),
        caption: loc.photoCaption || `Ground Photography • ${loc.name}`,
      };
    }

    return {
      version: '1.0.0',
      name: `${loc.name} ${intent.aspectRatio === '9:16' ? 'Reel' : 'Cinematic'}`,
      description: `AI-directed video of ${loc.name} (${intent.template})`,
      template: templateId,
      theme: intent.theme || loc.theme || 'satellite',
      format,
      location: {
        name: loc.name,
        description: loc.description,
        latitude: loc.latitude,
        longitude: loc.longitude,
        height: targetAlt,
      },
      camera: cameraConfig,
      overlays,
      timeline,
      groundPhoto,
      audio: {
        enabled: true,
        volume: 0.65,
        trackId: 'cinematic-ambience',
      },
      guides: {
        show: false,
        type: intent.aspectRatio,
      },
    };
  }
}
