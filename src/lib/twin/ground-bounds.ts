import { Box3, Vector3 } from "three";

export const MAP_ZOOM = 18;
export const MAP_GRID = 5;
export const SIMPLE_GROUND_RADIUS = 220;

/** Shared footprint for the rendered tiled ground and camera boundary. */
export function mapGroundFootprint(lat: number, lon: number) {
  const n = 2 ** MAP_ZOOM;
  const xf = ((lon + 180) / 360) * n;
  const latR = lat * Math.PI / 180;
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  const tx = Math.floor(xf), ty = Math.floor(yf);
  const half = Math.floor(MAP_GRID / 2);
  const mpp = 156543.03392 * Math.cos(latR) / n;
  const size = MAP_GRID * 256 * mpp;
  const px = (xf - (tx - half)) * 256, py = (yf - (ty - half)) * 256;
  const offset: [number, number] = [size / 2 - px * mpp, size / 2 - py * mpp];
  return { tx, ty, half, size, offset };
}

/** Inset each edge by 5% of the full ground size; height stays unrestricted. */
export function groundPanBounds(size: number, offset: [number, number]): Box3 {
  const half = size * (0.5 - 0.05);
  return new Box3(new Vector3(offset[0] - half, -Infinity, offset[1] - half), new Vector3(offset[0] + half, Infinity, offset[1] + half));
}