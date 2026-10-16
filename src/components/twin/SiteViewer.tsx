import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer, useGLTF } from "@react-three/drei";
import { createElement as h, Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildInterior, buildSampleSite, type SampleBuilding, type SampleUnit } from "@/lib/twin/build";
import { layoutOf } from "@/lib/twin/templates";
import { isApartment } from "@/lib/twin/ingest";
import { clickableMeshes, isClick, PICK_LAYER, tagsOf, updateRoofs, type PointerStart } from "@/lib/twin/selection";
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
  view: "2d" | "3d"; ground: GroundMode;
  elevation?: number; google?: GoogleTiles | null; clip?: boolean;
  onPick: (unit: string | null, device: string | null) => void;
}

function Selection({ root, props }: { root: THREE.Object3D; props: ViewerProps }) {
  const { gl, camera } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(PICK_LAYER);
    let start: PointerStart | null = null;
    const pointers = new Set<number>();
    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      start = pointers.size === 1 && e.button === 0
        ? { x: e.clientX, y: e.clientY, time: e.timeStamp, id: e.pointerId, distance: 0 } : null;
    };
    const move = (e: PointerEvent) => {
      if (start?.id === e.pointerId) start.distance = Math.max(start.distance, Math.hypot(e.clientX - start.x, e.clientY - start.y));
    };
    const up = (e: PointerEvent) => {
      const click = isClick(start, e);
      start = null;
      pointers.delete(e.pointerId);
      if (!click || e.target !== canvas) return;
      const rect = canvas.getBoundingClientRect();
      root.updateWorldMatrix(true, true);
      raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObjects(clickableMeshes(root, props.focusUnit), false)[0];
      if (hit) { const { unit, device } = tagsOf(hit.object); props.onPick(unit, device); }
      else props.onPick(null, null);
    };
    const cancel = (e: PointerEvent) => { start = null; pointers.delete(e.pointerId); };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [gl, camera, root, props.focusUnit, props.onPick]);
  return null;
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
      const focusedFloor = props.units.find((u) => u.object_name === focused.name)?.floor;
      const fb = boxOf(focused);
      for (const a of apts) {
        const level = props.units.find((u) => u.object_name === a.name)?.floor;
        if (a !== focused && (level !== undefined && focusedFloor !== undefined ? level > focusedFloor : boxOf(a).min.y > fb.min.y + 0.5)) a.visible = false;
      }
    }
    updateRoofs(root, focused);
    root.updateMatrixWorld(true);
    const sel = (props.focusDevice && focused?.getObjectByName(props.focusDevice)) || focused;
    setHelper(sel ? new THREE.Box3Helper(boxOf(sel).expandByScalar(0.08), new THREE.Color(props.focusDevice ? "#ff8a3d" : "#32bdcd")) : null);
  }, [root, props.focusUnit, props.focusDevice, isSample, props.hiddenUnits, props.units]);

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

  return h(Fragment, null,
    h(Selection, { root, props }),
    h(CameraControls, { ref: controls, makeDefault: true, maxPolarAngle: props.view === "2d" ? 0.01 : Math.PI / 2.1, minDistance: 2, maxDistance: props.ground === "city3d" ? 3000 : 600 }),
    h("group", { "rotation-y": THREE.MathUtils.degToRad(props.rotation), scale: props.scale, "position-y": props.ground === "city3d" ? props.elevation ?? 0 : 0 },
      h("primitive", { object: root })),
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
      <Canvas shadows dpr={[1, 2]} camera={{ position: [60, 60, 80], fov: 45, near: 0.1, far: 3000 }}>
        {h(SceneSetup, { far: !!city })}
        {h(CompassTracker, { el: compass })}
        {city
          ? h(City3D, { key: `${props.lat},${props.lon}`, lat: props.lat, lon: props.lon, apiKey: city.key, target, clip: props.clip ?? true })
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
