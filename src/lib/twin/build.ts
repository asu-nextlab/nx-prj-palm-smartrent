import * as THREE from "three";
import { BUILDING_COLORS, FLOOR_HEIGHT, layoutOf, type LayoutTemplate } from "./templates";

export interface SampleBuilding {
  id: string; name: string; x: number; z: number; rotation: number;
  floors: number; cols: number; rows: number; layout: string; color: string;
}
export interface SampleUnit {
  object_name: string; building_id: string | null; floor: number; col: number; row: number; layout: string | null;
}

const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

// Create a simple box mesh with given name, size, color, and position.
function box(name: string, s: [number, number, number], color: string, pos: [number, number, number]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...s), mat(color));
  m.name = name; m.position.set(...pos); m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Furnished interior for one apartment (unit-local coordinates). */
export function buildInterior(t: LayoutTemplate): THREE.Group {
  const g = new THREE.Group();
  g.name = "INTERIOR";
  const { width: w, depth: d } = t;
  for (const room of t.rooms) {
    const [x0, z0, x1, z1] = room.r;
    const rw = (x1 - x0) * w, rd = (z1 - z0) * d;
    const floor = box(`Floor_${room.name}`, [rw - 0.04, 0.06, rd - 0.04], room.floor, [x0 * w + rw / 2, 0.03, z0 * d + rd / 2]);
    floor.userData["label"] = room.name;
    g.add(floor);
    // partition walls on room edges (low cut-away height so the plan reads)
    const wallH = 1.2, wt = 0.1, wc = "#f2efe9";
    g.add(box("Wall", [rw, wallH, wt], wc, [x0 * w + rw / 2, wallH / 2, z0 * d]));
    g.add(box("Wall", [wt, wallH, rd], wc, [x0 * w, wallH / 2, z0 * d + rd / 2]));
    if (x1 >= 0.999) g.add(box("Wall", [wt, wallH, rd], wc, [w, wallH / 2, z0 * d + rd / 2]));
    if (z1 >= 0.999) g.add(box("Wall", [rw, wallH, wt], wc, [x0 * w + rw / 2, wallH / 2, d]));
  }
  for (const f of t.furniture) {
    g.add(box(f.name.replace(/\s/g, "_"), f.s, f.color, [f.p[0] * w, f.s[1] / 2 + 0.06, f.p[1] * d]));
  }
  for (const dv of t.devices) {
    const m = box(dv.obj, dv.s, dv.color, [dv.p[0] * w, dv.y, dv.p[1] * d]);
    (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(dv.obj === "DEV_thermostat" ? "#32bdcd" : "#000000");
    (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
    g.add(m);
  }
  return g;
}

// Construct a simple tree model.
function tree(x: number, z: number, s = 1) {
  const g = new THREE.Group();
  g.name = "Tree";
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.6 * s, 6), mat("#7a5a3c"));
  trunk.position.y = 0.8 * s;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 * s, 0), mat("#6f8f4e", { flatShading: true }));
  crown.position.y = 2.4 * s; crown.castShadow = true;
  g.add(trunk, crown); g.position.set(x, 0, z);
  return g;
}

/** Deterministic pseudo-random */
function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

