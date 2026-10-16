import { Euler, Quaternion } from "three";
import { describe, expect, it } from "vitest";
import { compassRotationDegrees } from "@/lib/twin/compass";

const orientation = (yaw: number, pitch: number) => new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, "YXZ"));

describe("Viewer compass", () => {
  it("tracks all cardinal viewing directions in 3D explore", () => {
    for (const degrees of [0, 90, -90, 135]) {
      expect(compassRotationDegrees(orientation(degrees * Math.PI / 180, -Math.PI / 4))).toBeCloseTo(degrees, 10);
    }
  });

  it("keeps the heading in 2D plan and directly overhead explore views", () => {
    for (const degrees of [45, 90, -120]) {
      for (const pitch of [-Math.PI / 2 + 0.01, -Math.PI / 2 + 0.00001, -Math.PI / 2]) {
        expect(compassRotationDegrees(orientation(degrees * Math.PI / 180, pitch))).toBeCloseTo(degrees, 10);
      }
    }
  });

  it("tracks every intermediate orientation during a focus or plan transition without snapping to north", () => {
    const from = orientation(120 * Math.PI / 180, -Math.PI / 4);
    const to = orientation(120 * Math.PI / 180, -Math.PI / 2);
    for (let step = 0; step <= 20; step++) {
      expect(compassRotationDegrees(from.clone().slerp(to, step / 20))).toBeCloseTo(120, 10);
    }
  });
});