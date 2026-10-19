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
  /** Heatmap apartment score = worst issue + this share of every other issue's points, so an
   *  apartment with three urgent devices reads hotter than one with a single urgent device. */
  otherIssuesWeight: 0.25,
  /** Apartment score at which the heatmap reaches its darkest red. */
  darkestAt: 160,
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
  /** Whole-apartment score for the heatmap: worst issue + a share of the rest (see RULES). */
  heatScore: number;
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
    if (!s) out.set(unit, (s = { issues: [], priority: 0, level: null, heatScore: 0, broken: 0, energyKwh: 0, oldestInstallYear: null }));
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
  for (const s of out.values()) {
    const total = s.issues.reduce((sum, i) => sum + i.priority, 0);
    s.heatScore = Math.round(s.priority + RULES.otherIssuesWeight * (total - s.priority));
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

const DARKEST = "#8f1d1d";
/** Priority gradient anchored on the level thresholds, so a colour means the same score on
 *  every site: green at Low, yellow at Medium, orange at High, red at Urgent, then darkening. */
const PRIORITY_STOPS: [number, string][] = [
  [0, LEVEL_COLORS.low],
  [RULES.levels.medium, LEVEL_COLORS.medium],
  [RULES.levels.high, LEVEL_COLORS.high],
  [RULES.levels.urgent, LEVEL_COLORS.urgent],
  [RULES.darkestAt, DARKEST],
];

const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Colour for an apartment score, blended between the neighbouring stops. */
export function priorityColor(score: number): string {
  let i = 1;
  while (i < PRIORITY_STOPS.length - 1 && score > PRIORITY_STOPS[i]![0]) i++;
  const [s0, c0] = PRIORITY_STOPS[i - 1]!, [s1, c1] = PRIORITY_STOPS[i]!;
  const t = Math.min(1, Math.max(0, (score - s0) / (s1 - s0)));
  const a = hexRgb(c0), b = hexRgb(c1);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k]! - v) * t)).join(", ")})`;
}

/** Apartment colours for the heatmap, keyed by apartment object name; null when off. */
export function heatColors(mode: HeatMode, unitNames: string[], summaries: Map<string, UnitSummary>, now = new Date()): Record<string, string> | null {
  if (mode === "off") return null;
  const colors: Record<string, string> = {};
  if (mode === "priority") {
    for (const u of unitNames) {
      const s = summaries.get(u);
      colors[u] = s?.issues.length ? priorityColor(s.heatScore) : OK_COLOR;
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

export interface HeatLegend {
  label: string;
  /** CSS gradient for the legend bar, with its end labels. */
  gradient: string;
  from: string;
  to: string;
  /** Optional separate swatch, e.g. apartments with no issues. */
  extra?: [color: string, label: string];
}

const cssStops = (stops: [number, string][]) => {
  const max = stops[stops.length - 1]![0];
  return `linear-gradient(to right, ${stops.map(([s, c]) => `${c} ${((s / max) * 100).toFixed(0)}%`).join(", ")})`;
};

export const HEAT_LEGENDS: Record<Exclude<HeatMode, "off">, HeatLegend> = {
  priority: {
    label: "Apartment priority",
    gradient: cssStops(PRIORITY_STOPS),
    from: "Low",
    to: "Most urgent",
    extra: [OK_COLOR, "No issues"],
  },
  energy: { label: "Total device energy (kWh/yr)", gradient: `linear-gradient(to right, ${ramp(0)}, ${ramp(0.5)}, ${ramp(1)})`, from: "Lowest", to: "Highest" },
  age: { label: "Oldest device", gradient: `linear-gradient(to right, ${ramp(0)}, ${ramp(0.5)}, ${ramp(1)})`, from: "Newest", to: "Oldest" },
};