// THREE.Group is similar to a Fragment in React, an empty pseudo-object meant for grouping elements together.
// Constructs the exterior visualization of the site.
export function buildSampleSite(buildings: SampleBuilding[], units: SampleUnit[], withInteriors = false): THREE.Group {
  const site = new THREE.Group();
  site.name = "SITE";

  // Initialize random number generator.
  const rand = rng(42);

  // Loop through and construct all buildings.
  for (const b of buildings) {
    // Fetch the layout of the building.
    // Layouts specify different types of apartments and contain info about things like furniture and flooring.
    const t = layoutOf(b.layout);

    //Create an empty building group.
    const bg = new THREE.Group();
    bg.name = `BLDG_${b.name.replace(/\s/g, "_")}`;
    bg.position.set(b.x, 0, b.z);
    bg.rotation.y = THREE.MathUtils.degToRad(b.rotation);

    // ox = (-BuildingColumns * LayoutWidth) / 2
    // oz = (-BuildingRows * LayoutDepth) / 2
    // Not sure what these are meant to represent tbh.
    // Are layout width and depth the size of an apartment's grid tiles for furniture placement?
    const ox = (-b.cols * t.width) / 2, oz = (-b.rows * t.depth) / 2;

    // Add simple box mesh roof and base to the bg group.
    const roof = box("Roof", [b.cols * t.width + 0.6, 0.3, b.rows * t.depth + 0.6], "#8a8f94", [0, b.floors * FLOOR_HEIGHT + 0.15, 0]);
    roof.userData["roof"] = true;
    bg.add(roof);
    bg.add(box("Plinth", [b.cols * t.width + 2, 0.12, b.rows * t.depth + 2], "#cfc8bb", [0, 0.06, 0]));

    // Get the building's color or default color if not specified.
    const color = BUILDING_COLORS[b.color] ?? "#e6d6bd";

    // Loop through all units in this building.
    for (const u of units.filter((u) => u.building_id === b.id)) {
      // Get the layout of this unit.
      const ut = layoutOf(u.layout ?? b.layout);

      // Create an empty unit group.
      const ug = new THREE.Group();
      ug.name = u.object_name;
      ug.userData["apartment"] = true;
      ug.userData["layout"] = ut.id;
      ug.position.set(ox + u.col * t.width, (u.floor - 1) * FLOOR_HEIGHT + 0.12, oz + u.row * t.depth);

      // Build a windowed shell for the unit.
      const shell = box("SHELL", [ut.width - 0.15, FLOOR_HEIGHT - 0.15, ut.depth - 0.15], color, [ut.width / 2, FLOOR_HEIGHT / 2, ut.depth / 2]);
      const win = box("Window", [ut.width * 0.6, 1.1, 0.04], "#5b7f93", [ut.width / 2, FLOOR_HEIGHT * 0.55, -0.06]);
      const win2 = win.clone(); win2.position.z = ut.depth + 0.06 - 0.15;
      shell.userData["shell"] = true; win.userData["shell"] = true; win2.userData["shell"] = true;
      ug.add(shell, win, win2);

      // If rendering with interiors, hide the exterior shell of each unit and add an interior to it.
      if (withInteriors) { ug.add(buildInterior(ut)); shell.visible = false; }
      bg.add(ug);
    }
    site.add(bg);
    
    // Construct randomized trees around each building.
    const half = Math.max(b.cols * t.width, b.rows * t.depth) / 2 + 4;
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2;
      site.add(tree(b.x + Math.cos(a) * half, b.z + Math.sin(a) * half, 0.8 + rand() * 0.6));
    }
  }
  
  // Construct paths connecting each building to the center of the site.
  for (const b of buildings) {
    const len = Math.hypot(b.x, b.z);
    const p = box("Path", [1.6, 0.04, len], "#e3ddd1", [b.x / 2, 0.03, b.z / 2]);
    p.rotation.y = Math.atan2(b.x, b.z);
    p.castShadow = false;
    site.add(p);
  }

  // Add a simple circular pool to the center of the site.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.06, 32), mat("#7ec8d3", { roughness: 0.2, metalness: 0.1 }));
  plaza.name = "Pool"; plaza.position.y = 0.04; site.add(plaza);
  return site;
}

/** Downloadable template GLB showing the APT_/DEV_ naming convention. */
export async function exportSampleGlb(): Promise<Blob> {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const b: SampleBuilding = { id: "b", name: "Sample", x: 0, z: 0, rotation: 0, floors: 2, cols: 2, rows: 2, layout: "two_bed", color: "sand" };
  const units: SampleUnit[] = [];
  let n = 101;
  for (let f = 1; f <= 2; f++) for (let c = 0; c < 2; c++) for (let r = 0; r < 2; r++) {
    units.push({ object_name: `APT_${f}${String(n++ % 100).padStart(2, "0")}`, building_id: "b", floor: f, col: c, row: r, layout: c === 0 ? "two_bed" : "one_bed" });
  }
  const g = buildSampleSite([b], units, true);
  // make device names unique per apartment, as a Blender scene would
  g.traverse((o) => {
    if (o.name.startsWith("DEV_")) o.name = `${o.name}_${o.parent?.parent?.name.replace("APT_", "")}`;
    if (o.userData["apartment"]) o.userData = { beds: o.userData["layout"] === "two_bed" ? 2 : 1, baths: 1, area_sqft: o.userData["layout"] === "two_bed" ? 980 : 760 };
  });
  g.traverse((o) => { if (o.name === "SHELL") o.visible = true; });
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(g, { binary: true });
  return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
}
