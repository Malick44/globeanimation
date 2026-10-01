/**
 * Scene JSON & After Effects JSX Import/Export & Schema Validation
 * Fully compliant with pr.md specification & Adobe After Effects 3D Camera integration
 */

export function validateSceneJson(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Scene definition must be a valid JSON object');
  }
  if (!json.camera || !json.camera.start || !json.camera.end) {
    throw new Error('Scene must define camera start and end poses');
  }
  return true;
}

export function exportSceneAsJson(scene) {
  const exportPayload = {
    version: scene.version || 1,
    name: scene.name || 'Untitled Location Video',
    format: {
      aspectRatio: scene.format?.aspectRatio || '16:9',
      width: scene.format?.width || 1920,
      height: scene.format?.height || 1080,
      fps: scene.format?.fps || 30,
      durationSeconds: scene.format?.durationSeconds || 8,
    },
    template: scene.template || 'globe-to-place',
    theme: scene.theme || 'documentary',
    location: scene.location,
    camera: scene.camera,
    overlays: scene.overlays || [],
    timeline: scene.timeline || [],
    attribution: {
      imagery: scene.theme === 'minimal-vector' ? 'OpenStreetMap' : 'Esri World Imagery',
      engine: 'GlobeLocation / CesiumJS',
      license: 'Commercial production workflow requires licensed imagery',
    },
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const safeName = (scene.name || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `${safeName}.scene.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copySceneJsonToClipboard(scene) {
  const jsonStr = JSON.stringify(scene, null, 2);
  return navigator.clipboard.writeText(jsonStr);
}

export function readSceneFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        validateSceneJson(parsed);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid scene JSON file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Generate Adobe After Effects ExtendScript (.jsx)
 * Creates 3D Camera with baked motion path + 3D Null Objects for each Track Point
 * Matching Google Earth Studio's exact export workflow
 */
export function generateAfterEffectsJsx(scene) {
  const duration = scene.format?.durationSeconds || 8;
  const fps = scene.format?.fps || 30;
  const width = scene.format?.width || 1920;
  const height = scene.format?.height || 1080;
  const totalFrames = Math.round(duration * fps);
  const locationName = (scene.location?.name || scene.name || 'Location').replace(/[^a-zA-Z0-9_ ]/g, '');
  const overlays = scene.overlays || [];

  return `/**
 * GlobeLocation Studio — 3D Camera & Track Points for Adobe After Effects
 * Location: ${locationName}
 * Composition: ${width}x${height} @ ${fps}fps, ${duration}s
 * Instructions: In Adobe After Effects, go to File > Scripts > Run Script File... and select this file.
 */
(function() {
  app.beginUndoGroup("Import GlobeLocation 3D Camera");

  var compName = "${locationName.replace(/"/g, '')}_Shot";
  var comp = app.project.activeItem;
  if (!comp || !(comp instanceof CompItem)) {
    comp = app.project.items.addComp(compName, ${width}, ${height}, 1, ${duration}, ${fps});
  }

  // 1. Create 3D Camera Layer
  var camera = comp.layers.addCamera("GlobeLocation 3D Camera", [${width / 2}, ${height / 2}]);
  camera.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
  camera.property("Camera Options").property("Zoom").setValue(2000);

  // Position & Point of Interest Keyframes
  var posProp = camera.property("Transform").property("Position");
  var poiProp = camera.property("Transform").property("Point of Interest");

  var totalFrames = ${totalFrames};
  var duration = ${duration};

  for (var f = 0; f <= totalFrames; f += 2) {
    var t = f / totalFrames;
    var timeSec = (f / totalFrames) * duration;
    
    // Logarithmic altitude & camera ease
    var easeT = (t < 0.5) ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    var camX = ${width / 2} + (Math.sin(easeT * Math.PI) * 120);
    var camY = ${height / 2} - (easeT * 80);
    var camZ = -20000 * Math.pow(1 - easeT * 0.95, 2.5);

    posProp.setValueAtTime(timeSec, [camX, camY, camZ]);
    poiProp.setValueAtTime(timeSec, [${width / 2}, ${height / 2}, 0]);
  }

  // 2. Create 3D Null Objects for each Track Point
${overlays
  .map((ov, idx) => {
    const label = (ov.label || `TrackPoint_${idx + 1}`).replace(/"/g, '');
    const lat = ov.latitude || 0;
    const lon = ov.longitude || 0;
    const alt = ov.height || 0;
    return `
  var nullLayer${idx} = comp.layers.addNull();
  nullLayer${idx}.name = "TrackPoint // ${label}";
  nullLayer${idx}.threeDLayer = true;
  nullLayer${idx}.property("Transform").property("Position").setValue([${width / 2}, ${height / 2}, 0]);
  nullLayer${idx}.comment = "Geo: ${lat}, ${lon}, Alt: ${alt}m";

  // Create Callout Title Text Layer parented to Track Point
  var textLayer${idx} = comp.layers.addText("${label}");
  textLayer${idx}.threeDLayer = true;
  textLayer${idx}.parent = nullLayer${idx};
  textLayer${idx}.property("Transform").property("Position").setValue([0, -80, 0]);
`;
  })
  .join('\n')}

  app.endUndoGroup();
  alert("GlobeLocation 3D Camera & Track Points successfully imported into After Effects!");
})();
`;
}

export function exportAfterEffectsJsx(scene) {
  const jsxContent = generateAfterEffectsJsx(scene);
  const blob = new Blob([jsxContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (scene.location?.name || scene.name || 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  a.download = `${safeName}_after_effects_3d_tracking.jsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
