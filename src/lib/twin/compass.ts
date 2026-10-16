import type { Quaternion } from "three";

// Read the camera's screen-right axis, not its forward vector: screen-right
// stays horizontal for our orbit camera even when it looks directly down.
export function compassRotationDegrees({ x, y, z, w }: Quaternion): number {
  const rightX = 1 - 2 * (y * y + z * z);
  const rightZ = 2 * (x * z - w * y);
  return Math.atan2(-rightZ, rightX) * 180 / Math.PI;
}