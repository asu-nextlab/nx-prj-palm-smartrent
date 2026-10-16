import * as THREE from "three";
import { isApartment, isDevice } from "./ingest";

export const PICK_LAYER = 1;

export function isVisible(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

export function isRoof(object: THREE.Object3D): boolean {
  return Boolean(object.userData["roof"]) || /roof/i.test(object.name);
}

export function tagsOf(object: THREE.Object3D) {
  let unit: string | null = null, device: string | null = null;
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!device && isDevice(node)) device = node.name;
    if (isApartment(node)) { unit = node.name; break; }
  }
  return { unit, device };
}

/** Keep render layer zero intact; selection uses only eligible meshes on layer one. */
export function clickableMeshes(root: THREE.Object3D, focusUnit: string | null): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = [];
  root.traverse((object) => {
    object.layers.disable(PICK_LAYER);
    if (!(object as THREE.Mesh).isMesh || !isVisible(object)) return;
    for (let node: THREE.Object3D | null = object; node; node = node.parent) {
      if (isRoof(node) || node.userData["nonInteractive"] || /helper/i.test(node.name)) return;
    }
    const { unit, device } = tagsOf(object);
    // In a focused apartment, only devices take hits; walls/slabs cannot obscure them.
    if (!unit || (unit === focusUnit && !device)) return;
    object.layers.enable(PICK_LAYER);
    meshes.push(object);
  });
  return meshes;
}

export interface PointerStart { x: number; y: number; time: number; id: number; distance: number }

export function isClick(start: PointerStart | null, event: { clientX: number; clientY: number; timeStamp: number; pointerId: number }): boolean {
  return Boolean(start && start.id === event.pointerId &&
    Math.max(start.distance, Math.hypot(event.clientX - start.x, event.clientY - start.y)) < 5 &&
    event.timeStamp - start.time >= 0 && event.timeStamp - start.time < 300);
}

export function hiddenForFloor<T extends { floor: number; object_name: string }>(units: T[], floor: number | null): string[] {
  return floor === null ? [] : units.filter((unit) => unit.floor > floor).map((unit) => unit.object_name);
}

/** A roof follows the apartments in its nearest containing building/group. */
export function updateRoofs(root: THREE.Object3D, focused: THREE.Object3D | null) {
  root.traverse((roof) => {
    if (!isRoof(roof)) return;
    let owner = roof.parent;
    while (owner) {
      const apartments: THREE.Object3D[] = [];
      owner.traverse((object) => { if (isApartment(object)) apartments.push(object); });
      if (apartments.length) {
        roof.visible = apartments.every(isVisible) && !(focused && apartments.includes(focused));
        break;
      }
      owner = owner.parent;
    }
  });
}