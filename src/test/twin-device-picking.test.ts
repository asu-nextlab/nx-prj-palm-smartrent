import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildInterior, buildSampleSite } from "@/lib/twin/build";
import { layoutOf, LAYOUTS, type LayoutId } from "@/lib/twin/templates";
import { clickableMeshes, focusedBlockers, isVisible, PICK_LAYER, resolvePick } from "@/lib/twin/selection";
import { apartmentFocusPosition } from "@/lib/twin/camera-focus";

// Two floors of 3 × 2 apartments; focus one the way the viewer does (interior added, shell hidden,
// floors above hidden) and click every device that is actually visible under the cursor.
function focusedSite(layout: LayoutId, focus: string) {
  const units = [];
  for (let floor = 1; floor <= 2; floor++) for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) {
    units.push({ object_name: `APT_${floor}${col}${row}`, building_id: "b", floor, col, row, layout });
  }
  const site = buildSampleSite([{ id: "b", name: "B", x: 0, z: 0, rotation: 0, floors: 2, cols: 3, rows: 2, layout, color: "sand" }], units);
  const apt = site.getObjectByName(focus)!;
  apt.add(buildInterior(layoutOf(layout)));
  apt.children.forEach((c) => { if (/^SHELL|^Window/.test(c.name)) c.visible = false; });
  const floor = units.find((u) => u.object_name === focus)!.floor;
  for (const u of units) site.getObjectByName(u.object_name)!.visible = u.floor <= floor;
  site.traverse((o) => { if (/roof/i.test(o.name)) o.visible = false; });
  site.updateMatrixWorld(true);
  return { site, apt };
}

describe("Device picking in a focused sample apartment", () => {
  for (const layout of Object.keys(LAYOUTS) as LayoutId[]) {
    it(`picks every visible ${layout} device from eight orbit angles`, () => {
      for (const focus of ["APT_110", "APT_210"]) {
        const { site, apt } = focusedSite(layout, focus);
        const visibleMeshes: THREE.Object3D[] = [];
        site.traverse((o) => { if ((o as THREE.Mesh).isMesh && isVisible(o)) visibleMeshes.push(o); });
        const box = new THREE.Box3().setFromObject(apt), center = box.getCenter(new THREE.Vector3());
        const distance = Math.max(8, box.getSize(new THREE.Vector3()).length() * 0.9) * Math.hypot(0.7, 0.75, 0.9);
        let checked = 0;
        for (let deg = 0; deg < 360; deg += 45) {
          const a = THREE.MathUtils.degToRad(deg);
          const camera = apartmentFocusPosition(center.clone().add(new THREE.Vector3(Math.sin(a), 1, Math.cos(a))), center, center, distance);
          for (const { obj } of layoutOf(layout).devices) {
            const device = apt.getObjectByName(obj)!;
            const dir = new THREE.Box3().setFromObject(device).getCenter(new THREE.Vector3()).sub(camera).normalize();
            if (new THREE.Raycaster(camera, dir).intersectObjects(visibleMeshes, false)[0]?.object !== device) continue;
            const ray = new THREE.Raycaster(camera, dir);
            ray.layers.set(PICK_LAYER);
            const hit = ray.intersectObjects(clickableMeshes(site, focus), false)[0];
            const blocker = ray.intersectObjects(focusedBlockers(site, focus), false)[0];
            expect(resolvePick(hit, blocker, focus), `${obj} at ${deg}°`).toEqual({ unit: focus, device: obj });
            checked++;
          }
        }
        expect(checked).toBeGreaterThan(20);
      }
    });
  }
});
