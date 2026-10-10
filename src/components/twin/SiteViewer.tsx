//#region Imports

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer, useGLTF } from "@react-three/drei";
import { createElement as h, Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildInterior, buildSampleSite, type SampleBuilding, type SampleUnit } from "@/lib/twin/build";
import { layoutOf } from "@/lib/twin/templates";
import { isApartment, isDevice } from "@/lib/twin/ingest";
import { osmGround } from "@/lib/twin/osm";

//#endregion

export interface ViewerProps {
  lat: number; lon: number; rotation: number; scale: number;
  glbUrl?: string | null;
  buildings: SampleBuilding[]; units: SampleUnit[];
  focusUnit: string | null; focusDevice: string | null;
  hiddenUnits?: string[];
  view: "2d" | "3d"; ground: "map" | "plane";
  onPick: (unit: string | null, device: string | null) => void;
}

// From a given object, find the unit and/or device that object is or is a child of.
function findTagged(o: THREE.Object3D | null) {
  let device: string | null = null, unit: string | null = null;
  while (o) {
    if (!device && isDevice(o)) device = o.name;
    if (isApartment(o)) { unit = o.name; break; }
    o = o.parent;
  }
  return { unit, device };
}

// Create a ground mesh based on latitude, longitude, and one of two modes.
function Ground({ lat, lon, mode }: { lat: number; lon: number; mode: "map" | "plane" }) {
  // Create a dummy state variable to force re-renders.
  const [, force] = useState(0);

  // Create a ground canvas texture based on latitude and longitude and force a re-render whenever lat, lon, or mode change.
  // g is cached between renders for re-use.
  // g is set to null in "plane" mode and the result of osmGround() in "map" mode.
  const g = useMemo(() => (mode === "map" ? osmGround(lat, lon, () => force((n) => n + 1)) : null), [lat, lon, mode]);

  // Add an effect that disposes g's texture if it exists.
  // Called whenever the component is committed with a new g value?
  // Why get rid of reh texture? Only getting rid of it at a certain time?
  useEffect(() => () => g?.tex.dispose(), [g]);

  // No g means this is "plane" mode.
  if (!g) {
    // Return a plain white circle mesh.
    return h("mesh", { "rotation-x": -Math.PI / 2, receiveShadow: true },
      h("circleGeometry", { args: [220, 64] }),
      h("meshStandardMaterial", { color: "#dfe6dc", roughness: 1 }));
  }

  // "map" mode, return a plane with the map texture.
  return h("mesh", { "rotation-x": -Math.PI / 2, position: [g.offset[0], -0.02, g.offset[1]], receiveShadow: true },
    h("planeGeometry", { args: [g.size, g.size] }),
    h("meshStandardMaterial", { map: g.tex, roughness: 1 }));
}

// Scene graph elements are created without JSX: the dev-only source tagger adds a
// "data-tsd-source" prop to every JSX element, which three.js objects can't accept.
function SceneSetup() {
  return h(Fragment, null,
    h("color", { attach: "background", args: ["#e9eef0"] }),
    h("fog", { attach: "fog", args: ["#e9eef0", 260, 700] }),
    h("hemisphereLight", { args: ["#ffffff", "#c9c2b4", 0.7] }),
    h("directionalLight", { position: [60, 90, 40], intensity: 1.6, castShadow: true, "shadow-mapSize": [2048, 2048],
      "shadow-camera-left": -120, "shadow-camera-right": 120, "shadow-camera-top": 120, "shadow-camera-bottom": -120 }),
    h(Environment, { resolution: 64 },
      h(Lightformer, { intensity: 2, position: [0, 5, 0], scale: [10, 10, 1] }),
      h(Lightformer, { intensity: 1, color: "#bde", position: [-5, 1, -1], rotation: [0, Math.PI / 2, 0], scale: [20, 1, 1] }))
  );
}

function GlbRoot({ url, children }: { url: string; children: (root: THREE.Object3D) => React.ReactNode }) {
  const gltf = useGLTF(url);

  // Set shadows for the gltf.
  useMemo(() => gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }), [gltf]);

  // Return a fragment containing the gltf as children.
  return h(Fragment, null, children(gltf.scene));
}

