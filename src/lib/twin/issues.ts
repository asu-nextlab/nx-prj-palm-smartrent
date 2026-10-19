import type { SiteDevice } from "./data";

// Open maintenance issues are worked out from device data rather than stored, so the
// same rules apply to sample data, uploaded sites and (later) live device feeds.
// Tune the numbers here; every list and the heatmap read from this one file.

export const RULES = {
  /** Base points per issue. */
  points: { needs_service: 60, offline: 40, old: 12, high_energy: 8 },
  /** Extra points per day a device has been offline / needing service, capped. */
  perDayOpen: 2,
  maxDaysBonus: 40,
  /** Apartment bonus added to all its issues for each broken device beyond the first. */
  perExtraBrokenDevice: 15,
  /** A device this many years past its install year is due for replacement. */
  oldAfterYears: 6,
  /** Energy use this many times the average for the same device type counts as high. */
  highEnergyFactor: 1.5,
  /** Priority thresholds for each level. */
  levels: { urgent: 80, high: 50, medium: 25 },
} as const;

export type IssueKind = keyof typeof RULES.points;
export type Level = "urgent" | "high" | "medium" | "low";

export interface Issue {
  device: SiteDevice;
  kind: IssueKind;
  label: string;
  detail: string;
  /** Days the device has been broken (offline / needs service); null for other issues. */
  openDays: number | null;
  /** Points from this issue alone (base + time open). */
  score: number;
  /** score + apartment bonus; what lists sort by. */
  priority: number;
  level: Level;
  /** Broken devices in the same apartment (including this one, if broken). */
  brokenInUnit: number;
}

export interface UnitSummary {
  issues: Issue[];
  /** Highest issue priority in the apartment, 0 when there are none. */
  priority: number;
  level: Level | null;
  broken: number;
  energyKwh: number;
  oldestInstallYear: number | null;
}

const DAY = 24 * 60 * 60 * 1000;
const isBroken = (d: SiteDevice) => d.status === "offline" || d.status === "needs service";

export function levelOf(priority: number): Level {
  const { urgent, high, medium } = RULES.levels;
  return priority >= urgent ? "urgent" : priority >= high ? "high" : priority >= medium ? "medium" : "low";
}

/** Every open issue on a site, most urgent first. */
export function siteIssues(devices: SiteDevice[], now = new Date()): Issue[] {
  const energyByType = new Map<string, { sum: number; n: number }>();
  for (const d of devices) {
    if (d.energy_kwh == null) continue;
    const k = d.type ?? d.name;
    const e = energyByType.get(k) ?? { sum: 0, n: 0 };
    energyByType.set(k, { sum: e.sum + d.energy_kwh, n: e.n + 1 });
  }
  const brokenByUnit = new Map<string, number>();
  for (const d of devices) if (isBroken(d)) brokenByUnit.set(d.unit_id, (brokenByUnit.get(d.unit_id) ?? 0) + 1);

  const issues: Issue[] = [];
  const add = (device: SiteDevice, kind: IssueKind, label: string, detail: string, openDays: number | null = null) => {
    const timeBonus = openDays == null ? 0 : Math.min(RULES.maxDaysBonus, openDays * RULES.perDayOpen);
    const score = RULES.points[kind] + timeBonus;
    const brokenInUnit = brokenByUnit.get(device.unit_id) ?? 0;
    const priority = score + RULES.perExtraBrokenDevice * Math.max(0, brokenInUnit - 1);
    issues.push({ device, kind, label, detail, openDays, score, priority, level: levelOf(priority), brokenInUnit });
  };

  for (const d of devices) {
    if (isBroken(d)) {
      const since = d.status_since ? new Date(d.status_since) : now;
      const days = Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY));
      const label = d.status === "offline" ? "Offline" : "Needs service";
      add(d, d.status === "offline" ? "offline" : "needs_service", label, days === 0 ? "since today" : `for ${days} day${days === 1 ? "" : "s"}`, days);
    }
    if (d.install_year != null) {
      const age = now.getFullYear() - d.install_year;
      if (age >= RULES.oldAfterYears) add(d, "old", "Due for replacement", `installed ${d.install_year} (${age} yrs)`);
    }
    const avg = d.energy_kwh != null ? energyByType.get(d.type ?? d.name) : undefined;
    if (d.energy_kwh != null && avg && avg.n > 1) {
      const mean = avg.sum / avg.n;
      if (mean > 0 && d.energy_kwh >= mean * RULES.highEnergyFactor) {
        add(d, "high_energy", "High energy use", `${d.energy_kwh} kWh/yr, ${(d.energy_kwh / mean).toFixed(1)}× the average ${(d.type ?? d.name).toLowerCase()}`);
      }
    }
  }
  return issues.sort((a, b) => b.priority - a.priority || (b.openDays ?? 0) - (a.openDays ?? 0));
}

