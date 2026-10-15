import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer, useGLTF } from "@react-three/drei";
import { createElement as h, Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildInterior, buildSampleSite, type SampleBuilding, type SampleUnit } from "@/lib/twin/build";
import { layoutOf } from "@/lib/twin/templates";
import { isApartment, isDevice } from "@/lib/twin/ingest";
import { googleTiles, osmGround } from "@/lib/twin/osm";
import { City3D } from "./City3D";

export type GroundMode = "map" | "satellite" | "roadmap" | "city3d" | "plane";
export interface GoogleTiles { key: string; sessions: { satellite: string; roadmap: string } }

export interface ViewerProps {
  lat: number; lon: number; rotation: number; scale: number;
  glbUrl?: string | null;
  buildings: SampleBuilding[]; units: SampleUnit[];
  focusUnit: string | null; focusDevice: string | null;
  hiddenUnits?: string[];
  /** Hide roofs (a floor is picked), even when no apartments are hidden, e.g. on the top floor. */
  cutaway?: boolean | undefined;
  view: "2d" | "3d"; ground: GroundMode;
  elevation?: number; google?: GoogleTiles | null; clip?: boolean;
  onPick: (unit: string | null, device: string | null) => void;
  /** Device rows for the whole site. Meshes without a row are hidden; rows without a mesh get a marker. */
  devices?: { object_name: string; unit_object_name: string; status: string }[] | undefined;
  /** Heatmap colour per apartment object name; null/undefined shows the model's own colours. */
  heat?: Record<string, string> | null | undefined;
  /** Reports the DEV_ objects each apartment has in the model (apartment object name → device object names). */
  onModelDevices?: ((byUnit: Record<string, string[]>) => void) | undefined;
}

/** DEV_ object names the model has for an apartment. Sample sites build interiors lazily, so use their template. */
function modelDeviceNames(apt: THREE.Object3D, isSample: boolean): string[] {
  if (isSample) return layoutOf(apt.userData["layout"]).devices.map((d) => d.obj);
  const names = new Set<string>();
  apt.traverse((o) => { if (o !== apt && isDevice(o) && !o.userData["webMarker"]) names.add(o.name); });
  return [...names];
}

const savedRaycast = new WeakMap<THREE.Object3D, THREE.Object3D["raycast"]>();
/** Hides a DEV_ object and stops it being picked (three.js still raycasts invisible meshes). */
function setDeviceHidden(o: THREE.Object3D, hidden: boolean) {
  o.visible = !hidden;
  o.traverse((m) => {
    if (!(m as THREE.Mesh).isMesh) return;
    if (hidden && !savedRaycast.has(m)) { savedRaycast.set(m, m.raycast); m.raycast = () => {}; }
    if (!hidden && savedRaycast.has(m)) { m.raycast = savedRaycast.get(m)!; savedRaycast.delete(m); }
  });
}

const heatOriginals = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
const heatMaterials = new Map<string, THREE.MeshStandardMaterial>();
const heatMaterial = (color: string) => {
  let m = heatMaterials.get(color);
  if (!m) heatMaterials.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.75 })));
  return m;
};
/** Meshes the heatmap recolours: the apartment's shell on sample sites, and everything except
 *  devices and web-added markers on uploaded models. */
function heatTargets(apt: THREE.Object3D, isSample: boolean): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  apt.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData["webMarker"]) return;
    if (isSample) { if (/^SHELL/i.test(m.name)) out.push(m); return; }
    for (let p: THREE.Object3D | null = m; p && p !== apt; p = p.parent) if (isDevice(p)) return;
    out.push(m);
  });
  return out;
}

