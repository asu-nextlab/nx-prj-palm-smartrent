// Apartment layout templates used for the built-in sample sites and the
// downloadable sample GLB. Units are metres; unit-local origin is the
// front-left floor corner, X = width, Z = depth.

export type LayoutId = "studio" | "one_bed" | "two_bed" | "three_bed";

export interface Room { name: string; r: [number, number, number, number]; floor: string }
export interface Furniture { name: string; p: [number, number]; s: [number, number, number]; color: string }
export interface DeviceSlot { obj: string; p: [number, number]; y: number; s: [number, number, number]; color: string }

export interface LayoutTemplate {
  id: LayoutId;
  name: string;
  width: number;
  depth: number;
  rooms: Room[];
  furniture: Furniture[];
  devices: DeviceSlot[];
}

const WOOD = "#c9a27a", TILE = "#d9dcd8", CARPET = "#b9b3a6";

const commonDevices = (w: number, d: number): DeviceSlot[] => [
  { obj: "DEV_fridge", p: [0.1, 0.12], y: 0.95, s: [0.8, 1.9, 0.7], color: "#e8ecee" },
  { obj: "DEV_range", p: [0.22, 0.08], y: 0.45, s: [0.75, 0.9, 0.65], color: "#3a3f45" },
  { obj: "DEV_thermostat", p: [0.5, 0.02], y: 1.5, s: [0.15, 0.15, 0.05], color: "#32bdcd" },
  { obj: "DEV_lock", p: [0.9, 0.01], y: 1.0, s: [0.08, 0.2, 0.06], color: "#191d23" },
  { obj: "DEV_tv", p: [0.6, 0.98 - 0.3 / d], y: 1.3, s: [1.4, 0.8, 0.08], color: "#111418" },
].map((x) => ({ ...x, p: [x.p[0], x.p[1]] as [number, number], s: x.s as [number, number, number] })).map((x) => (w ? x : x));

