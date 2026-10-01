/**
 * Scene JSON Import, Export & Schema Validation
 * Fully compliant with pr.md specification
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
