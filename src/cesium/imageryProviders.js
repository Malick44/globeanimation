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
 * (it overrides the theme's imagery). Layers stack bottom to top; each entry has the credit to print
 * with the render.
 */
const naturalEarth = () => ({
  provider: Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')),
});
// NASA Blue Marble: Next Generation (500 m, true colour) from NASA GIBS, to web-mercator zoom 8
const blueMarble = () => ({
  provider: new Cesium.UrlTemplateImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 8,
  }),
});
// USGS National Map orthoimagery: USDA NAIP up close. Its own small-scale imagery is coarse and brown,
// so the layer only shows once NAIP takes over (from geographic level 9)
const usgsOrtho = () => ({
  provider: Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
    { enablePickFeatures: false }
  ),
  options: { minimumTerrainLevel: 9 },
});

export const DOCUMENTARY_IMAGERY = {
  // Natural Earth II shaded relief, bundled with Cesium: the whole globe, offline, soft up close
  naturalearth: {
    credit: 'Natural Earth II (public domain)',
    layers: () => [naturalEarth()],
  },
  // Blue Marble over Natural Earth II: the whole globe, sharp to regional scale
  bluemarble: {
    credit: 'NASA Blue Marble: Next Generation, via NASA GIBS (public domain); Natural Earth II (public domain)',
    layers: () => [naturalEarth(), blueMarble()],
  },
  // NAIP up close over Blue Marble and Natural Earth II: United States only at close range
  usgs: {
    credit: 'USDA, USGS The National Map: Orthoimagery (public domain); NASA Blue Marble: Next Generation, via NASA GIBS (public domain); Natural Earth II (public domain)',
    layers: () => [naturalEarth(), blueMarble(), usgsOrtho()],
  },
};

/**
 * Replace the imagery with one of DOCUMENTARY_IMAGERY; resolves to its credit once every layer is added
 */
export async function applyDocumentaryImagery(viewer, key) {
  const entry = DOCUMENTARY_IMAGERY[key];
  if (!entry) throw new Error(`Unknown imagery "${key}" (have ${Object.keys(DOCUMENTARY_IMAGERY).join(', ')})`);
  const layers = entry.layers();
  const providers = await Promise.all(layers.map((l) => l.provider));
  if (viewer.isDestroyed()) return entry.credit;
  viewer.imageryLayers.removeAll();
  providers.forEach((provider, i) => viewer.imageryLayers.add(new Cesium.ImageryLayer(provider, layers[i].options || {})));
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