export const LAYOUTS: Record<LayoutId, LayoutTemplate> = {
  studio: {
    id: "studio", name: "Studio", width: 7, depth: 6,
    rooms: [
      { name: "Living / sleep", r: [0, 0.35, 1, 1], floor: WOOD },
      { name: "Kitchen", r: [0, 0, 0.55, 0.35], floor: TILE },
      { name: "Bath", r: [0.55, 0, 1, 0.35], floor: TILE },
    ],
    furniture: [
      { name: "Bed", p: [0.25, 0.75], s: [1.6, 0.5, 2], color: "#e9e4da" },
      { name: "Sofa", p: [0.72, 0.62], s: [1.8, 0.7, 0.8], color: "#127d89" },
      { name: "Bathtub", p: [0.82, 0.18], s: [0.75, 0.5, 1.6], color: "#f4f6f7" },
    ],
    devices: commonDevices(7, 6),
  },
  one_bed: {
    id: "one_bed", name: "One bedroom", width: 8, depth: 7,
    rooms: [
      { name: "Living", r: [0, 0.4, 0.55, 1], floor: WOOD },
      { name: "Kitchen", r: [0, 0, 0.55, 0.4], floor: TILE },
      { name: "Bedroom", r: [0.55, 0.45, 1, 1], floor: CARPET },
      { name: "Bath", r: [0.55, 0, 1, 0.45], floor: TILE },
    ],
    furniture: [
      { name: "Bed", p: [0.78, 0.75], s: [1.6, 0.5, 2], color: "#e9e4da" },
      { name: "Sofa", p: [0.28, 0.65], s: [2, 0.7, 0.85], color: "#127d89" },
      { name: "Dining table", p: [0.3, 0.45], s: [1.2, 0.75, 0.8], color: WOOD },
      { name: "Bathtub", p: [0.85, 0.22], s: [0.75, 0.5, 1.6], color: "#f4f6f7" },
    ],
    devices: commonDevices(8, 7),
  },
  two_bed: {
    id: "two_bed", name: "Two bedroom", width: 10, depth: 8,
    rooms: [
      { name: "Living", r: [0, 0.4, 0.45, 1], floor: WOOD },
      { name: "Kitchen", r: [0, 0, 0.45, 0.4], floor: TILE },
      { name: "Bedroom 1", r: [0.45, 0.5, 1, 1], floor: CARPET },
      { name: "Bedroom 2", r: [0.7, 0, 1, 0.5], floor: CARPET },
      { name: "Bath", r: [0.45, 0, 0.7, 0.5], floor: TILE },
    ],
    furniture: [
      { name: "Bed 1", p: [0.72, 0.78], s: [1.6, 0.5, 2], color: "#e9e4da" },
      { name: "Bed 2", p: [0.86, 0.25], s: [1, 0.5, 2], color: "#e9e4da" },
      { name: "Sofa", p: [0.22, 0.68], s: [2, 0.7, 0.85], color: "#127d89" },
      { name: "Dining table", p: [0.25, 0.47], s: [1.4, 0.75, 0.9], color: WOOD },
      { name: "Bathtub", p: [0.58, 0.2], s: [0.75, 0.5, 1.6], color: "#f4f6f7" },
    ],
    devices: commonDevices(10, 8),
  },
  three_bed: {
    id: "three_bed", name: "Three bedroom", width: 12, depth: 9,
    rooms: [
      { name: "Living", r: [0, 0.4, 0.4, 1], floor: WOOD },
      { name: "Kitchen", r: [0, 0, 0.4, 0.4], floor: TILE },
      { name: "Primary bedroom", r: [0.4, 0.5, 0.72, 1], floor: CARPET },
      { name: "Bedroom 2", r: [0.72, 0.5, 1, 1], floor: CARPET },
      { name: "Bedroom 3", r: [0.72, 0, 1, 0.5], floor: CARPET },
      { name: "Bath", r: [0.4, 0, 0.72, 0.5], floor: TILE },
    ],
    furniture: [
      { name: "Bed 1", p: [0.56, 0.8], s: [1.8, 0.5, 2.1], color: "#e9e4da" },
      { name: "Bed 2", p: [0.86, 0.8], s: [1, 0.5, 2], color: "#e9e4da" },
      { name: "Bed 3", p: [0.86, 0.25], s: [1, 0.5, 2], color: "#e9e4da" },
      { name: "Sofa", p: [0.2, 0.7], s: [2.2, 0.7, 0.9], color: "#127d89" },
      { name: "Dining table", p: [0.22, 0.47], s: [1.6, 0.75, 0.9], color: WOOD },
      { name: "Bathtub", p: [0.5, 0.2], s: [0.75, 0.5, 1.6], color: "#f4f6f7" },
    ],
    devices: commonDevices(12, 9),
  },
};

export const FLOOR_HEIGHT = 3;

export const BUILDING_COLORS: Record<string, string> = {
  sand: "#e6d6bd", terracotta: "#d49a7a", slate: "#a9b4bd", sage: "#b8c6a8",
};

export function layoutOf(id: string | null | undefined): LayoutTemplate {
  return LAYOUTS[(id as LayoutId) ?? "one_bed"] ?? LAYOUTS.one_bed;
}

const DEVICE_TYPES: [RegExp, string, string][] = [
  [/fridge|refrig/i, "Refrigerator", "Fridge-freezer"],
  [/range|cooker|oven|stove/i, "Cooker", "Electric range / oven"],
  [/tv|television/i, "Television", "LED television"],
  [/thermo/i, "Thermostat", "Smart thermostat"],
  [/lock/i, "Smart lock", "Door lock"],
  [/wash/i, "Washer", "Washing machine"],
  [/dry/i, "Dryer", "Clothes dryer"],
  [/dish/i, "Dishwasher", "Dishwasher"],
  [/light|lamp/i, "Light", "Smart light"],
  [/sensor|leak/i, "Sensor", "Leak sensor"],
];

/** Kinds offered when adding a device in the web app. Names and types come from
 *  guessDevice, so web-added devices match ones ingested from a GLB. */
export const DEVICE_KINDS = ["thermostat", "lock", "leak_sensor", "fridge", "range", "tv", "washer", "dryer", "dishwasher", "light"] as const;

export function guessDevice(objectName: string): { name: string; type: string } {
  for (const [re, name, type] of DEVICE_TYPES) if (re.test(objectName)) return { name, type };
  const raw = objectName.replace(/^DEV_?/i, "").replace(/_\d+$/, "").replace(/_/g, " ");
  return { name: raw.charAt(0).toUpperCase() + raw.slice(1), type: "Device" };
}
