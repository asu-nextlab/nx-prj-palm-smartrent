import * as THREE from "three";
import CameraControls from "camera-controls";
import { describe, expect, it } from "vitest";
import { groundPanBounds, mapGroundFootprint } from "@/lib/twin/ground-bounds";

CameraControls.install({ THREE });

describe("Ground pan boundaries", () => {
  it("insets a 440-meter simple ground bounding box by 5% on each edge without limiting height", () => {
    const bounds = groundPanBounds(440, [0, 0]);
    expect(bounds.min.toArray()).toEqual([-198, -Infinity, -198]);
    expect(bounds.max.toArray()).toEqual([198, Infinity, 198]);
  });

  it("uses the complete offset map footprint, not a selected building", () => {
    const footprint = mapGroundFootprint(33.4, -111.9);
    const bounds = groundPanBounds(footprint.size, footprint.offset);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(footprint.size * 0.9, 10);
    expect(bounds.min.x).toBeCloseTo(footprint.offset[0] - footprint.size * 0.45, 10);
    expect(bounds.max.z).toBeCloseTo(footprint.offset[1] + footprint.size * 0.45, 10);
  });

  it("clamps repeated pan updates while retaining zoom distance and rotation", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 50, 80);
    const controls = new CameraControls(camera);
    controls.setLookAt(0, 50, 80, 0, 0, 0, false);
    controls.setBoundary(groundPanBounds(440, [0, 0]));
    const distance = controls.distance;
    const azimuth = controls.azimuthAngle;
    const polar = controls.polarAngle;
    for (const [x, z] of [[1000, 1000], [-1000, -1000], [1000, -1000]]) {
      controls.moveTo(x, 10, z, false);
      controls.update(1 / 60);
      const target = controls.getTarget(new THREE.Vector3(), false);
      expect(target.x).toBe(Math.sign(x) * 198);
      expect(target.z).toBe(Math.sign(z) * 198);
      expect(target.y).toBe(10);
      expect(controls.distance).toBe(distance);
      expect(controls.azimuthAngle).toBe(azimuth);
      expect(controls.polarAngle).toBe(polar);
    }
    controls.dispose();
  });
});