const markerGeometry = new THREE.SphereGeometry(0.16, 20, 14);
/** Marker for a device added in the web app (no mesh in the uploaded model), laid out in a grid inside the apartment. */
function deviceMarker(apt: THREE.Object3D, aptBox: THREE.Box3, objectName: string, status: string, index: number) {
  const color = status === "online" ? "#32bdcd" : "#ff8a3d";
  const m = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
  m.name = objectName;
  m.userData["webMarker"] = true;
  const spacing = 0.55, perRow = Math.max(1, Math.floor((aptBox.max.x - aptBox.min.x - 0.6) / spacing));
  const center = aptBox.getCenter(new THREE.Vector3());
  const world = new THREE.Vector3(
    aptBox.min.x + 0.6 + (index % perRow) * spacing,
    Math.min(aptBox.min.y + 1.2, aptBox.max.y - 0.3),
    center.z + Math.floor(index / perRow) * spacing);
  m.position.copy(apt.worldToLocal(world));
  m.scale.divide(apt.getWorldScale(new THREE.Vector3()));
  return m;
}

function findTagged(o: THREE.Object3D | null) {
  let device: string | null = null, unit: string | null = null;
  while (o) {
    if (!device && isDevice(o)) device = o.name;
    if (isApartment(o)) { unit = o.name; break; }
    o = o.parent;
  }
  return { unit, device };
}

function Ground({ lat, lon, mode, google }: { lat: number; lon: number; mode: GroundMode; google?: GoogleTiles | null }) {
  const [, force] = useState(0);
  const g = useMemo(() => {
    const up = () => force((n) => n + 1);
    if (mode === "map") return osmGround(lat, lon, up);
    if ((mode === "satellite" || mode === "roadmap") && google) return osmGround(lat, lon, up, googleTiles(google.sessions[mode], google.key));
    return null;
  }, [lat, lon, mode, google]);
  useEffect(() => () => g?.tex.dispose(), [g]);
  if (!g) {
    return h("mesh", { key: "plane", "rotation-x": -Math.PI / 2, receiveShadow: true },
      h("circleGeometry", { args: [220, 64] }),
      h("meshStandardMaterial", { color: "#dfe6dc", roughness: 1 }));
  }
  return h("mesh", { key: `tiles-${mode}`, "rotation-x": -Math.PI / 2, position: [g.offset[0], -0.02, g.offset[1]], receiveShadow: true },
    h("planeGeometry", { args: [g.size, g.size] }),
    h("meshStandardMaterial", { map: g.tex, roughness: 1 }));
}

// Scene graph elements are created without JSX: the dev-only source tagger adds a
// "data-tsd-source" prop to every JSX element, which three.js objects can't accept.
function SceneSetup({ far }: { far: boolean }) {
  return h(Fragment, null,
    h("color", { attach: "background", args: ["#e9eef0"] }),
    h("fog", { attach: "fog", args: ["#e9eef0", far ? 1500 : 260, far ? 6000 : 700] }),
    h("hemisphereLight", { args: ["#ffffff", "#c9c2b4", 0.7] }),
    h("directionalLight", { position: [60, 90, 40], intensity: 1.6, castShadow: true, "shadow-mapSize": [2048, 2048],
      "shadow-camera-left": -120, "shadow-camera-right": 120, "shadow-camera-top": 120, "shadow-camera-bottom": -120 }),
    h(Environment, { resolution: 64 },
      h(Lightformer, { intensity: 2, position: [0, 5, 0], scale: [10, 10, 1] }),
      h(Lightformer, { intensity: 1, color: "#bde", position: [-5, 1, -1], rotation: [0, Math.PI / 2, 0], scale: [20, 1, 1] })));
}

function GlbRoot({ url, children }: { url: string; children: (root: THREE.Object3D) => React.ReactNode }) {
  const gltf = useGLTF(url);
  useMemo(() => gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }), [gltf]);
  return h(Fragment, null, children(gltf.scene));
}

