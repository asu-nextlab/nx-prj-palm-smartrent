import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { siteDevicesQuery, siteQuery } from "@/lib/twin/data";
import { getGoogleTiles } from "@/lib/twin/google.functions";
import type { GroundMode } from "@/components/twin/SiteViewer";
import { AppHeader } from "@/components/twin/AppHeader";
import { UnitTable } from "@/components/twin/UnitTable";
import { DetailPanel } from "@/components/twin/DetailPanel";
import { MaintenanceList } from "@/components/twin/MaintenanceList";
import { HEAT_LEGENDS, heatColors, siteIssues, unitSummaries, type HeatMode } from "@/lib/twin/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { hiddenForFloor } from "@/lib/twin/selection";

const SiteViewer = lazy(() => import("@/components/twin/SiteViewer"));

export const Route = createFileRoute("/_authenticated/sites/$siteId")({
  head: () => ({
    meta: [
      { title: "Site explorer — SmartRent Digital Twin" },
      { name: "description", content: "Explore a SmartRent community in 2D and 3D, edit apartments and inspect devices." },
      { property: "og:title", content: "Site explorer — SmartRent Digital Twin" },
      { property: "og:description", content: "Explore a SmartRent community in 2D and 3D." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SitePage,
});

function Seg({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg bg-card/95 p-0.5 shadow-sm ring-1 ring-border">
      {options.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", value === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{l}</button>
      ))}
    </div>
  );
}

const viewPrefs: { ground: GroundMode; clip: boolean } = { ground: "map", clip: true };

function SitePage() {
  const { siteId } = Route.useParams();
  const { data, isLoading, error } = useQuery(siteQuery(siteId));
  const { data: siteDevices } = useQuery(siteDevicesQuery(siteId));
  const [modelDevices, setModelDevices] = useState<Record<string, string[]> | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [device, setDevice] = useState<string | null>(null);
  const [view, setView] = useState<"2d" | "3d">("3d");
  // Kept outside component state so a refresh/remount after a placement change keeps the chosen map type.
  const [ground, setGroundState] = useState<GroundMode>(() => viewPrefs.ground);
  const setGround = (g: GroundMode) => { viewPrefs.ground = g; setGroundState(g); };
  const [clip, setClipState] = useState(() => viewPrefs.clip);
  const setClip = (c: boolean) => { viewPrefs.clip = c; setClipState(c); };
  const needsGoogle = ground === "satellite" || ground === "roadmap" || ground === "city3d";
  const google = useQuery({ queryKey: ["google-tiles"], queryFn: () => getGoogleTiles(), enabled: needsGoogle, staleTime: 1000 * 60 * 60 * 6, retry: false });
  const [building, setBuilding] = useState("all");
  const [floor, setFloor] = useState<number | null>(null);
  const [tab, setTab] = useState<"apartments" | "maintenance">("apartments");
  const [heatMode, setHeatMode] = useState<HeatMode>("off");

  // Signed model URLs change on every refetch; reuse the first one so the 3D view doesn't reload.
  const glbUrlRef = useRef<{ path: string | null | undefined; url: string | null }>({ path: undefined, url: null });
  if (data && glbUrlRef.current.path !== data.site.model_path) glbUrlRef.current = { path: data.site.model_path, url: data.glbUrl };
  const sampleBuildings = useMemo(() => data?.buildings ?? [], [data?.buildings]);
  const sampleUnits = useMemo(() => data?.units ?? [], [data?.units]);
  const focusedUnit = sampleUnits.find((u) => u.object_name === unit) ?? null;
  const floors = useMemo(() => [...new Set(sampleUnits.map((u) => u.floor))].sort((a, b) => b - a), [sampleUnits]);
  const currentFloor = floor ?? focusedUnit?.floor ?? null;
  const hiddenUnits = useMemo(() => hiddenForFloor(sampleUnits, floor), [sampleUnits, floor]);
  const tableUnits = useMemo(() => (building === "all" ? sampleUnits : sampleUnits.filter((u) => u.building_id === building)), [sampleUnits, building]);
  const issues = useMemo(() => siteIssues(siteDevices ?? []), [siteDevices]);
  const summaries = useMemo(() => unitSummaries(siteDevices ?? [], issues), [siteDevices, issues]);
  const heat = useMemo(() => heatColors(heatMode, sampleUnits.map((u) => u.object_name), summaries), [heatMode, sampleUnits, summaries]);
  const tableUnitNames = useMemo(() => new Set(tableUnits.map((u) => u.object_name)), [tableUnits]);
  const tableIssues = useMemo(() => issues.filter((i) => tableUnitNames.has(i.device.unit_object_name)), [issues, tableUnitNames]);

  if (isLoading) return <div className="min-h-screen"><AppHeader /><p className="p-10 text-muted-foreground">Loading site…</p></div>;
  if (error || !data) return <div className="min-h-screen"><AppHeader /><p className="p-10 text-destructive">Couldn't load this site.</p></div>;
  const { site } = data;
  const selectedUnit = data.units.find((u) => u.object_name === unit) ?? null;

  return (
    <div className="flex h-screen flex-col">
      <AppHeader title={site.name} subtitle={[site.city, site.created_by_name && `Uploaded by ${site.created_by_name}`].filter(Boolean).join(" · ") || undefined} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-[3]">
            <Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">Loading 3D view…</div>}>
              <SiteViewer lat={site.lat} lon={site.lon} rotation={site.rotation} scale={site.scale} glbUrl={glbUrlRef.current.url} elevation={site.elevation ?? 0} google={google.data ?? null} clip={clip}
                buildings={sampleBuildings} units={sampleUnits} hiddenUnits={hiddenUnits} cutaway={floor != null} focusUnit={unit} focusDevice={device} view={view} ground={ground}
                devices={siteDevices} onModelDevices={setModelDevices} heat={heat}
                onPick={(u, d) => { setUnit(u); setDevice(d); }} />
            </Suspense>
            <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-2 [&>*]:pointer-events-auto">
              <Seg value={view} onChange={(v) => setView(v as "2d" | "3d")} options={[["2d", "2D plan"], ["3d", "3D explore"]]} />
              <Seg value={ground} onChange={(v) => setGround(v as GroundMode)} options={[["map", "Street map"], ["satellite", "Google satellite"], ["city3d", "3D city"], ["plane", "Simple plane"]]} />
              {ground === "city3d" && <Button size="sm" variant="secondary" className="h-8 shadow-sm" aria-pressed={clip} onClick={() => setClip(!clip)}>{clip ? "Existing buildings: cut out" : "Existing buildings: shown"}</Button>}
              {needsGoogle && google.isLoading && <span className="rounded-md bg-card/95 px-2 py-1 text-xs text-muted-foreground ring-1 ring-border">Loading Google imagery…</span>}
              {needsGoogle && google.error && <span className="rounded-md bg-card/95 px-2 py-1 text-xs text-destructive ring-1 ring-border">Google imagery unavailable: {(google.error as Error).message.slice(0, 120)}</span>}
              {unit && <Button size="sm" variant="secondary" className="h-8 shadow-sm" onClick={() => { setUnit(null); setDevice(null); }}>Show entire community</Button>}
              <div className="ml-auto"><PlacementPopover site={site} /></div>
            </div>
            {floors.length > 0 && (
              <nav aria-label="Floor levels" className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-lg bg-card/95 p-1 shadow-sm ring-1 ring-border">
                {floors.map((f) => (
                  <button key={f} aria-pressed={currentFloor === f} onClick={() => { setFloor(f); if (focusedUnit && focusedUnit.floor > f) { setUnit(null); setDevice(null); } }}
                    className={cn("h-8 w-10 rounded-md text-xs font-medium transition-colors", currentFloor === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    {f}
                  </button>
                ))}
                <button onClick={() => { setFloor(null); setUnit(null); setDevice(null); }} aria-pressed={currentFloor == null} className={cn("h-7 w-10 rounded-md text-[0.65rem] font-medium", currentFloor == null ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}>All</button>
              </nav>
            )}
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
              {heatMode !== "off" && (
                <div className="flex items-center gap-2 rounded-md bg-card/95 px-2 py-1 text-[0.65rem] text-muted-foreground shadow-sm ring-1 ring-border">
                  <span className="font-medium text-foreground">{HEAT_LEGENDS[heatMode].label}</span>
                  {HEAT_LEGENDS[heatMode].extra && (
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: HEAT_LEGENDS[heatMode].extra![0] }} />{HEAT_LEGENDS[heatMode].extra![1]}
                    </span>
                  )}
                  <span>{HEAT_LEGENDS[heatMode].from}</span>
                  <span className="h-2.5 w-28 rounded-sm" style={{ background: HEAT_LEGENDS[heatMode].gradient }} />
                  <span>{HEAT_LEGENDS[heatMode].to}</span>
                </div>
              )}
              <Seg value={heatMode} onChange={(v) => setHeatMode(v as HeatMode)} options={[["off", "Heatmap off"], ["priority", "Priority"], ["energy", "Energy"], ["age", "Device age"]]} />
            </div>
            {unit && <span className="pointer-events-none absolute bottom-8 right-2 rounded-md bg-card/95 px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border">Double-click to exit</span>}
            {needsGoogle && <span className="absolute bottom-2 right-2 rounded bg-card/90 px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">Google · Map data ©{new Date().getFullYear()} Google</span>}
            {ground === "map" && <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="absolute bottom-2 right-2 rounded bg-card/90 px-2 py-0.5 text-[0.65rem] text-muted-foreground">© OpenStreetMap contributors</a>}
          </div>
          <div className="flex min-h-0 flex-[2] flex-col border-t bg-card">
            <div className="flex items-center gap-3 border-b px-4 py-2">
              <Seg value={tab} onChange={(v) => setTab(v as "apartments" | "maintenance")}
                options={[["apartments", `Apartments (${tableUnits.length})`], ["maintenance", `Maintenance (${tableIssues.length})`]]} />
              {data.buildings.length > 0 && (
                <select value={building} onChange={(e) => { setBuilding(e.target.value); setFloor(null); }} className="rounded-md border bg-background px-2 py-1 text-xs">
                  <option value="all">All buildings</option>
                  {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {tab === "apartments" ? "Click a cell to edit · saves automatically" : "Most urgent first · click to open the device"}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              {tab === "apartments"
                ? <UnitTable units={tableUnits} buildings={data.buildings} siteId={siteId} selected={unit} onSelect={(o) => { setUnit(o); setDevice(null); }} />
                : <MaintenanceList issues={tableIssues} units={data.units} buildings={data.buildings} selectedUnit={unit} selectedDevice={device}
                    onSelect={(u, d) => { setUnit(u); setDevice(d); setFloor(null); }} />}
            </div>
          </div>
        </div>
        {selectedUnit && (
          <aside className="w-80 shrink-0 border-l bg-background">
            <DetailPanel unit={selectedUnit} device={device} modelDevices={modelDevices ? modelDevices[selectedUnit.object_name] ?? [] : null}
              issues={summaries.get(selectedUnit.object_name)?.issues ?? []}
              onSelectDevice={setDevice} onClose={() => { setUnit(null); setDevice(null); }} />
          </aside>
        )}
      </div>
    </div>
  );
}

function PlacementPopover({ site }: { site: { id: string; lat: number; lon: number; rotation: number; scale: number; elevation: number; kind: string; model_path: string | null; created_by: string | null } }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ lat: String(site.lat), lon: String(site.lon), rotation: String(site.rotation), scale: String(site.scale), elevation: String(+(site.elevation / 0.3048).toFixed(2)) });
  const [step, setStep] = useState(10);
  const save = async (over?: Partial<typeof f>): Promise<void> => {
    if (!over && !confirm("This will overwrite the saved map placement for everyone. Are you sure?")) return;
    const v = { ...f, ...over };
    const patch = { lat: Number(v.lat), lon: Number(v.lon), rotation: Number(v.rotation), scale: Number(v.scale), elevation: Number(v.elevation) * 0.3048 };
    if (Object.values(patch).some(isNaN)) { toast.error("Enter numbers only"); return; }
    const { error } = await supabase.from("sites").update(patch).eq("id", site.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["site", site.id] });
    if (!over) toast.success("Placement saved");
  };
  // Moving the site's anchor point moves the buildings over the map.
  const nudge = (north: number, east: number) => {
    const m = step * 0.3048;
    const lat = Number(f.lat), lon = Number(f.lon);
    if (isNaN(lat) || isNaN(lon)) { toast.error("Enter numbers only"); return; }
    const nlat = lat + (north * m) / 111320;
    const nlon = lon + (east * m) / (111320 * Math.cos((lat * Math.PI) / 180));
    const next = { lat: nlat.toFixed(7), lon: nlon.toFixed(7) };
    setF({ ...f, ...next });
    void save(next);
  };
  const lift = (dir: number) => {
    const e = Number(f.elevation);
    if (isNaN(e)) { toast.error("Enter numbers only"); return; }
    const next = { elevation: String(+(e + dir * step).toFixed(2)) };
    setF({ ...f, ...next });
    void save(next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild><Button size="sm" variant="secondary" className="h-8 shadow-sm">Map placement</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["lat", "lon", "rotation", "scale", "elevation"] as const).map((k) => (
            <div key={k}><Label className="text-xs capitalize">{k === "rotation" ? "Rotation °" : k === "elevation" ? "Height (ft)" : k}</Label>
              <Input className="h-8" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
        </div>
        <div className="space-y-2 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Nudge buildings</Label>
            <Seg value={String(step)} onChange={(v) => setStep(Number(v))} options={[["1", "1 ft"], ["10", "10 ft"], ["100", "100 ft"]]} />
          </div>
          <div className="mx-auto grid w-28 grid-cols-3 gap-1">
            <span /><Button size="sm" variant="outline" className="h-8" aria-label="Move north" onClick={() => nudge(1, 0)}>N</Button><span />
            <Button size="sm" variant="outline" className="h-8" aria-label="Move west" onClick={() => nudge(0, -1)}>W</Button><span />
            <Button size="sm" variant="outline" className="h-8" aria-label="Move east" onClick={() => nudge(0, 1)}>E</Button>
            <span /><Button size="sm" variant="outline" className="h-8" aria-label="Move south" onClick={() => nudge(-1, 0)}>S</Button><span />
          </div>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" className="h-8" aria-label="Move up" onClick={() => lift(1)}>▲ Up</Button>
            <Button size="sm" variant="outline" className="h-8" aria-label="Move down" onClick={() => lift(-1)}>▼ Down</Button>
          </div>
        </div>
        <Button size="sm" className="w-full" onClick={() => save()}>Save placement</Button>
      </PopoverContent>
    </Popover>
  );
}
