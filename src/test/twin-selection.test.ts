import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { clickableMeshes, focusedBlockers, hiddenForFloor, isClick, isVisible, PICK_LAYER, resolvePick, tagsOf, updateRoofs } from "@/lib/twin/selection";

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
    const hit = hits[0];
    if (!hit) throw new Error("Top-floor apartment was not hit");
    expect(tagsOf(hit.object).unit).toBe("APT_301");
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
    updateRoofs(root, apartments[0] ?? null);
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
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) throw new Error("Device was not hit");
    expect(tagsOf(hit.object)).toEqual({ unit: "APT_101", device: "DEV_tv" });
    device.visible = false;
    expect(clickableMeshes(root, "APT_101")).toEqual([]);
  });

  describe("clicks inside a focused apartment", () => {
    // APT_201 sits on top of APT_101; APT_201 has a floor slab and a thermostat.
    function stack() {
      const root = new THREE.Group();
      const lower = apartment("APT_101"), upper = apartment("APT_201");
      upper.group.position.y = 3;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 4)); slab.name = "Floor"; slab.position.y = -1;
      const device = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3)); device.name = "DEV_thermostat"; device.position.set(1.5, 0, 0);
      upper.group.add(slab, device);
      upper.mesh.visible = false; // the shell is hidden while focused
      root.add(lower.group, upper.group); root.updateMatrixWorld(true);
      return root;
    }
    const pick = (root: THREE.Object3D, x: number) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 20, 0), new THREE.Vector3(0, -1, 0));
      ray.layers.set(PICK_LAYER);
      const hit = ray.intersectObjects(clickableMeshes(root, "APT_201"), false)[0];
      const blocker = ray.intersectObjects(focusedBlockers(root, "APT_201"), false)[0];
      return resolvePick(hit, blocker, "APT_201");
    };

    it("stays in the apartment when its floor is clicked, instead of picking the one below", () => {
      expect(pick(stack(), 0)).toEqual({ unit: "APT_201", device: null });
    });

    it("still selects its devices", () => {
      expect(pick(stack(), 1.5)).toEqual({ unit: "APT_201", device: "DEV_thermostat" });
    });

    it("picks a neighbouring apartment that is closer than the focused one", () => {
      expect(resolvePick({ object: apartment("APT_202").mesh, distance: 5 }, { distance: 9 }, "APT_201")).toEqual({ unit: "APT_202", device: null });
    });

    it("exits when nothing is hit", () => {
      expect(resolvePick(undefined, undefined, "APT_201")).toEqual({ unit: null, device: null });
    });
  });
});
