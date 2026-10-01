The strongest direction is a web app that turns a place, route, or topic into a polished short video: globe → location → map context → labeled story scene → export-ready capture. God’s Eye View already gives you the 3D globe, cinematic camera controls, route fly-throughs, annotations, layers, and scene/tour concepts; your project should narrow those into a reliable, creator-friendly production workflow.

Project concept
A useful product framing:

Create cinematic location videos from a place, route, or short prompt.

Potential audiences:

YouTube educators and documentary creators

Travel creators and local-tourism organizations

Real-estate and neighborhood video makers

News and explainers teams

History and geography channels

SaaS companies needing “where we operate” visuals

Developers needing reusable map-intro clips for product demos

Instead of exposing every “spy console” feature, design around a simple creator workflow:

text
Enter location / paste coordinates / import route
                ↓
Choose a video template
                ↓
Set camera path, duration, labels, and visual style
                ↓
Preview the animated map shot
                ↓
Capture or render an MP4-ready video clip
                ↓
Download/share/edit in a video editor
The original project is positioned as a browser-based photorealistic 3D globe with public and third-party spatial data, plus camera tours, routes, annotations, live layers, and configurable map providers.

Best MVP
Start with a cinematic location-intro generator, not a broad real-time intelligence dashboard.

MVP templates
Template	Input	Output
Globe to Place	City, landmark, coordinates, address	5–10 sec global-to-destination animation
Place Reveal	One location	3–6 sec aerial pan/orbit/zoom
Route Flyover	Start/end points or GPX/GeoJSON	8–20 sec route animation
Multi-Stop Story	2–10 locations	Connected chapter-to-chapter map sequence
Country/Region Explainer	Country, state, polygon, boundary	Highlight, fly-in, labels, callouts
Before/After Context	Two locations or map layers	Split/story transition for explainers
The first three are enough to launch a compelling MVP.

Core controls
Search for a place or enter latitude/longitude.

Pick a template.

Select 9:16, 16:9, or 1:1 format.

Set 3–15 second duration.

Choose a visual theme:

Clean documentary

Satellite cinematic

Minimal vector/map

Dark data/explainer

Add title, subtitle, pin, boundary, and route line.

Set start/end camera framing.

Preview and export/capture.

Avoid shipping military, law-enforcement, surveillance, ALPR, public-camera, “person detection,” or real-time tracking controls as part of the initial creator product. They make the product harder to position, increase privacy and moderation risk, and are unnecessary for the core value proposition.

How to use the repository
Fork the project, then make a production-oriented layer rather than modifying every intelligence feature.

bash
git clone https://github.com/bilawalsidhu/gods-eye-view.git
cd gods-eye-view
git checkout -b creator-video-mvp
npm ci
npm run dev
The upstream project uses a Vite/CesiumJS-style browser architecture and separates core world/scene code, map provider logic, layers/data modules, UI, and camera/voice-oriented capabilities. It includes documented support for Scene Director camera tours, annotations, shareable scenes, routes, and multiple map stacks.

Keep
Cesium globe and camera logic

Terrain and imagery provider abstraction

Search / geocoding workflow

Scene Director / tour logic

Route geometry and route fly-through logic

Annotation/pin/line/polygon tools

Scene export/import concept

Day/night, atmosphere, and visual-quality controls

Remove or hide for MVP
Intelligence-console UI and dense HUD components

Surveillance-themed language and labels

Aircraft/ship tracking by default

CCTV streams

License-plate / people-detection-related UI

Police/EMS layers

Live news and potentially restricted source layers

Authentication/key screens unrelated to creator output

Voice control, unless voice-directed scene creation is central to your product

Add
Creator-centric scene templates

Brand/theme editor

Safe title and annotation layouts

Vertical/horizontal framing guides

Shot duration and easing controls

Scene presets

Project dashboard

Export queue/status

Billing/credits only after output is reliable

Source/attribution manifest per video

Architecture
A pragmatic architecture for the new project:

text
Frontend
  React / Next.js or Vite + React
  CesiumJS globe renderer
  God’s Eye View camera and layer concepts
  Template editor and preview

Backend API
  Node.js / TypeScript
  Project storage
  Scene JSON validation
  Export-job management
  Signed asset uploads

Worker / renderer
  Playwright or Puppeteer
  Chromium with GPU/WebGL support
  Deterministic scene player
  FFmpeg encoding
  Object storage for resulting MP4/WebM assets

Storage
  Postgres: users, projects, scenes, render jobs
  S3/R2: scene assets, thumbnails, rendered files
  Redis/queue: render task queue

Providers
  Licensed map/imagery provider
  Geocoder
  Optional route provider
Critical design decision: preview vs. render
There are two ways to ship it:

Approach	How it works	Ideal use
Client-side capture	User previews in browser and records/downloads locally	Free tool, early MVP, lower infrastructure cost
Server-side rendering	A worker opens a saved scene and renders a video automatically	Paid SaaS, repeatable MP4 exports, batch generation
Hybrid	Free browser preview; paid cloud-render/export credits	Most practical product path
For a first release, I recommend hybrid:

Let users create and preview scenes locally.

Let them save a JSON scene definition.

Use a server renderer only when they click “Render MP4.”

Make export a paid credit, because GPU/browser rendering has real infrastructure cost.

The upstream project’s scene/tour functions are valuable for preview and camera-path authoring, but you should build and test a deterministic renderer separately. Treat web capture as a rendering product problem—not a feature you assume will work just because a scene animates in Chrome.

