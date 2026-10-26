import { describe, expect, it } from "vitest";
import { heatColors, RULES, type UnitSummary } from "@/lib/twin/issues";
import { isSiteId, siteSlugs } from "@/lib/twin/data";

const summary = (energyKwh: number, oldestInstallYear: number | null): UnitSummary =>
  ({ issues: [], priority: 0, level: null, heatScore: 0, broken: 0, energyKwh, oldestInstallYear });
const now = new Date("2026-10-26");

describe("Energy and device-age heatmaps", () => {
  it("colours equal apartments the same middle colour, not all 'lowest'", () => {
    const s = new Map([["APT_1", summary(766, 2019)], ["APT_2", summary(766, 2019)]]);
    const c = heatColors("energy", ["APT_1", "APT_2"], s, now)!;
    expect(c["APT_1"]).toBe(c["APT_2"]);
    expect(c["APT_1"]).toBe("hsl(60, 70%, 48%)"); // yellow = site average
  });

  it("scores energy against the site average: high-use factor is red, as far below is green", () => {
    const f = RULES.highEnergyFactor;
    const s = new Map([["LOW", summary(100 * (2 - f), null)], ["AVG", summary(100, null)], ["HIGH", summary(100 * f, null)]]);
    const c = heatColors("energy", ["LOW", "AVG", "HIGH"], s, now)!;
    expect([c["LOW"], c["AVG"], c["HIGH"]]).toEqual(["hsl(120, 70%, 48%)", "hsl(60, 70%, 48%)", "hsl(0, 70%, 48%)"]);
  });

  it("scores device age on a fixed scale: new is green, due for replacement is red", () => {
    const s = new Map([["NEW", summary(1, 2026)], ["HALF", summary(1, 2026 - RULES.oldAfterYears / 2)], ["DUE", summary(1, 2026 - RULES.oldAfterYears)], ["NONE", summary(1, null)]]);
    const c = heatColors("age", ["NEW", "HALF", "DUE", "NONE"], s, now)!;
    expect([c["NEW"], c["HALF"], c["DUE"]]).toEqual(["hsl(120, 70%, 48%)", "hsl(60, 70%, 48%)", "hsl(0, 70%, 48%)"]);
    expect(c["NONE"]).not.toMatch(/^hsl/);
  });
});

describe("Readable site URLs", () => {
  it("slugs names and numbers repeats in creation order", () => {
    const slugs = siteSlugs([{ id: "a", name: "Mesa Lofts" }, { id: "b", name: "MAA Fountainhead" }, { id: "c", name: "Mesa  Lofts!" }, { id: "d", name: "Café Ünits" }, { id: "e", name: "???" }]);
    expect([...slugs.values()]).toEqual(["mesa-lofts", "maa-fountainhead", "mesa-lofts-2", "cafe-units", "site"]);
  });

  it("still recognises old id links", () => {
    expect(isSiteId("11111111-0000-0000-0000-000000000003")).toBe(true);
    expect(isSiteId("mesa-lofts")).toBe(false);
  });
});
