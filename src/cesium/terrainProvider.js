/**
 * Open terrain for documentary renders: AWS Terrain Tiles (Terrarium PNG, open data from USGS 3DEP,
 * SRTM, GMTED2010 and ETOPO1; no key). Two consumers share one decoded-tile cache:
 *
 *  - createTerrariumTerrainProvider(): real elevation for the globe surface (a heightmap terrain).
 *  - createHillshadeImageryProvider(): a hillshade layer drawn from the same tiles. Cesium does not light
 *    heightmap terrain (no vertex normals), so relief is shaded in imagery instead: shadow as translucent
 *    black, lit slopes as faint white, flat ground transparent.
 */
import * as Cesium from 'cesium';

export const TERRAIN_CREDIT =
  'Terrain: AWS Terrain Tiles (USGS 3DEP, SRTM, GMTED2010, ETOPO1; open data)';
const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const MAX_Z = 14;
const CACHE_LIMIT = 600;
const cache = new Map(); // "z/x/y" -> Promise<Float32Array | null>

async function decode(z, x, y) {
  const url = TERRARIUM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const out = new Float32Array(bmp.width * bmp.height);
    for (let i = 0; i < out.length; i++) {
      out[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
    }
    return out;
  } catch {
    return null;
  }
}

function tile(z, x, y) {
  const n = 2 ** z;
  x = ((x % n) + n) % n;
  y = Math.max(0, Math.min(n - 1, y));
  const key = `${z}/${x}/${y}`;
  if (!cache.has(key)) {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, decode(z, x, y));
  }
  return cache.get(key);
}

/** Fractional web-mercator tile coordinates of a lon/lat at zoom z */
function mercator(lon, lat, z) {
  const n = 2 ** z;
  const la = Math.max(-85.05, Math.min(85.05, lat)) * (Math.PI / 180);
  return [((lon + 180) / 360) * n, ((1 - Math.asinh(Math.tan(la)) / Math.PI) / 2) * n];
}

/** Bilinear elevation (m) at lon/lat from zoom-z tiles that are already decoded */
function sample(tiles, z, lon, lat) {
  const [fx, fy] = mercator(lon, lat, z);
  const px = fx * 256 - 0.5;
  const py = fy * 256 - 0.5;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const at = (X, Y) => {
    const tx = Math.floor(X / 256);
    const ty = Math.floor(Y / 256);
    const t = tiles.get(`${tx}/${ty}`);
    if (!t) return 0;
    return t[(Y - ty * 256) * 256 + (X - tx * 256)];
  };
  const dx = px - x0;
  const dy = py - y0;
  return (
    at(x0, y0) * (1 - dx) * (1 - dy) +
    at(x0 + 1, y0) * dx * (1 - dy) +
    at(x0, y0 + 1) * (1 - dx) * dy +
    at(x0 + 1, y0 + 1) * dx * dy
  );
}

async function tilesFor(z, west, south, east, north) {
  const [x0, y0] = mercator(west, north, z).map(Math.floor);
  const [x1, y1] = mercator(east, south, z).map(Math.floor);
  const n = 2 ** z;
  const tiles = new Map();
  const jobs = [];
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    for (let y = Math.max(0, y0 - 1); y <= Math.min(n - 1, y1 + 1); y++) {
      jobs.push(tile(z, x, y).then((t) => t && tiles.set(`${x}/${y}`, t)));
    }
  }
  await Promise.all(jobs);
  return tiles;
}

/**
 * Real elevation for the globe. Sea-floor depths are clamped to sea level, so oceans stay flat under
 * vertical exaggeration.
 */
export function createTerrariumTerrainProvider() {
  const size = 65;
  const scheme = new Cesium.GeographicTilingScheme();
  return new Cesium.CustomHeightmapTerrainProvider({
    width: size,
    height: size,
    tilingScheme: scheme,
    credit: TERRAIN_CREDIT,
    callback: async (x, y, level) => {
      const r = scheme.tileXYToRectangle(x, y, level);
      const [w, s, e, n] = [r.west, r.south, r.east, r.north].map(Cesium.Math.toDegrees);
      const z = Math.max(0, Math.min(MAX_Z, level + 1));
      const tiles = await tilesFor(z, w, s, e, n);
      const out = new Float32Array(size * size);
      for (let row = 0; row < size; row++) {
        const lat = n - ((n - s) * row) / (size - 1);
        for (let col = 0; col < size; col++) {
          const lon = w + ((e - w) * col) / (size - 1);
          out[row * size + col] = Math.max(0, sample(tiles, z, lon, lat));
        }
      }
      return out;
    },
  });
}

/**
 * Hillshade imagery from the same tiles, lit from `azimuth` (degrees clockwise from north) at `altitude`
 * degrees. `exaggeration` steepens the slopes so low relief (prairie, badlands) still reads.
 */
export function createHillshadeImageryProvider({ azimuth = 315, altitude = 40, exaggeration = 2.5 } = {}) {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: TERRARIUM_URL,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: MAX_Z,
    credit: TERRAIN_CREDIT,
  });
  const az = Cesium.Math.toRadians(360 - azimuth + 90);
  const zen = Cesium.Math.toRadians(90 - altitude);
  const flat = Math.cos(zen);
  provider.requestImage = async (x, y, level) => {
    const t = await tile(level, x, y);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    if (!t) return canvas;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(256, 256);
    // ground metres per pixel at this tile's latitude
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / 2 ** level)));
    const res = (40075016.7 * Math.cos(lat)) / (256 * 2 ** level);
    const h = (i, j) => t[Math.min(255, Math.max(0, j)) * 256 + Math.min(255, Math.max(0, i))];
    for (let j = 0; j < 256; j++) {
      for (let i = 0; i < 256; i++) {
        const dzdx = ((h(i + 1, j) - h(i - 1, j)) * exaggeration) / (2 * res);
        const dzdy = ((h(i, j + 1) - h(i, j - 1)) * exaggeration) / (2 * res);
        const slope = Math.atan(Math.hypot(dzdx, dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);
        const shade = Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(az - aspect);
        const d = shade - flat; // < 0 in shadow, > 0 on lit slopes
        const k = (j * 256 + i) * 4;
        if (d < 0) {
          img.data[k + 3] = Math.min(255, -d * 420);
        } else {
          img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
          img.data[k + 3] = Math.min(110, d * 160);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  };
  return provider;
}

/**
 * Terrain height (m, before exaggeration) at a lon/lat, read from the decoded tiles at zoom z.
 * Used to put tracked points on the ground rather than on the ellipsoid.
 */
export async function terrainHeight(lon, lat, z = 11) {
  const tiles = await tilesFor(z, lon, lat, lon, lat);
  return Math.max(0, sample(tiles, z, lon, lat));
}
