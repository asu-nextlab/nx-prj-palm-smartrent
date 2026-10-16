import { Vector3 } from "three";

/** Recenter without changing the camera's current orbit direction. */
export function apartmentFocusPosition(position: Vector3, target: Vector3, center: Vector3, distance: number): Vector3 {
  const direction = position.clone().sub(target);
  // A coincident camera/target has no direction; keep the fallback vertical.
  if (direction.lengthSq() === 0) direction.set(0, 1, 0);
  return center.clone().addScaledVector(direction.normalize(), distance);
}