function Model({ root, props, target }: { root: THREE.Object3D; props: ViewerProps; target: React.MutableRefObject<THREE.Object3D | null> }) {
  useEffect(() => { target.current = root; return () => { if (target.current === root) target.current = null; }; }, [root, target]);
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
    root.traverse((o) => { if (o.userData["roof"] || /roof/i.test(o.name)) o.visible = !focused && !props.cutaway && hidden.size === 0; });
    for (const a of apts) {
      a.visible = !hidden.has(a.name);
      a.children.forEach((c) => { if (c.userData["shell"] || /^SHELL/i.test(c.name) || /^Window/.test(c.name)) c.visible = true; });
      const int = a.getObjectByName("INTERIOR");
      if (int && isSample) int.visible = false;
    }
    if (focused) {
      if (isSample && !focused.getObjectByName("INTERIOR")) focused.add(buildInterior(layoutOf(focused.userData["layout"])));
      const int = focused.getObjectByName("INTERIOR"); if (int) int.visible = true;
      focused.children.forEach((c) => { if (c.userData["shell"] || /^SHELL/i.test(c.name) || /^Window/.test(c.name)) c.visible = false; });
      const fb = boxOf(focused);
      for (const a of apts) if (a !== focused && boxOf(a).min.y > fb.min.y + 0.5) a.visible = false;
    }
  }, [root, props.focusUnit, props.focusDevice, isSample, props.hiddenUnits, props.cutaway]);

  // Report which DEV_ objects the model has, so the panel can offer them when adding a device.
  const { onModelDevices } = props;
  useEffect(() => {
    if (!onModelDevices) return;
    const byUnit: Record<string, string[]> = {};
    root.traverse((o) => { if (isApartment(o)) byUnit[o.name] = modelDeviceNames(o, isSample); });
    onModelDevices(byUnit);
  }, [root, isSample, onModelDevices]);

  // Keep the 3D view in step with the devices table (the GLB itself is never edited):
  // DEV_ meshes whose row was deleted are hidden; rows with no mesh get a marker.
  // Runs after the effect above that builds sample interiors on focus.
  useEffect(() => {
    if (!props.devices) return;
    const rowsByUnit = new Map<string, Map<string, string>>();
    for (const d of props.devices) {
      if (!rowsByUnit.has(d.unit_object_name)) rowsByUnit.set(d.unit_object_name, new Map());
      rowsByUnit.get(d.unit_object_name)!.set(d.object_name, d.status);
    }
    root.updateMatrixWorld(true);
    const apts: THREE.Object3D[] = [];
    root.traverse((o) => { if (isApartment(o)) apts.push(o); });
    for (const apt of apts) {
      for (const old of apt.children.filter((c) => c.userData["webMarker"])) {
        apt.remove(old);
        ((old as THREE.Mesh).material as THREE.Material).dispose();
      }
      const rows = rowsByUnit.get(apt.name) ?? new Map<string, string>();
      apt.traverse((o) => { if (o !== apt && isDevice(o)) setDeviceHidden(o, !rows.has(o.name)); });
      const inModel = new Set(modelDeviceNames(apt, isSample));
      const missing = [...rows].filter(([name]) => !inModel.has(name));
      if (!missing.length) continue;
      const aptBox = new THREE.Box3().setFromObject(apt);
      missing.forEach(([name, status], i) => apt.add(deviceMarker(apt, aptBox, name, status, i)));
    }
  }, [root, props.devices, isSample, props.focusUnit]);

  // Heatmap: swap apartment materials for a flat colour, restoring the originals when off.
  useEffect(() => {
    root.traverse((o) => {
      if (!isApartment(o)) return;
      const color = props.heat?.[o.name];
      for (const m of heatTargets(o, isSample)) {
        if (color) {
          if (!heatOriginals.has(m)) heatOriginals.set(m, m.material);
          m.material = heatMaterial(color);
        } else if (heatOriginals.has(m)) {
          m.material = heatOriginals.get(m)!;
          heatOriginals.delete(m);
        }
      }
    });
  }, [root, props.heat, isSample, props.focusUnit]);

  // Selection outline. Runs after the effects above so sample interiors and web-added
  // markers exist before the selected device is looked up.
  useEffect(() => {
    root.updateMatrixWorld(true);
    const focused = props.focusUnit ? root.getObjectByName(props.focusUnit) ?? null : null;
    const sel = (props.focusDevice && focused?.getObjectByName(props.focusDevice)) || focused;
    setHelper(sel ? new THREE.Box3Helper(new THREE.Box3().setFromObject(sel).expandByScalar(0.08), new THREE.Color(props.focusDevice ? "#ff8a3d" : "#32bdcd")) : null);
  }, [root, props.focusUnit, props.focusDevice, props.hiddenUnits, props.devices]);

  // camera
  useEffect(() => {
    const c = controls.current; if (!c) return;
    // Only re-frame when the user changes focus or view — not when the model is rebuilt after a data refresh (e.g. a nudge).
    const key = `${props.focusUnit}|${props.view}`;
    if (camKey.current === key) return;
    camKey.current = key;
    root.updateMatrixWorld(true);
    const focused = props.focusUnit ? root.getObjectByName(props.focusUnit) : null;
    const box = new THREE.Box3().setFromObject(focused ?? root);
    const center = box.getCenter(new THREE.Vector3());
    const r = Math.max(8, box.getSize(new THREE.Vector3()).length() * (focused ? 0.9 : 0.6));
    if (props.view === "2d") c.setLookAt(center.x, center.y + r * 1.6, center.z + 0.001, center.x, center.y, center.z, true);
    else c.setLookAt(center.x + r * 0.7, center.y + r * 0.75, center.z + r * 0.9, center.x, center.y, center.z, true);
  }, [root, props.focusUnit, props.view]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const { unit, device } = findTagged(e.object);
    if (unit) props.onPick(unit, device);
  };

  return h(Fragment, null,
    h(CameraControls, { ref: controls, makeDefault: true, maxPolarAngle: props.view === "2d" ? 0.01 : Math.PI / 2.1, minDistance: 2, maxDistance: props.ground === "city3d" ? 3000 : 600 }),
    h("group", { "rotation-y": THREE.MathUtils.degToRad(props.rotation), scale: props.scale, "position-y": props.ground === "city3d" ? props.elevation ?? 0 : 0 },
      h("primitive", { object: root, onClick })),
    helper ? h("primitive", { object: helper }) : null);
}

