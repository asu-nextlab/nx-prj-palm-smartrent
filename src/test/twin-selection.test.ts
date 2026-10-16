import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { clickableMeshes, hiddenForFloor, isClick, isVisible, PICK_LAYER, tagsOf, updateRoofs } from "@/lib/twin/selection";

function apartment(name: string) {
  const group = new THREE.Group();
  group.name = name;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.name = "SHELL";
  group.add(mesh);
  return { group, mesh };
}

describe("Viewer selection rules", () => {
  it("cannot raycast apartments with a hidden ancestor", () => {
    const root = new THREE.Group();
    const hidden = apartment("APT_201"), visible = apartment("APT_101");
    root.add(hidden.group, visible.group);
    hidden.group.visible = false;
    expect(isVisible(hidden.mesh)).toBe(false);
    expect(clickableMeshes(root, null)).toEqual([visible.mesh]);
    expect(hidden.mesh.layers.isEnabled(PICK_LAYER)).toBe(false);
  });

  it("requires movement below five pixels and duration below 300 milliseconds for mouse or touch", () => {
    const start = { x: 100, y: 100, time: 1000, id: 7, distance: 0 };
    expect(isClick(start, { clientX: 103, clientY: 102, timeStamp: 1299, pointerId: 7 })).toBe(true);
    expect(isClick(start, { clientX: 105, clientY: 100, timeStamp: 1100, pointerId: 7 })).toBe(false);
    expect(isClick(start, { clientX: 100, clientY: 100, timeStamp: 1300, pointerId: 7 })).toBe(false);
    expect(isClick({ ...start, distance: 20 }, { clientX: 100, clientY: 100, timeStamp: 1100, pointerId: 7 })).toBe(false);
    expect(isClick(start, { clientX: 100, clientY: 100, timeStamp: 1100, pointerId: 8 })).toBe(false);
  });

  it("selects a top-floor apartment through a rendered roof", () => {
    const root = new THREE.Group();
    const top = apartment("APT_301");
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 4));
    roof.name = "Roof"; roof.position.y = 2;
    root.add(roof, top.group); root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
    ray.layers.set(PICK_LAYER);
    const hits = ray.intersectObjects(clickableMeshes(root, null), false);
    expect(tagsOf(hits[0].object).unit).toBe("APT_301");
    expect(roof.visible).toBe(true);
    expect(roof.layers.isEnabled(0)).toBe(true);
  });

  it("cuts away higher floors across every building", () => {
    const units = [
      { object_name: "APT_A101", floor: 1, building_id: "A" },
      { object_name: "APT_A201", floor: 2, building_id: "A" },
      { object_name: "APT_B101", floor: 1, building_id: "B" },
      { object_name: "APT_B301", floor: 3, building_id: "B" },
    ];
    expect(hiddenForFloor(units, 1)).toEqual(["APT_A201", "APT_B301"]);
    expect(hiddenForFloor(units, null)).toEqual([]);
  });

  it("updates roofs independently for each building and restores them on All", () => {
    const root = new THREE.Group();
    const roofs: THREE.Object3D[] = [];
    const apartments: THREE.Object3D[] = [];
    for (const id of ["A", "B"]) {
      const building = new THREE.Group();
      const apt = apartment(`APT_${id}201`);
      const roof = new THREE.Mesh(); roof.name = "Roof";
      apt.group.visible = false;
      building.add(roof, apt.group); root.add(building);
      roofs.push(roof); apartments.push(apt.group);
    }
    updateRoofs(root, null);
    expect(roofs.map((r) => r.visible)).toEqual([false, false]);
    apartments.forEach((apt) => { apt.visible = true; });
    updateRoofs(root, null);
    expect(roofs.map((r) => r.visible)).toEqual([true, true]);
    updateRoofs(root, apartments[0]);
    expect(roofs.map((r) => r.visible)).toEqual([false, true]);
  });

  it("picks nested devices through walls and slabs without including helpers", () => {
    const root = new THREE.Group();
    const apt = apartment("APT_101");
    const device = new THREE.Group(); device.name = "DEV_tv";
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    device.add(screen); apt.group.add(device);
    const helper = new THREE.Mesh(); helper.name = "BoxHelper";
    apt.group.add(helper); root.add(apt.group); root.updateMatrixWorld(true);
    const meshes = clickableMeshes(root, "APT_101");
    expect(meshes).toEqual([screen]);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
    ray.layers.set(PICK_LAYER);
    expect(tagsOf(ray.intersectObjects(meshes, false)[0].object)).toEqual({ unit: "APT_101", device: "DEV_tv" });
    device.visible = false;
    expect(clickableMeshes(root, "APT_101")).toEqual([]);
  });
});