function Model({ root, props }: { root: THREE.Object3D; props: ViewerProps }) {
  const controls = useRef<CameraControls>(null);
  const [helper, setHelper] = useState<THREE.Box3Helper | null>(null);
  const isSample = !props.glbUrl;
  const camKey = useRef<string | null>(null);

  // visibility / interior management
  useEffect(() => {
    root.updateMatrixWorld(true);

    const apts: THREE.Object3D[] = [];
    root.traverse((o) => { if (isApartment(o)) apts.push(o); });

    const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
    const focused = apts.find((a) => a.name === props.focusUnit) ?? null;
    const hidden = new Set(props.hiddenUnits ?? []);

    // Hide the roof on the focused apartment.
    root.traverse((o) => { if (o.userData["roof"] || /roof/i.test(o.name)) o.visible = !focused && hidden.size === 0; });

    // Show or hide apartments and interiors as needed.
    for (const a of apts) {
      a.visible = !hidden.has(a.name);
      a.children.forEach((c) => { if (c.userData["shell"] || /^SHELL/i.test(c.name) || /^Window/.test(c.name)) c.visible = true; });
      const int = a.getObjectByName("INTERIOR");
      if (int && isSample) int.visible = false;
    }

    if (focused) {
      // Add an interior to the focused apartment if it hasn't already added.
      if (isSample && !focused.getObjectByName("INTERIOR")) focused.add(buildInterior(layoutOf(focused.userData["layout"])));

      const int = focused.getObjectByName("INTERIOR"); if (int) int.visible = true;
      focused.children.forEach((c) => { if (c.userData["shell"] || /^SHELL/i.test(c.name) || /^Window/.test(c.name)) c.visible = false; });
      const fb = boxOf(focused);
      for (const a of apts) if (a !== focused && boxOf(a).min.y > fb.min.y + 0.5) a.visible = false;
    }

    root.updateMatrixWorld(true);

    // Render a selection box around the focused apartment if there is one.
    const sel = (props.focusDevice && focused?.getObjectByName(props.focusDevice)) || focused;
    setHelper(sel ? new THREE.Box3Helper(boxOf(sel).expandByScalar(0.08), new THREE.Color(props.focusDevice ? "#ff8a3d" : "#32bdcd")) : null);
  }, [root, props.focusUnit, props.focusDevice, isSample, props.hiddenUnits]);

  // camera
  useEffect(() => {
    const c = controls.current; if (!c) return;

    // Only re-frame when the user changes focus or view — not when the model is rebuilt after a data refresh (e.g. a nudge).
    const key = `${props.focusUnit}|${props.view}`;
    if (camKey.current === key) return;
    camKey.current = key;

    root.updateMatrixWorld(true);

    // Calculate the view target position and  to view it from.
    const focused = props.focusUnit ? root.getObjectByName(props.focusUnit) : null; // Focused Object
    const box = new THREE.Box3().setFromObject(focused ?? root); // Box around focused object or root if it's not present.
    const center = box.getCenter(new THREE.Vector3()); // Center of Box
    const r = Math.max(8, box.getSize(new THREE.Vector3()).length() * (focused ? 0.9 : 0.6)); // View position radius from object center?
    
    // Set the view target position of the controls (camera(?)).
    if (props.view === "2d") c.setLookAt(center.x, center.y + r * 1.6, center.z + 0.001, center.x, center.y, center.z, true);
    else c.setLookAt(center.x + r * 0.7, center.y + r * 0.75, center.z + r * 0.9, center.x, center.y, center.z, true);
  }, [root, props.focusUnit, props.view]);

  // Detect when a unit/device is clicked?
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const { unit, device } = findTagged(e.object);
    if (unit) props.onPick(unit, device);
  };

  return h(Fragment, null,
    h(CameraControls, { ref: controls, makeDefault: true, maxPolarAngle: props.view === "2d" ? 0.01 : Math.PI / 2.1, minDistance: 2, maxDistance: 600 }),
    h("group", { "rotation-y": THREE.MathUtils.degToRad(props.rotation), scale: props.scale },
      h("primitive", { object: root, onClick })),
    helper ? h("primitive", { object: helper }) : null);
}

function SampleRoot({ props }: { props: ViewerProps }) {
  // Memoize the sample site, storing it for future render passes.
  const root = useMemo(() => buildSampleSite(props.buildings, props.units), [props.buildings, props.units]);
  return h(Model, { root, props });
}

// Renders the apartment viewer to a canvas.
// If there's a glbUrl provided with props, it will render the Glb scene, otherwise it renders the Sample layout.
export default function SiteViewer(props: ViewerProps) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [60, 60, 80], fov: 45, near: 0.1, far: 3000 }} onPointerMissed={() => props.onPick(null, null)}>
      {h(SceneSetup)}
      {h(Ground, { lat: props.lat, lon: props.lon, mode: props.ground })}
      {h(Suspense, { fallback: null },
        props.glbUrl
          ? h(GlbRoot, { url: props.glbUrl, children: (root: THREE.Object3D) => h(Model, { root, props }) })
          : h(SampleRoot, { props }))}
    </Canvas>
  );
}
