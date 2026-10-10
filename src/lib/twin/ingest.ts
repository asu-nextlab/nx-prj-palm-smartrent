import * as THREE from "three";
import { FLOOR_HEIGHT, guessDevice } from "./templates";

export interface IngestedDevice { object_name: string; name: string; type: string }
export interface IngestedUnit {
  object_name: string; apt_number: string; floor: number;
  beds: number | null; baths: number | null; area_sqft: number | null; layout: string | null;
  devices: IngestedDevice[];
}

export const isApartment = (o: THREE.Object3D) => /^APT[_-]?/i.test(o.name);
export const isDevice = (o: THREE.Object3D) => /^DEV[_-]?/i.test(o.name);

const num = (v: unknown) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));

/** Reads a GLB exported from Blender/SketchUp. Apartments are objects named APT_<number>;
 *  devices are descendants named DEV_<kind>. Blender custom properties (beds, baths,
 *  area_sqft, floor, layout) are exported as glTF extras and picked up automatically. */
export async function ingestGlb(buffer: ArrayBuffer): Promise<IngestedUnit[]> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(buffer, "");

  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const units: IngestedUnit[] = [];
  const seen = new Set<string>();

  root.traverse((o) => {
    if (!isApartment(o) || seen.has(o.name)) return;
    seen.add(o.name);

    const ud = o.userData ?? {};
    const bbox = new THREE.Box3().setFromObject(o);
    const floor = num(ud["floor"]) ?? Math.max(1, Math.round((isFinite(bbox.min.y) ? bbox.min.y : 0) / FLOOR_HEIGHT) + 1);
    const devices: IngestedDevice[] = [];
    const devSeen = new Set<string>();

    o.traverse((c) => {
      if (c !== o && isDevice(c) && !devSeen.has(c.name)) {
        devSeen.add(c.name);
        devices.push({ object_name: c.name, ...guessDevice(c.name) });
      }
    });

    units.push({
      object_name: o.name,
      apt_number: String(ud["apt_number"] ?? o.name.replace(/^APT[_-]?/i, "")),
      floor,
      beds: num(ud["beds"]), baths: num(ud["baths"]), area_sqft: num(ud["area_sqft"] ?? ud["area"]), layout: ud["layout"] ? String(ud["layout"]) : null,
      devices,
    });
  });
  
  return units.sort((a, b) => a.apt_number.localeCompare(b.apt_number, undefined, { numeric: true }));
}
