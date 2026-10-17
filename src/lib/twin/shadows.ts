import * as THREE from "three";

export const SITE_SHADOW_NORMAL_BIAS = 0.02;
export const SITE_SHADOW_BIAS = -0.0005;
export const SITE_SHADOW_MAP_SIZE = 2048;
const LIGHT_DIRECTION = new THREE.Vector3(60, 90, 40).normalize();

/** Fit in light space, including all buildings even when a floor is hidden. */
export function fitSiteShadow(light: THREE.DirectionalLight, root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const margin = Math.max(0.5, radius * 0.05);
  light.position.copy(center).addScaledVector(LIGHT_DIRECTION, radius + margin + 1);
  light.target.position.copy(center);
  light.target.updateMatrixWorld(true);
  light.updateMatrixWorld(true);
  light.shadow.updateMatrices(light);
  const camera = light.shadow.camera;
  const projected = new THREE.Box3();
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
      }
    }
  }
  camera.left = projected.min.x - margin;
  camera.right = projected.max.x + margin;
  camera.bottom = projected.min.y - margin;
  camera.top = projected.max.y + margin;
  camera.near = Math.max(0.1, -projected.max.z - margin);
  camera.far = Math.max(camera.near + 0.1, -projected.min.z + margin);
  camera.updateProjectionMatrix();
  light.shadow.needsUpdate = true;
}