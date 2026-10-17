import { useFrame, useThree } from "@react-three/fiber";
import { createElement as h, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer";
import { GoogleCloudAuthPlugin, ReorientationPlugin } from "3d-tiles-renderer/plugins";

const D2R = Math.PI / 180;

/** Google Photorealistic 3D Tiles centred on lat/lon. The ground under the site is
 *  auto-detected and moved to y=0, and an auto-computed box around our model carves
 *  existing scanned buildings out of the way. */
export function City3D({ lat, lon, apiKey, target, clip }: {
  lat: number; lon: number; apiKey: string;
  target: React.MutableRefObject<THREE.Object3D | null>; clip: boolean;
}) {
  const { camera, gl } = useThree();
  const planes = useMemo(() => Array.from({ length: 6 }, () => new THREE.Plane()), []);
  const [tiles, setTiles] = useState<TilesRenderer | null>(null);
  const probeRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Build and dispose the renderer inside one effect so a remount never reuses a
  // disposed renderer (which loses its Google auth plugin and requests tiles without the key).
  useEffect(() => {
    const t = new TilesRenderer();
    t.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true }));
    t.registerPlugin(new ReorientationPlugin({ lat: lat * D2R, lon: lon * D2R, height: 0, up: "+y" }));
    t.errorTarget = 12;
    t.fetchOptions = { ...t.fetchOptions, referrerPolicy: "strict-origin-when-cross-origin", mode: "cors" };
    gl.localClippingEnabled = true;
    t.setCamera(camera);
    t.setResolutionFromRenderer(camera, gl);
    const onLoad = ({ scene }: { scene: THREE.Object3D }) => {
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) { m.clippingPlanes = planes; m.clipIntersection = true; }
      });
    };
    t.addEventListener("load-model", onLoad as never);
    // Our site origin sits at ellipsoid height 0, which is usually below the real ground,
    // so the main camera starts "underground" and never asks for nearby tiles. A probe camera
    // high above the site loads the local terrain until we've found the ground under the model.
    const probe = new THREE.PerspectiveCamera(60, 1, 1, 100000);
    probe.position.set(0, 4000, 0); probe.up.set(0, 0, -1); probe.lookAt(0, 0, 0); probe.updateMatrixWorld(true);
    t.setCamera(probe); t.setResolution(probe, 512, 512);
    probeRef.current = probe;
    setTiles(t);
    return () => { t.removeEventListener("load-model", onLoad as never); t.dispose(); setTiles(null); };
  }, [apiKey, lat, lon, camera, gl, planes]);

  // The reorientation plugin owns tiles.group's transform (Z north, X west, Y up), so we
  // wrap it: turn 180° so north is -Z like our street map, and lift/lower the wrapper to ground it.
  const wrap = useMemo(() => { const g = new THREE.Group(); g.rotation.y = Math.PI; return g; }, []);
  useEffect(() => { if (!tiles) return; wrap.add(tiles.group); return () => { wrap.remove(tiles.group); }; }, [tiles, wrap]);
  const state = useMemo(() => ({ frame: 0, ray: new THREE.Raycaster() }), [tiles]);
  useFrame(() => {
    if (!tiles) return;
    camera.updateMatrixWorld();
    wrap.updateMatrixWorld(true);
    tiles.setResolutionFromRenderer(camera, gl);
    tiles.update();
    state.frame++;
    // Keep grounding as coarse tiles are replaced with detailed terrain. Repeated
    // hits on the same coarse tile do not mean the final height has settled.
    if (state.frame % 20 === 0) {
      wrap.updateMatrixWorld(true);
      state.ray.set(new THREE.Vector3(0, 10000, 0), new THREE.Vector3(0, -1, 0));
      state.ray.far = 30000;
      const hit = state.ray.intersectObject(tiles.group, true)[0];
      if (hit) {
        wrap.position.y -= hit.point.y;
        wrap.updateMatrixWorld(true);
        // The main camera is now above terrain and can request local detail.
        // Retaining the wide altitude probe competes with those requests on a
        // cold load; remove it immediately rather than waiting for frame counts.
        if (probeRef.current) { tiles.deleteCamera(probeRef.current); probeRef.current = null; }
      }
    }
    // Clip box: world-space bounds of our model, from below ground to well above the roofline.
    if (state.frame % 15 === 0) {
      const root = target.current;
      if (clip && root) {
        const b = new THREE.Box3().setFromObject(root);
        if (!b.isEmpty()) {
          b.expandByVector(new THREE.Vector3(1.5, 0, 1.5));
          b.min.y = -30; b.max.y = Math.max(b.max.y, 0) + 400;
          planes[0]?.set(new THREE.Vector3(1, 0, 0), -b.max.x);
          planes[1]?.set(new THREE.Vector3(-1, 0, 0), b.min.x);
          planes[2]?.set(new THREE.Vector3(0, 1, 0), -b.max.y);
          planes[3]?.set(new THREE.Vector3(0, -1, 0), b.min.y);
          planes[4]?.set(new THREE.Vector3(0, 0, 1), -b.max.z);
          planes[5]?.set(new THREE.Vector3(0, 0, -1), b.min.z);
          return;
        }
      }
      // Disabled: a box far away clips nothing.
      for (const p of planes) p.set(new THREE.Vector3(1, 0, 0), 1e9);
    }
  });

  return tiles ? h("primitive", { object: wrap }) : null;
}
