import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sitesQuery, meQuery, creatorName, deleteSite } from "@/lib/twin/data";
import { ingestGlb } from "@/lib/twin/ingest";
import { exportSampleGlb } from "@/lib/twin/build";
import { AppHeader } from "@/components/twin/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ModellerGuide } from "@/components/twin/ModellerGuide";

export const Route = createFileRoute("/_authenticated/sites/")({
  head: () => ({
    meta: [
      { title: "Sites — SmartRent Digital Twin" },
      { name: "description", content: "All SmartRent communities and uploaded site models." },
      { property: "og:title", content: "Sites — SmartRent Digital Twin" },
      { property: "og:description", content: "All SmartRent communities and uploaded site models." },
    ],
  }),
  component: SitesPage,
});

function SitesPage() {
  const { data, isLoading } = useQuery(sitesQuery);
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const remove = async (e: React.MouseEvent, s: { id: string; name: string; model_path: string | null }) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Delete "${s.name}" and all its apartment data?`)) return;
    try { await deleteSite(s); toast.success("Site deleted"); qc.invalidateQueries({ queryKey: ["sites"] }); }
    catch (err) { toast.error((err as Error).message); }
  };
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h1 className="mt-2 text-3xl font-semibold">Sites</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={async () => {
              // Generate the sample GLB and download it via a link document element.
              const blob = await exportSampleGlb();
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "smartrent-sample-site.glb"; a.click();
            }}>Download sample GLB</Button>
            <UploadDialog />
          </div>
        </div>
        {isLoading ? <p className="mt-10 text-muted-foreground">Loading…</p> : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((s) => (
              <Link key={s.id} to="/sites/$siteId" params={{ siteId: s.id }}
                className="group rounded-xl border bg-card p-5 transition hover:border-brand hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.kind === "glb" ? "Uploaded model" : "Sample model"}</span>
                  <span className="text-xs text-muted-foreground">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold group-hover:text-brand-deep">{s.name}</h2>
                <p className="text-sm text-muted-foreground">{s.city ?? "—"}</p>
                <p className="mt-4 font-display text-2xl">{(s.units as unknown as { count: number }[])[0]?.count ?? 0}<span className="ml-1 text-sm text-muted-foreground">apartments</span></p>
                {s.kind === "glb" && (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <span className="truncate">Uploaded by {s.created_by_name ?? "unknown"}</span>
                    {me && s.created_by === me && (
                      <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={(e) => remove(e, s)}>Delete</Button>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
        <ModellerGuide />
      </main>
    </div>
  );
}

function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("33.4255");
  const [lon, setLon] = useState("-111.94");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Called when the form specified below is submitted.
  // The file is retrieved from the file upload input of said form.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      // Get a list of units from the 
      setBusy("Reading model…");
      const units = await ingestGlb(await file.arrayBuffer());
      if (!units.length) throw new Error("No apartments found. Name apartment objects APT_<number>.");

      setBusy("Uploading…");

      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/${crypto.randomUUID()}.glb`;
      const up = await supabase.storage.from("models").upload(path, file, { contentType: "model/gltf-binary" });
      if (up.error) throw up.error;

      setBusy(`Saving ${units.length} apartments…`);

      const { data: site, error } = await supabase.from("sites").insert({ name, city, lat: Number(lat), lon: Number(lon), kind: "glb", model_path: path, created_by: u.user!.id, created_by_name: creatorName(u.user) }).select().single();
      if (error) throw error;

      const { data: rows, error: ue } = await supabase.from("units").insert(units.map((x) => ({
        site_id: site.id, object_name: x.object_name, apt_number: x.apt_number, floor: x.floor,
        beds: x.beds, baths: x.baths, area_sqft: x.area_sqft, layout: x.layout,
      }))).select("id, object_name");
      if (ue) throw ue;

      const idOf = new Map(rows.map((r) => [r.object_name, r.id]));
      const devs = units.flatMap((x) => x.devices.map((d) => ({ unit_id: idOf.get(x.object_name)!, ...d })));
      if (devs.length) { const { error: de } = await supabase.from("devices").insert(devs); if (de) throw de; }

      // Successful Import
      toast.success(`Imported ${units.length} apartments and ${devs.length} devices`);
      qc.invalidateQueries({ queryKey: ["sites"] });
      setOpen(false);
      navigate({ to: "/sites/$siteId", params: { siteId: site.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally { setBusy(""); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Upload site model</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New site from GLB</DialogTitle>
          <DialogDescription>Export from Blender or SketchUp as GLB. You can fine-tune position and rotation on the map afterwards.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Site name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Phoenix, AZ" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Latitude</Label><Input required value={lat} onChange={(e) => setLat(e.target.value)} /></div>
            <div><Label>Longitude</Label><Input required value={lon} onChange={(e) => setLon(e.target.value)} /></div>
          </div>
          <div><Label>Model file (.glb)</Label><Input required type="file" accept=".glb,.gltf,model/gltf-binary" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <Button type="submit" className="w-full" disabled={!!busy}>{busy || "Import"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
