import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { fitSiteShadow, SITE_SHADOW_BIAS, SITE_SHADOW_MAP_SIZE, SITE_SHADOW_NORMAL_BIAS } from "@/lib/twin/shadows";

describe("site shadows", () => {
  it("starts normal bias at the requested 0.02", () => {
    expect(SITE_SHADOW_NORMAL_BIAS).toBe(0.02);
  });
  it("uses the requested -0.0005 depth bias", () => {
    expect(SITE_SHADOW_BIAS).toBe(-0.0005);
  });
  it("keeps the shadow map at 2048", () => {
    expect(SITE_SHADOW_MAP_SIZE).toBe(2048);
  });
  it("encloses every transformed building, including hidden floors, with tight depth bounds", () => {
    const parent = new THREE.Group();
    parent.position.set(20, 35, -12);
    parent.rotation.y = 0.6;
    parent.scale.setScalar(2);
    const root = new THREE.Group();
    parent.add(root);
    for (const x of [-25, 25]) {
      const building = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 15));
      building.position.set(x, 10, 0);
      building.visible = x < 0;
      root.add(building);
    }
    const light = new THREE.DirectionalLight();
    fitSiteShadow(light, root);
    const box = new THREE.Box3().setFromObject(root);
    const camera = light.shadow.camera;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const point = new THREE.Vector3(x, y, z).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(1);
          expect(Math.abs(point.y)).toBeLessThan(1);
          expect(Math.abs(point.z)).toBeLessThan(1);
        }
      }
    }
    expect(camera.near).toBeGreaterThanOrEqual(0.1);
    expect(camera.far - camera.near).toBeLessThan(box.getSize(new THREE.Vector3()).length() * 1.1);
  });
});