function SampleRoot({ props, target }: { props: ViewerProps; target: React.MutableRefObject<THREE.Object3D | null> }) {
  const root = useMemo(() => buildSampleSite(props.buildings, props.units), [props.buildings, props.units]);
  return h(Model, { root, props, target });
}

// Rotates the DOM compass so its N always points to world north (-Z) on screen.
function CompassTracker({ el }: { el: React.RefObject<HTMLDivElement | null> }) {
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!el.current) return;
    camera.getWorldDirection(dir);
    const flat = Math.hypot(dir.x, dir.z);
    const deg = flat < 1e-4 ? 0 : -Math.atan2(dir.x, -dir.z) * 180 / Math.PI;
    el.current.style.transform = `rotate(${deg}deg)`;
  });
  return null;
}

export default function SiteViewer(props: ViewerProps) {
  const target = useRef<THREE.Object3D | null>(null);
  const compass = useRef<HTMLDivElement | null>(null);
  const city = props.ground === "city3d" && props.google;
  return (
    <div className="relative h-full w-full">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [60, 60, 80], fov: 45, near: 0.1, far: 3000 }} onPointerMissed={() => props.onPick(null, null)}>
        {h(SceneSetup, { far: !!city })}
        {h(CompassTracker, { el: compass })}
        {city
          ? h(City3D, { key: `${props.lat},${props.lon}`, lat: props.lat, lon: props.lon, apiKey: props.google!.key, target, clip: props.clip ?? true })
          : h(Ground, { lat: props.lat, lon: props.lon, mode: props.ground, google: props.google ?? null })}
        {h(Suspense, { fallback: null },
          props.glbUrl
            ? h(GlbRoot, { url: props.glbUrl, children: (root: THREE.Object3D) => h(Model, { root, props, target }) })
            : h(SampleRoot, { props, target }))}
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 h-14 w-14 rounded-full border border-border bg-card/90 shadow-md" aria-label="Compass">
        <div ref={compass} className="relative h-full w-full">
          <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full">
            <polygon points="28,9 33,28 23,28" className="fill-destructive" />
            <polygon points="28,47 33,28 23,28" className="fill-muted-foreground" />
          </svg>
          <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[10px] font-bold text-destructive">N</span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">S</span>
          <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">E</span>
          <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">W</span>
        </div>
      </div>
    </div>
  );
}
