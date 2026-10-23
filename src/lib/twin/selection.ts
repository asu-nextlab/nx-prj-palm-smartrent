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

/** The focused apartment's own walls, floors and furniture. They never take a pick themselves,
 *  but a click that lands on them stays in the apartment instead of passing through to the
 *  apartment below (or the ground). Call after clickableMeshes, which resets the pick layer. */
export function focusedBlockers(root: THREE.Object3D, focusUnit: string | null): THREE.Object3D[] {
  const focused = focusUnit ? root.getObjectByName(focusUnit) : undefined;
  if (!focused || !isVisible(focused)) return [];
  const meshes: THREE.Object3D[] = [];
  focused.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh || !isVisible(object) || tagsOf(object).device) return;
    object.layers.enable(PICK_LAYER);
    meshes.push(object);
  });
  return meshes;
}

/** What a click selects, from the nearest clickable hit and the nearest hit on the focused
 *  apartment's own geometry. Its devices always win; otherwise a closer hit on the apartment
 *  itself keeps it selected and clears the device. */
export function resolvePick(
  hit: { object: THREE.Object3D; distance: number } | undefined,
  blocker: { distance: number } | undefined,
  focusUnit: string | null,
): { unit: string | null; device: string | null } {
  const tags = hit ? tagsOf(hit.object) : { unit: null, device: null };
  if (focusUnit && tags.unit === focusUnit && tags.device) return tags;
  if (focusUnit && blocker && (!hit || blocker.distance <= hit.distance)) return { unit: focusUnit, device: null };
  return tags;
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