Scene format
Make the project portable with a simple scene JSON format. This lets you render, re-edit, clone templates, and run batch jobs.

json
{
  "version": 1,
  "name": "Fairfield location intro",
  "format": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "durationSeconds": 8
  },
  "theme": "documentary",
  "camera": {
    "start": {
      "longitude": -20,
      "latitude": 25,
      "height": 18000000,
      "heading": 0,
      "pitch": -80
    },
    "end": {
      "longitude": -122.039,
      "latitude": 38.249,
      "height": 2400,
      "heading": 15,
      "pitch": -40
    },
    "easing": "cubicInOut"
  },
  "overlays": [
    {
      "type": "pin",
      "longitude": -122.039,
      "latitude": 38.249,
      "label": "Fairfield, California"
    }
  ],
  "timeline": [
    {
      "at": 6.2,
      "action": "showTitle",
      "text": "Fairfield, California"
    }
  ]
}
Do not depend on raw click recordings or arbitrary browser state. Save normalized camera coordinates, explicit layers, exact timing, and content-owned overlays.

Video renderer plan
For a cloud-rendered project, create a dedicated /render mode that does the following:

Loads one saved scene JSON.

Loads only approved/required imagery and layers.

Hides editing controls and nonessential UI.

Waits for Cesium tiles/terrain to reach a defined ready condition.

Starts the camera timeline at frame zero.

Captures at a fixed viewport, frame rate, and duration.

Encodes images/frames to MP4 with FFmpeg.

Saves the rendered file, thumbnail, project manifest, and provider credits.

A browser/video export service will need robust handling for:

WebGL/GPU availability in workers

Tile and terrain loading delays

External-provider quota errors

Headless Chrome rendering inconsistencies

Fixed fonts and title layout

Attribution requirements

Missing imagery/data fallback

Render retries and job timeouts

For early development, use a local browser plus OBS screen capture. Once your camera paths, templates, and scene JSON are stable, invest in reliable automated rendering.

Licensing strategy
The code’s MIT license is a good foundation, but it does not grant you commercial reuse rights for the map imagery, 3D tiles, live data, external feeds, or bundled datasets. The project’s data-source documentation specifically notes that providers have their own licenses, attribution terms, API limits, and restrictions.

For a creator-facing commercial product:

Asset/data type	Safer MVP strategy
Globe, code, camera behavior	Use the MIT-licensed code concepts/fork subject to upstream license obligations
Base map / imagery	Use your own properly licensed commercial provider account
Terrain / 3D cities	Confirm commercial render/export rights before enabling
OpenStreetMap-derived map data	Observe OpenStreetMap attribution and ODbL obligations where applicable
Third-party tiles	Do not proxy/cache/repackage unless the provider permits it
Live aircraft, ships, CCTV, news	Exclude from MVP until you have clear commercial rights
User GPX, GeoJSON, custom markers	Store securely; make user ownership and deletion clear
Exported videos	Embed/retain required attribution and produce a source manifest
Do not use a free/personal Cesium, Google, or data provider pathway as the commercial rendering backend without confirming its current terms. The repo notes separate licensing concerns for Google map content, Cesium access, OpenSky data, Google News RSS, CCTV feeds, and some bundled datasets.

Monetization
A straightforward model:

Plan	Customer	What they receive
Free	Evaluators / hobby creators	Watermarked preview, limited resolution, 3 scenes/month
Creator	YouTubers / educators	HD/4K exports, templates, commercial-use workflow, saved projects
Pro	Agencies / production teams	More render credits, brand kits, shared libraries, batch export
API / Enterprise	Platforms and large teams	JSON scene API, white-label, dedicated rendering and provider setup
Make renders, not editing, the meter. Users understand video-render credits, and it maps directly to your GPU/compute/provider costs.

First 30-day build order
Week 1: Make a clean fork
Run the repo locally.

Identify the camera, scene, route, annotation, and map-provider code paths.

Remove or disable intelligence/surveillance-oriented panels.

Add a simplified Creator mode with one globe and one location search box.

Create a “Globe to Place” test template.

Week 2: Build the editor
Add location search and coordinate selection.

Add format presets: 1920×1080, 1080×1920, 1080×1080.

Add duration, camera easing, title, pin, and route controls.

Save/load your own scene JSON.

Add a clean preview/full-screen recording mode.

Week 3: Validate export
Capture 20–30 manually generated clips with OBS.

Test desktop Chrome/Edge and a range of GPU hardware.

Edit several final examples in DaVinci Resolve.

Identify camera speed, loading, title-safe-area, and attribution issues.

Decide whether cloud rendering produces quality users will pay for.

Week 4: Automate one render path
Build a server endpoint that accepts validated scene JSON.

Build one worker that renders a single 1080p scene.

Produce a thumbnail and MP4.

Add a render status page.

Log provider usage and credits.

Test failure/retry handling before accepting payments.

Product positioning
Avoid positioning it as “spy satellite software.” The codebase’s original framing is intentionally provocative, but a creator product should feel useful, legal, professional, and approachable.

Better positioning options:

Cinematic map videos, generated from places and routes

Turn any location into an animated story

Professional globe-to-location animations for video creators

Map motion graphics without After Effects

Create geographic explainers in minutes

A concise MVP landing-page promise:

Enter a location. Choose a style. Create a cinematic map video.

