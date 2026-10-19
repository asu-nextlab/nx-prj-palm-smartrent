import * as THREE from "three";

const ZOOM = 18;
const GRID = 5; // tiles per side

export type TileUrl = (z: number, x: number, y: number) => string;
export const osmTiles: TileUrl = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
export const googleTiles = (session: string, key: string): TileUrl => (z, x, y) =>
  `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`;

/** Builds a ground texture from map tiles (OpenStreetMap by default) centred on lat/lon.
 *  Returns the texture, the plane size in metres, and the offset that places
 *  the requested coordinate at the scene origin. */
export function osmGround(lat: number, lon: number, onUpdate: () => void, tileUrl: TileUrl = osmTiles) {
  const n = 2 ** ZOOM;
  const xf = ((lon + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const tx = Math.floor(xf), ty = Math.floor(yf);

  // Prepare a canvas and canvas texture.
  const half = Math.floor(GRID / 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GRID * 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eae6df"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let loaded = 0, failed = 0;

  // Build the ground texture tile by tile.
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { ctx.drawImage(img, i * 256, j * 256, 256, 256); tex.needsUpdate = true; loaded++; onUpdate(); };
    img.onerror = () => { failed++; onUpdate(); };
    img.src = tileUrl(ZOOM, tx - half + i, ty - half + j);
  }

  const mpp = (156543.03392 * Math.cos(latR)) / n; // metres per pixel
  const size = GRID * 256 * mpp;
  const px = (xf - (tx - half)) * 256, py = (yf - (ty - half)) * 256;
  const offset: [number, number] = [size / 2 - px * mpp, size / 2 - py * mpp];
  return { tex, size, offset, status: () => ({ loaded, failed, total: GRID * GRID }) };
}
