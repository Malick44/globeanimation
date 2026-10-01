/**
 * Imagery & Base Map Providers for GlobeLocation
 * Supports high-resolution satellite, vector OSM, and dark explainer styles
 */
import * as Cesium from 'cesium';

export function createEsriSatelliteProvider() {
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    {
      credit: 'Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
      enablePickFeatures: false,
    }
  );
}

export function createOsmProvider() {
  return new Cesium.OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/',
    credit: '© OpenStreetMap contributors',
  });
}

export function createCartoDarkProvider() {
  return new Cesium.UrlTemplateImageryProvider({
    url: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
    credit: '© CartoDB, © OpenStreetMap contributors',
  });
}

/**
 * Apply imagery based on theme
 */
export async function applyThemeImagery(viewer, themeKey) {
  if (!viewer || viewer.isDestroyed()) return;

  const imageryLayers = viewer.imageryLayers;
  imageryLayers.removeAll();

  try {
    let providerPromise;
    if (themeKey === 'minimal-vector') {
      providerPromise = Promise.resolve(createOsmProvider());
    } else if (themeKey === 'dark-data') {
      providerPromise = Promise.resolve(createCartoDarkProvider());
    } else {
      // Documentary & Satellite Cinematic default to Esri satellite
      providerPromise = createEsriSatelliteProvider();
    }

    const provider = await providerPromise;
    if (!viewer.isDestroyed()) {
      imageryLayers.addImageryProvider(provider);
    }
  } catch (err) {
    console.warn('Failed to switch imagery provider, falling back to OSM:', err);
    try {
      imageryLayers.addImageryProvider(createOsmProvider());
    } catch {}
  }
}
