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
 * Open imagery for documentary use, selected by a scene's `imagery` key (it overrides the theme's).
 * Layers stack bottom to top. Every source is public domain or CC BY (commercial use allowed with
 * credit); the credit comes back from applyDocumentaryImagery so the render can print it.
 */
const naturalEarth = () => ({
  credit: 'Natural Earth II (public domain)',
  provider: Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')),
});
// NASA Blue Marble: Next Generation (500 m, true colour), NASA GIBS, to web-mercator zoom 8
const blueMarble = () => ({
  credit: 'NASA Blue Marble: Next Generation, via NASA GIBS (public domain)',
  provider: new Cesium.UrlTemplateImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 8,
  }),
});
// ESA WorldCover 2021 Sentinel-2 true-colour composite: global, cloud-free, 10 m. CC BY 4.0.
// Shown from geographic level 3, where it is sharper than Blue Marble
const sentinel2 = () => ({
  credit: 'ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0)',
  provider: new Cesium.UrlTemplateImageryProvider({
    url: 'https://mapproxy.terrascope.be/mapproxy/wmts/esa-worldcover-s2rgbnir-10m-2021-v2_tcc/webmercator/{z}/{x}/{y}.png',
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 15,
  }),
  options: { minimumTerrainLevel: 3 },
});
// USGS National Map orthoimagery: USDA NAIP (0.6-1 m) up close, United States only. Its own
// small-scale imagery is coarse, so it shows only very close (geographic level 13 and deeper)
const usgsOrtho = () => ({
  credit: 'USDA, USGS The National Map: Orthoimagery (public domain)',
  provider: Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
    { enablePickFeatures: false }
  ),
  options: { minimumTerrainLevel: 13 },
});
// NASA Black Marble (VIIRS 2016) city lights, drawn only on the night side of the globe
const blackMarble = () => ({
  credit: 'NASA Black Marble 2016, via NASA GIBS (public domain)',
  provider: new Cesium.UrlTemplateImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 8,
  }),
  // only from altitude: at 500 m a pixel, close up the lights are blurred glows over the ground
  options: { dayAlpha: 0.0, nightAlpha: 1.0, brightness: 1.6, maximumTerrainLevel: 6 },
});

export const DOCUMENTARY_IMAGERY = {
  // Offline: Natural Earth II only (soft up close)
  naturalearth: () => [naturalEarth()],
  // The whole globe, sharp to regional scale. No Natural Earth under it: its blue Arctic would show
  // as a disc past the web-mercator limit (85 degrees); the globe's ice-coloured base fills the poles
  bluemarble: () => [blueMarble()],
  // The whole globe, sharp to a few hundred metres up anywhere on land (the default for documentaries)
  sentinel2: () => [blueMarble(), sentinel2()],
  // sentinel2 plus USDA NAIP for the last few kilometres over the United States
  usgs: () => [blueMarble(), sentinel2(), usgsOrtho()],
};

/**
 * Replace the imagery with one of DOCUMENTARY_IMAGERY, plus optional relief shading and night lights.
 * Resolves to the combined credit once every layer is on the globe.
 *   look: {hillshade: {azimuth, altitude, exaggeration, alpha} | false, nightLights: true | false}
 */
export async function applyDocumentaryImagery(viewer, key, look = {}) {
  const make = DOCUMENTARY_IMAGERY[key];
  if (!make) throw new Error(`Unknown imagery "${key}" (have ${Object.keys(DOCUMENTARY_IMAGERY).join(', ')})`);
  const layers = make();
  if (look.hillshade) {
    const { createHillshadeImageryProvider, TERRAIN_CREDIT } = await import('./terrainProvider.js');
    layers.push({
      credit: TERRAIN_CREDIT,
      provider: createHillshadeImageryProvider(look.hillshade),
      options: { alpha: look.hillshade.alpha ?? 0.85 },
    });
  }
  if (look.nightLights) layers.push(blackMarble());
  const providers = await Promise.all(layers.map((l) => l.provider));
  const credit = [...new Set(layers.map((l) => l.credit))].join('; ');
  if (viewer.isDestroyed()) return credit;
  viewer.imageryLayers.removeAll();
  providers.forEach((provider, i) => viewer.imageryLayers.add(new Cesium.ImageryLayer(provider, layers[i].options || {})));
  return credit;
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
