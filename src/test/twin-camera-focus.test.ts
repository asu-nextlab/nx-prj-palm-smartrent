import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { apartmentFocusPosition, deviceFocusDistance } from "@/lib/twin/camera-focus";

describe("Apartment camera focus", () => {
  it("preserves the current orbit direction and uses the existing focus distance", () => {
    const camera = new Vector3(-40, 35, -60);
    const target = new Vector3(10, 5, 20);
    const center = new Vector3(25, 8, -15);
    const distance = 20 * Math.hypot(0.7, 0.75, 0.9);
    const result = apartmentFocusPosition(camera, target, center, distance);
    expect(result.clone().sub(center).normalize().distanceTo(camera.clone().sub(target).normalize())).toBeLessThan(1e-12);
    expect(result.distanceTo(center)).toBeCloseTo(distance, 12);
    expect(camera.toArray()).toEqual([-40, 35, -60]);
    expect(target.toArray()).toEqual([10, 5, 20]);
    expect(center.toArray()).toEqual([25, 8, -15]);
  });

  it("keeps a straight-down camera directly above the selected apartment", () => {
    const result = apartmentFocusPosition(new Vector3(12, 90, -7), new Vector3(12, 0, -7), new Vector3(30, 4, 18), 24);
    expect(result.toArray()).toEqual([30, 28, 18]);
  });

  it("zooms in on a selected device, but not closer than 4 m or as far as the apartment view", () => {
    expect(deviceFocusDistance(0.2, 15)).toBe(4);
    expect(deviceFocusDistance(1.6, 15)).toBeCloseTo(6.4);
    expect(deviceFocusDistance(3, 15)).toBe(9);
  });
});