/** Per-apartment roll-up, keyed by the apartment's object name (e.g. APT_4301). */
export function unitSummaries(devices: SiteDevice[], issues: Issue[]): Map<string, UnitSummary> {
  const out = new Map<string, UnitSummary>();
  const get = (unit: string) => {
    let s = out.get(unit);
    if (!s) out.set(unit, (s = { issues: [], priority: 0, level: null, broken: 0, energyKwh: 0, oldestInstallYear: null }));
    return s;
  };
  for (const d of devices) {
    const s = get(d.unit_object_name);
    if (isBroken(d)) s.broken++;
    s.energyKwh += d.energy_kwh ?? 0;
    if (d.install_year != null && (s.oldestInstallYear == null || d.install_year < s.oldestInstallYear)) s.oldestInstallYear = d.install_year;
  }
  for (const i of issues) {
    const s = get(i.device.unit_object_name);
    s.issues.push(i);
    if (i.priority > s.priority) { s.priority = i.priority; s.level = i.level; }
  }
  return out;
}

// Issues run green → red; apartments with no issues stay neutral so problems stand out.
export const LEVEL_COLORS: Record<Level, string> = { urgent: "#e5484d", high: "#f76b15", medium: "#f5c518", low: "#46a758" };
export const LEVEL_LABELS: Record<Level, string> = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
const OK_COLOR = "#d4d8dc";
const NO_DATA_COLOR = "#c3c8cc";

export type HeatMode = "off" | "priority" | "energy" | "age";

/** Green → yellow → red for t in [0, 1]. */
function ramp(t: number) {
  const c = Math.min(1, Math.max(0, t));
  const hue = 120 * (1 - c);
  return `hsl(${hue.toFixed(0)}, 70%, 48%)`; // comma syntax: three.js doesn't parse space-separated hsl()
}

/** Apartment colours for the heatmap, keyed by apartment object name; null when off. */
export function heatColors(mode: HeatMode, unitNames: string[], summaries: Map<string, UnitSummary>, now = new Date()): Record<string, string> | null {
  if (mode === "off") return null;
  const colors: Record<string, string> = {};
  if (mode === "priority") {
    for (const u of unitNames) {
      const s = summaries.get(u);
      colors[u] = s?.level ? LEVEL_COLORS[s.level] : OK_COLOR;
    }
    return colors;
  }
  const value = (s: UnitSummary | undefined) =>
    mode === "energy" ? (s && s.energyKwh > 0 ? s.energyKwh : null)
      : s?.oldestInstallYear != null ? now.getFullYear() - s.oldestInstallYear : null;
  const values = unitNames.map((u) => value(summaries.get(u))).filter((v): v is number => v != null);
  const min = Math.min(...values), max = Math.max(...values);
  for (const u of unitNames) {
    const v = value(summaries.get(u));
    colors[u] = v == null ? NO_DATA_COLOR : ramp(max > min ? (v - min) / (max - min) : 0);
  }
  return colors;
}

export const HEAT_LEGENDS: Record<Exclude<HeatMode, "off">, { label: string; stops: [string, string][] }> = {
  priority: {
    label: "Worst open issue",
    stops: [[OK_COLOR, "No issues"], [LEVEL_COLORS.low, "Low"], [LEVEL_COLORS.medium, "Medium"], [LEVEL_COLORS.high, "High"], [LEVEL_COLORS.urgent, "Urgent"]],
  },
  energy: { label: "Total device energy (kWh/yr)", stops: [[ramp(0), "Lowest"], [ramp(0.5), ""], [ramp(1), "Highest"]] },
  age: { label: "Oldest device", stops: [[ramp(0), "Newest"], [ramp(0.5), ""], [ramp(1), "Oldest"]] },
};
