import { useFrame, useThree } from "@react-three/fiber";
import { createElement as h, useEffect, useMemo, useState } from "react";
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
    setTiles(t);
    return () => { t.removeEventListener("load-model", onLoad as never); t.dispose(); setTiles(null); };
  }, [apiKey, lat, lon, camera, gl, planes]);

  const state = useMemo(() => ({ grounded: false, frame: 0, ray: new THREE.Raycaster() }), [tiles]);
  useFrame(() => {
    if (!tiles) return;
    camera.updateMatrixWorld();
    tiles.setResolutionFromRenderer(camera, gl);
    tiles.update();
    state.frame++;
    // Auto-ground: drop a ray straight down at the site origin until it hits the scan.
    if (!state.grounded && state.frame % 20 === 0) {
      tiles.group.position.y = 0; tiles.group.updateMatrixWorld(true);
      state.ray.set(new THREE.Vector3(0, 5000, 0), new THREE.Vector3(0, -1, 0));
      state.ray.far = 20000;
      const hit = state.ray.intersectObject(tiles.group, true)[0];
      if (hit && state.frame > 120) { tiles.group.position.y = -hit.point.y; state.grounded = true; }
      else if (hit) tiles.group.position.y = -hit.point.y;
    }
    // Clip box: world-space bounds of our model, from below ground to well above the roofline.
    if (state.frame % 15 === 0) {
      const root = target.current;
      if (clip && root) {
        const b = new THREE.Box3().setFromObject(root);
        if (!b.isEmpty()) {
          b.expandByVector(new THREE.Vector3(1.5, 0, 1.5));
          b.min.y = -30; b.max.y = Math.max(b.max.y, 0) + 400;
          planes[0]!.set(new THREE.Vector3(1, 0, 0), -b.max.x);
          planes[1]!.set(new THREE.Vector3(-1, 0, 0), b.min.x);
          planes[2]!.set(new THREE.Vector3(0, 1, 0), -b.max.y);
          planes[3]!.set(new THREE.Vector3(0, -1, 0), b.min.y);
          planes[4]!.set(new THREE.Vector3(0, 0, 1), -b.max.z);
          planes[5]!.set(new THREE.Vector3(0, 0, -1), b.min.z);
          return;
        }
      }
      // Disabled: a box far away clips nothing.
      for (const p of planes) p.set(new THREE.Vector3(1, 0, 0), 1e9);
    }
  });

  return tiles ? h("primitive", { object: tiles.group }) : null;
}
