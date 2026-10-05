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
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer',
    {
      credit: 'Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community',
      enablePickFeatures: false,
    }
  );
}

/**
 * Public-domain imagery for documentary use, selected by a scene's `imagery` key
 * (it overrides the theme's imagery). Each entry has the credit to print with the render.
 */
export const DOCUMENTARY_IMAGERY = {
  // Natural Earth II shaded relief, bundled with Cesium: the whole globe, offline, public domain
  naturalearth: {
    credit: 'Natural Earth II (public domain)',
    layers: () => [Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'))],
  },
  // USGS National Map orthoimagery (USDA NAIP at close range) over Natural Earth II: United States only
  usgs: {
    credit: 'USDA, USGS The National Map: Orthoimagery (public domain); Natural Earth II (public domain)',
    layers: () => [
      Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')),
      Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
        { enablePickFeatures: false }
      ),
    ],
  },
};

/**
 * Replace the imagery with one of DOCUMENTARY_IMAGERY; resolves once every layer is added
 */
export async function applyDocumentaryImagery(viewer, key) {
  const entry = DOCUMENTARY_IMAGERY[key];
  if (!entry) throw new Error(`Unknown imagery "${key}" (have ${Object.keys(DOCUMENTARY_IMAGERY).join(', ')})`);
  const providers = await Promise.all(entry.layers());
  if (viewer.isDestroyed()) return entry.credit;
  viewer.imageryLayers.removeAll();
  for (const provider of providers) viewer.imageryLayers.addImageryProvider(provider);
  return entry.credit;
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
      providerPromise = createCartoDarkProvider();
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
