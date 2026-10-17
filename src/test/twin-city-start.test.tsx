import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

const runtime = vi.hoisted(() => ({ frame: null as (() => void) | null, renderer: null as any }));
const camera = new THREE.PerspectiveCamera();
const gl = { localClippingEnabled: false };

vi.mock("@react-three/fiber", () => ({
  useThree: () => ({ camera, gl }),
  useFrame: (frame: () => void) => { runtime.frame = frame; },
}));
vi.mock("3d-tiles-renderer", () => ({
  TilesRenderer: class {
    group = new THREE.Group();
    fetchOptions = {};
    registerPlugin = vi.fn();
    setCamera = vi.fn();
    setResolution = vi.fn();
    setResolutionFromRenderer = vi.fn();
    deleteCamera = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    update = vi.fn();
    dispose = vi.fn();
    constructor() { runtime.renderer = this; }
  },
}));
vi.mock("3d-tiles-renderer/plugins", () => ({
  GoogleCloudAuthPlugin: class {},
  ReorientationPlugin: class {},
}));

import { City3D } from "@/components/twin/City3D";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("City terrain cold startup", () => {
  it("keeps the altitude probe until a hit, then follows later terrain detail without freezing", () => {
    let height: number | null = null;
    const intersect = vi.spyOn(THREE.Raycaster.prototype, "intersectObject").mockImplementation(() =>
      height === null ? [] : [{ point: new THREE.Vector3(0, height, 0) } as THREE.Intersection]);
    render(<City3D lat={33} lon={-111} apiKey="test" target={{ current: null }} clip={false} />);
    const tick = (n: number) => { for (let i = 0; i < n; i++) runtime.frame?.(); };
    tick(220);
    expect(intersect).toHaveBeenCalled();
    expect(runtime.renderer.deleteCamera).not.toHaveBeenCalled();
    height = 330;
    tick(20);
    expect(runtime.renderer.deleteCamera).toHaveBeenCalledTimes(1);
    expect(runtime.renderer.group.parent.position.y).toBe(-330);
    height = 0;
    tick(220);
    height = -5;
    tick(20);
    expect(runtime.renderer.group.parent.position.y).toBe(-325);
    expect(runtime.renderer.deleteCamera).toHaveBeenCalledTimes(1);
  });
});